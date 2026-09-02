/**
 * tools/slice-sheet.ts
 *
 * Standalone slicing inspector for a single sheet — useful when authoring a
 * new assets.config.json entry.
 *
 *   npx tsx tools/slice-sheet.ts <source-path> [--tolerance 80] [--alpha] [--out dir]
 *
 * Prints detected segments; with --out, also writes each segment as a
 * transparent PNG for visual review (never touches the source).
 */
import path from 'node:path';
import {
  loadRGBA,
  dechroma,
  findGreenRegion,
  segmentGreenSheet,
  segmentAlphaSheet,
  crop,
  savePNG,
} from './lib/imaging.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const src = argv.find((a) => !a.startsWith('--'));
  if (!src) {
    console.error('usage: npx tsx tools/slice-sheet.ts <source-path> [--tolerance N] [--alpha] [--out dir]');
    process.exitCode = 1;
    return;
  }
  const tolArg = argv.indexOf('--tolerance');
  const tolerance = tolArg >= 0 ? Number(argv[tolArg + 1]) : 80;
  const alpha = argv.includes('--alpha');
  const outArg = argv.indexOf('--out');
  const outDir = outArg >= 0 ? argv[outArg + 1] : null;

  const img = await loadRGBA(path.resolve(ROOT, src));
  let segments;
  let processed = img;
  if (alpha) {
    segments = segmentAlphaSheet(img, {});
  } else {
    const region = findGreenRegion(img, tolerance);
    console.log(`green region: x=${region.x} y=${region.y} w=${region.w} h=${region.h}`);
    segments = segmentGreenSheet(img, region, { tolerance });
    processed = dechroma(img);
  }
  console.log(`${segments.length} segment(s):`);
  for (const s of segments) {
    console.log(`  band=${s.band} idx=${s.index} x=${s.x} y=${s.y} w=${s.w} h=${s.h}`);
    if (outDir) {
      await savePNG(crop(processed, s), path.resolve(ROOT, outDir, `b${s.band}_i${s.index}.png`));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
