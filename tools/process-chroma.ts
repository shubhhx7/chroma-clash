/**
 * tools/process-chroma.ts
 *
 * Main asset-processing driver.
 *
 *   npm run assets:process             process every entry in assets.config.json
 *   npm run assets:process -- --scan   segmentation dry-run: print detected segments only
 *   npm run assets:process -- --only kairo-idle,raider-combat
 *
 * Reads raw sources (never modifies them), removes chroma green, slices
 * frames, packs animation strips, writes transparent PNGs + JSON metadata to
 * assets_processed/, and records failures in
 * assets_processed/reports/asset-errors.json.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  loadRGBA,
  shrinkWrapGreen,
  dechroma,
  removeSmallBlobs,
  eraseDarkLineRows,
  findGreenRegion,
  segmentGreenSheet,
  segmentAlphaSheet,
  shrinkWrapAlpha,
  trimFloatingTop,
  detachBottomPlate,
  fadeEdges,
  flipHorizontal,
  keyBlackBorder,
  keyWhiteBorder,
  retrimAlpha,
  segmentsByCellComponents,
  cropCellMasked,
  type CellComponentResult,
  stripDarkHaze,
  alphaShave,
  upscaleImage,
  resizeImageTo,
  stripWhiteHaze,
  crop,
  savePNG,
  packStrip,
  type RawImage,
  type Rect,
  type Segment,
} from './lib/imaging.ts';
import type { AssetsConfig, EntryConfig, PickDef } from './lib/pipelineTypes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_ROOT = path.join(ROOT, 'assets_processed');
const ERRORS_PATH = path.join(OUT_ROOT, 'reports', 'asset-errors.json');

/** canonical baked standing height (px) — fighter sheets are resampled so a standing pose hits the per-character target */
const CANON_CHAR_PX = 380;
/** upscaling beyond this adds no detail (Lanczos headroom only) — saves texture memory on weak sources */
const MAX_BAKE_UPSCALE = 3.0;

function bakeFactor(entry: EntryConfig): number {
  if (entry.charHeightPx) {
    return Math.min((entry.charTargetPx ?? CANON_CHAR_PX) / entry.charHeightPx, MAX_BAKE_UPSCALE);
  }
  return entry.upscale && entry.upscale > 1 ? entry.upscale : 1;
}

/** actual baked standing height after clamping — runtime scales are derived from this */
function bakedStanding(entry: EntryConfig): number | undefined {
  if (!entry.charHeightPx) return undefined;
  return Math.round(entry.charHeightPx * bakeFactor(entry));
}

interface ProcessError {
  entry: string;
  source: string;
  message: string;
}

interface FrameMeta {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  sourceRect: Rect;
}

const errors: ProcessError[] = [];

function fail(entry: EntryConfig, message: string): void {
  errors.push({ entry: entry.id, source: entry.source, message });
  console.error(`  FAIL [${entry.id}] ${message}`);
}

async function writeMeta(relOut: string, meta: unknown): Promise<void> {
  const p = path.join(OUT_ROOT, 'metadata', `${relOut.replace(/[\\/]/gu, '__')}.json`);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(meta, null, 2));
}

function segsInBand(segments: Segment[], band: number): Segment[] {
  return segments.filter((s) => s.band === band).sort((a, b) => a.x - b.x);
}

function applySquareTop(rect: Rect): Rect {
  // Buttons are circular; the label plate hangs below. Keep a square-ish top.
  const h = Math.min(rect.h, Math.round(rect.w * 0.98));
  return { ...rect, h };
}

/**
 * Copy a source image into the runtime directory unchanged and record its
 * pixel bounds. The bytes are identical (sha256 logged), so the game renders
 * the artwork exactly as provided.
 */
async function processPassthrough(entry: EntryConfig): Promise<void> {
  const abs = path.join(ROOT, entry.source);
  const out = entry.output;
  if (out.kind !== 'stills' || out.pick.length !== 1) {
    fail(entry, 'passthrough needs exactly one stills pick (the output name)');
    return;
  }
  const name = out.pick[0]!.name;
  const rel = `${out.dir}/${name}`;
  const outPath = path.join(OUT_ROOT, `${rel}.png`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.copyFile(abs, outPath);

  const srcHash = createHash('sha256').update(await fs.readFile(abs)).digest('hex');
  const dstHash = createHash('sha256').update(await fs.readFile(outPath)).digest('hex');
  if (srcHash !== dstHash) {
    fail(entry, `passthrough copy is not byte-identical (${srcHash} != ${dstHash})`);
    return;
  }

  // read-only measurement of the visible artwork so the UI can size by the
  // ARTWORK rather than by the transparent canvas around it
  const img = await loadRGBA(abs);
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const contentRect =
    x1 >= 0 ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { x: 0, y: 0, w: img.width, h: img.height };
  await writeMeta(rel, {
    id: entry.id,
    source: entry.source,
    processedPath: path.relative(ROOT, outPath).split(path.sep).join('/'),
    kind: 'still',
    passthrough: true,
    sha256: srcHash,
    width: img.width,
    height: img.height,
    contentRect,
  });
  console.log(
    `  ok [${entry.id}] ${rel}.png VERBATIM COPY ${img.width}x${img.height} content ${contentRect.w}x${contentRect.h} sha256 ${srcHash.slice(0, 12)} (identical)`,
  );
}

async function processEntry(entry: EntryConfig, scan: boolean): Promise<void> {
  if (entry.type === 'passthrough') {
    if (!scan) await processPassthrough(entry);
    return;
  }
  const abs = path.join(ROOT, entry.source);
  let img: RawImage;
  try {
    img = await loadRGBA(abs);
  } catch (err) {
    fail(entry, `cannot read source: ${err}`);
    return;
  }

  if (entry.blackKey) {
    img = keyBlackBorder(img, entry.blackKeyHard ? 20 : 42, !entry.blackKeyHard, entry.blackKeyErode ?? 0);
  }
  if (entry.whiteKey) img = keyWhiteBorder(img);
  const tol = entry.greenTolerance ?? 80;
  let segments: Segment[];
  let processed: RawImage;
  let cellRes: CellComponentResult | null = null;

  if (entry.type === 'green-sheet') {
    if (entry.ignoreDarkLines) img = eraseDarkLineRows(img);
    const region: Rect = entry.region
      ? {
          x: Math.round(entry.region[0] * img.width),
          y: Math.round(entry.region[1] * img.height),
          w: Math.round(entry.region[2] * img.width),
          h: Math.round(entry.region[3] * img.height),
        }
      : findGreenRegion(img, tol);
    if (scan) console.log(`  region x=${region.x} y=${region.y} w=${region.w} h=${region.h}`);
    segments = segmentGreenSheet(img, region, {
      tolerance: tol,
      gapRows: entry.gapRows,
      gapCols: entry.gapCols,
      minW: entry.minW,
      minH: entry.minH,
      maxSegW: entry.maxSegW,
      bandsY: entry.bandsY,
      splitEven: entry.splitEven,
    });
    if (entry.cellGrid) {
      // deterministic grid slicing (known-layout sheets): shrink-wrap each
      // cell's green-keyed content, row-major, empty cells dropped
      // cells span the detected green region (skips header/footer text bars)
      const { cols, rows } = entry.cellGrid;
      if (entry.cellConnect) {
        // component-based: recovers blades that cross cell borders; the
        // result carries pixel labels for masked cropping (frames overlap)
        cellRes = segmentsByCellComponents(
          img,
          { x: region.x, y: region.y, cols, rows, w: region.w, h: region.h },
          (o) => {
            if (img.data[o + 3]! <= 32) return false;
            const r0 = img.data[o]!;
            const g0 = img.data[o + 1]!;
            const b0 = img.data[o + 2]!;
            return !(g0 >= 100 && g0 - Math.max(r0, b0) > tol);
          },
        );
        segments = cellRes.segments.filter((s) => s.w >= (entry.minW ?? 24) && s.h >= (entry.minH ?? 24));
      } else {
        segments = [];
        const cw = Math.floor(region.w / cols);
        const ch = Math.floor(region.h / rows);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const inset = 2; // neighbor frames bleed ~1-2px across cell borders in the AI sheets
            const tight = shrinkWrapGreen(img, { x: region.x + c * cw + inset, y: region.y + r * ch, w: cw - inset * 2, h: ch }, tol);
            if (tight && tight.w >= (entry.minW ?? 24) && tight.h >= (entry.minH ?? 24)) {
              segments.push({ ...tight, band: r, index: c });
            }
          }
        }
      }
    }
    if (entry.minSegX != null) {
      const minX = entry.minSegX * img.width;
      segments = segments.filter((s) => s.x >= minX);
    }
    if (entry.trimFloatingTop) {
      segments = segments.map((s) => ({ ...s, ...trimFloatingTop(img, s, tol) }));
    }
    processed = dechroma(img, entry.chromaLo ?? 40, entry.chromaHi ?? 110, entry.despillStrong ?? false, entry.chromaDarkFloor ?? 80);
    if (entry.alphaShave) processed = alphaShave(processed, entry.alphaShave);
  } else {
    if (entry.stripDarkHaze) img = stripDarkHaze(img);
    if (entry.alphaShave) img = alphaShave(img, entry.alphaShave);
    if (entry.cellGrid) {
      const { cols, rows } = entry.cellGrid;
      if (entry.cellConnect) {
        // strong-pixel labeling breaks faint alpha bridges between frames;
        // masked cropping (below) erases neighbor overlap inside each rect
        cellRes = segmentsByCellComponents(
          img,
          { x: 0, y: 0, cols, rows, w: img.width, h: img.height },
          (o) => img.data[o + 3]! >= 90,
        );
        segments = cellRes.segments.filter((s) => s.w >= (entry.minW ?? 4) && s.h >= (entry.minH ?? 4));
      } else {
        segments = [];
        const cw = Math.floor(img.width / cols);
        const ch = Math.floor(img.height / rows);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const inset = 2; // neighbor frames bleed ~1-2px across cell borders in the AI sheets
            const tight = shrinkWrapAlpha(img, { x: c * cw + inset, y: r * ch, w: cw - inset * 2, h: ch }, entry.minAlpha ?? 24);
            if (tight && tight.w >= (entry.minW ?? 4) && tight.h >= (entry.minH ?? 4)) {
              segments.push({ ...tight, band: r, index: c });
            }
          }
        }
      }
    } else {
      segments = segmentAlphaSheet(img, {
        gapRows: entry.gapRows,
        gapCols: entry.gapCols,
        minW: entry.minW,
        minH: entry.minH,
        minAlpha: entry.minAlpha,
        maxSegW: entry.maxSegW,
        bandsY: entry.bandsY,
      });
    }
    processed = img;
  }

  if (scan) {
    console.log(`\n[scan] ${entry.id} (${entry.source}) ${img.width}x${img.height}`);
    for (const s of segments) {
      console.log(`  band=${s.band} idx=${s.index} x=${s.x} y=${s.y} w=${s.w} h=${s.h}`);
    }
    return;
  }

  const out = entry.output;
  if (out.kind === 'animation') {
    let ordered = [...segments].sort((a, b) => a.band - b.band || a.x - b.x);
    if (entry.dropFrames) ordered = ordered.filter((_, i) => !entry.dropFrames?.includes(i));
    if (out.expect != null && ordered.length !== out.expect) {
      fail(entry, `expected ${out.expect} frames, segmentation found ${ordered.length} — needs manual config`);
      if (ordered.length === 0) return;
    }
    let frames = ordered.map((s) =>
      cellRes ? cropCellMasked(processed, s, cellRes, s.band * cellRes.cols + s.index) : crop(processed, s),
    );
    if (entry.cleanFrames) frames = frames.map((f) => removeSmallBlobs(f, 400, entry.cleanIsolated ?? 0));
    frames = frames.map((f, i) => (entry.flipAllFrames || entry.flipFrames?.includes(i) ? flipHorizontal(f) : f));
    const bake = bakeFactor(entry);
    if (bake !== 1) {
      frames = await Promise.all(
        frames.map((f) => resizeImageTo(f, Math.max(1, Math.round(f.width * bake)), Math.max(1, Math.round(f.height * bake)))),
      );
    }
    const { sheet, cellW, cellH, cols } = packStrip(frames, 2, entry.charHeightPx != null);
    const outPath = path.join(OUT_ROOT, `${out.name}.png`);
    await savePNG(sheet, outPath);
    const frameMeta: FrameMeta[] = ordered.map((s, i) => ({
      index: i,
      x: (i % cols) * cellW,
      y: Math.floor(i / cols) * cellH,
      w: cellW,
      h: cellH,
      sourceRect: { x: s.x, y: s.y, w: s.w, h: s.h },
    }));
    await writeMeta(out.name, {
      id: entry.id,
      source: entry.source,
      processedPath: path.relative(ROOT, outPath).split(path.sep).join('/'),
      kind: 'animation',
      bakedStandingPx: bakedStanding(entry),
      frameWidth: cellW,
      frameHeight: cellH,
      frameCount: ordered.length,
      fps: out.fps,
      loop: out.loop,
      pivot: entry.pivot ?? { x: 0.5, y: 1 },
      baseline: entry.baseline ?? 1,
      frames: frameMeta,
    });
    console.log(`  ok [${entry.id}] ${out.name}.png (${ordered.length} frames, ${cellW}x${cellH})`);
  } else if (out.kind === 'multi-animation') {
    for (const anim of out.animations) {
      const segs = segsInBand(segments, anim.band);
      if (anim.expect != null && segs.length !== anim.expect) {
        fail(entry, `band ${anim.band} (${anim.name}): expected ${anim.expect} frames, found ${segs.length}`);
        if (segs.length === 0) continue;
      }
      let frames = segs.map((s) => crop(processed, s));
      if (entry.cleanFrames) frames = frames.map((f) => removeSmallBlobs(f));
      frames = frames.map((f, i) => (entry.flipAllFrames || entry.flipFrames?.includes(i) ? flipHorizontal(f) : f));
      const bake = bakeFactor(entry);
      if (bake !== 1) {
        frames = await Promise.all(
          frames.map((f) => resizeImageTo(f, Math.max(1, Math.round(f.width * bake)), Math.max(1, Math.round(f.height * bake)))),
        );
      }
      const { sheet, cellW, cellH, cols } = packStrip(frames, 2, entry.charHeightPx != null);
      const rel = `${out.dir}/${anim.name}`;
      const outPath = path.join(OUT_ROOT, `${rel}.png`);
      await savePNG(sheet, outPath);
      await writeMeta(rel, {
        id: `${entry.id}:${anim.name}`,
        source: entry.source,
        processedPath: path.relative(ROOT, outPath).split(path.sep).join('/'),
        kind: 'animation',
        bakedStandingPx: bakedStanding(entry),
        frameWidth: cellW,
        frameHeight: cellH,
        frameCount: segs.length,
        fps: anim.fps,
        loop: anim.loop,
        pivot: entry.pivot ?? { x: 0.5, y: 1 },
        baseline: entry.baseline ?? 1,
        frames: segs.map((s, i) => ({ index: i, x: (i % cols) * cellW, y: Math.floor(i / cols) * cellH, w: cellW, h: cellH, sourceRect: s })),
      });
      console.log(`  ok [${entry.id}] ${rel}.png (${segs.length} frames)`);
    }
  } else {
    for (const pick of out.pick) {
      let seg: Segment | null;
      if (pick.rect) {
        const rough = {
          x: Math.round(pick.rect[0] * img.width),
          y: Math.round(pick.rect[1] * img.height),
          w: Math.round(pick.rect[2] * img.width),
          h: Math.round(pick.rect[3] * img.height),
        };
        const tight =
          entry.type === 'green-sheet'
            ? shrinkWrapGreen(img, rough, entry.greenTolerance ?? 80)
            : shrinkWrapAlpha(img, rough, entry.minAlpha ?? 24);
        seg = tight ? { ...tight, band: -1, index: -1 } : null;
      } else {
        seg = resolvePick(segments, pick);
      }
      if (!seg) {
        fail(entry, `pick '${pick.name}' (band ${pick.band}) not found in segmentation`);
        continue;
      }
      let rect = pick.squareTop ? detachBottomPlate(img, applySquareTop(seg), entry.minAlpha ?? 24) : seg;
      if (pick.trimLeftFrac) {
        const cutX = rect.x + Math.round(rect.w * pick.trimLeftFrac);
        const cutRect = { x: cutX, y: rect.y, w: rect.w - (cutX - rect.x), h: rect.h };
        rect = entry.type === 'green-sheet' ? cutRect : (shrinkWrapAlpha(img, cutRect, entry.minAlpha ?? 24) ?? cutRect);
      }
      if (pick.trimBottomFrac) {
        const cutH = Math.round(rect.h * (1 - pick.trimBottomFrac));
        const cutRect = { x: rect.x, y: rect.y, w: rect.w, h: cutH };
        rect = entry.type === 'green-sheet' ? cutRect : (shrinkWrapAlpha(img, cutRect, entry.minAlpha ?? 24) ?? cutRect);
      }
      if (pick.trimTopFrac) {
        const cutY = rect.y + Math.round(rect.h * pick.trimTopFrac);
        const cutRect = { x: rect.x, y: cutY, w: rect.w, h: rect.h - (cutY - rect.y) };
        // re-tighten after the cut on BOTH sheet types, so dropping a caption
        // band never leaves dead margin above the artwork
        rect =
          entry.type === 'green-sheet'
            ? (shrinkWrapGreen(img, cutRect, entry.greenTolerance ?? 80) ?? cutRect)
            : (shrinkWrapAlpha(img, cutRect, entry.minAlpha ?? 24) ?? cutRect);
      }
      let frame = crop(processed, rect);
      if (entry.stripWhiteHaze) frame = stripWhiteHaze(frame);
      // drop effect slivers clipped in from neighbouring cells (they would
      // render as hard-edged coloured bars under ADD blending)
      if (entry.keepMainBlob) frame = retrimAlpha(removeSmallBlobs(frame, 200, 6));
      const fadeTop = pick.fadeTop ?? entry.fadeTop ?? 0;
      const fadeSides = pick.fadeSides ?? entry.fadeSides ?? 0;
      if (fadeTop || fadeSides) frame = fadeEdges(frame, fadeTop, fadeSides);
      const rel = `${out.dir}/${pick.name}`;
      const outPath = path.join(OUT_ROOT, `${rel}.png`);
      await savePNG(frame, outPath);
      await writeMeta(rel, {
        id: `${entry.id}:${pick.name}`,
        source: entry.source,
        processedPath: path.relative(ROOT, outPath).split(path.sep).join('/'),
        kind: 'still',
        width: frame.width,
        height: frame.height,
        sourceRect: rect,
      });
      console.log(`  ok [${entry.id}] ${rel}.png (${frame.width}x${frame.height})`);
    }
  }
}

function resolvePick(segments: Segment[], pick: PickDef): Segment | null {
  const band = segsInBand(segments, pick.band);
  if (band.length === 0) return null;
  if (pick.widest) return band.reduce((a, b) => (b.w > a.w ? b : a));
  const idx = pick.index ?? 0;
  return band[idx] ?? null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const scan = argv.includes('--scan');
  const onlyArg = argv.find((a) => a.startsWith('--only'));
  const only = onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : argv[argv.indexOf(onlyArg) + 1]).split(',') : null;

  const cfgRaw = await fs.readFile(path.join(ROOT, 'assets.config.json'), 'utf8');
  const cfg: AssetsConfig = JSON.parse(cfgRaw);
  for (const entry of cfg.entries) {
    if (only && !only.includes(entry.id)) continue;
    console.log(`processing ${entry.id}...`);
    try {
      await processEntry(entry, scan);
    } catch (err) {
      fail(entry, `unexpected: ${err instanceof Error ? err.stack : err}`);
    }
  }
  if (!scan) {
    await fs.mkdir(path.dirname(ERRORS_PATH), { recursive: true });
    await fs.writeFile(ERRORS_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), errors }, null, 2));
    console.log(`\n${errors.length} processing failure(s). Report: assets_processed/reports/asset-errors.json`);
  }
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
