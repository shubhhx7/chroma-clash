/**
 * tools/normalize-frames.ts
 *
 * Re-packs already-processed animation strips with uniform cells and
 * bottom-center (feet baseline) alignment, verifying every frame of one
 * animation shares consistent dimensions. process-chroma.ts already packs
 * this way; this tool re-normalizes strips whose metadata was hand-edited
 * (e.g. custom pivots) and reports inconsistencies.
 *
 *   npx tsx tools/normalize-frames.ts            check all animation metadata
 *   npx tsx tools/normalize-frames.ts <meta.json> re-pack one animation
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadRGBA, crop, packStrip, savePNG } from './lib/imaging.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const META_DIR = path.join(ROOT, 'assets_processed', 'metadata');

interface AnimMeta {
  kind: string;
  processedPath: string;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frames: Array<{ x: number; y: number; w: number; h: number }>;
}

async function checkAll(): Promise<void> {
  let problems = 0;
  for (const f of await fs.readdir(META_DIR)) {
    if (!f.endsWith('.json') || f === 'audit.json') continue;
    const meta = JSON.parse(await fs.readFile(path.join(META_DIR, f), 'utf8')) as AnimMeta;
    if (meta.kind !== 'animation') continue;
    const img = await loadRGBA(path.join(ROOT, meta.processedPath)).catch(() => null);
    if (!img) {
      console.error(`missing strip: ${meta.processedPath}`);
      problems++;
      continue;
    }
    const cols = Math.max(1, Math.round(img.width / meta.frameWidth));
    const rows = Math.max(1, Math.round(img.height / meta.frameHeight));
    if (cols * meta.frameWidth !== img.width || rows * meta.frameHeight !== img.height || cols * rows < meta.frameCount) {
      console.error(
        `dimension mismatch ${meta.processedPath}: sheet ${img.width}x${img.height}, cells ${meta.frameWidth}x${meta.frameHeight} x${meta.frameCount}`,
      );
      problems++;
    }
  }
  console.log(problems === 0 ? 'normalize-frames: all animation strips consistent' : `${problems} problem(s)`);
  if (problems > 0) process.exitCode = 1;
}

async function repack(metaPath: string): Promise<void> {
  const meta = JSON.parse(await fs.readFile(path.resolve(ROOT, metaPath), 'utf8')) as AnimMeta;
  const img = await loadRGBA(path.join(ROOT, meta.processedPath));
  const frames = meta.frames.map((fr) => crop(img, fr));
  const { sheet, cellW, cellH } = packStrip(frames);
  await savePNG(sheet, path.join(ROOT, meta.processedPath));
  console.log(`re-packed ${meta.processedPath} (${frames.length} frames, ${cellW}x${cellH})`);
}

const arg = process.argv[2];
(arg ? repack(arg) : checkAll()).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
