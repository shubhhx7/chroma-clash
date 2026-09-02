import { defineConfig, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Dev-only middleware that serves raw source assets at /raw/<path-under-Assets>
 * for the developer Asset Gallery. Raw sheets are intentionally NOT copied
 * into production builds.
 */
function rawAssetsPlugin(): Plugin {
  const assetsRoot = path.resolve(__dirname, 'Assets');
  return {
    name: 'chroma-clash-raw-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/raw/')) return next();
        const rel = decodeURIComponent(req.url.slice('/raw/'.length)).split('?')[0] ?? '';
        const abs = path.normalize(path.join(assetsRoot, rel));
        if (!abs.startsWith(assetsRoot) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', 'image/png');
        fs.createReadStream(abs).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // deployable from any sub-path (static hosting)
  base: './',
  // processed art is the runtime asset set; it is copied verbatim into dist/
  publicDir: 'assets_processed',
  plugins: [rawAssetsPlugin()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // raw source art is read on demand (dev /raw middleware), never bundled —
      // watching it crashes on in-flight browser downloads (.crdownload EBUSY)
      ignored: ['**/Assets/**', '**/assets_processed/**'],
    },
  },
});
