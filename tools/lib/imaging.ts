/**
 * tools/lib/imaging.ts
 *
 * Shared, non-destructive image processing primitives for the Chroma Clash
 * asset pipeline. Raw source images are only ever READ; all output goes to
 * assets_processed/.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export interface RawImage {
  data: Buffer; // RGBA
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function loadRGBA(absPath: string): Promise<RawImage> {
  const { data, info } = await sharp(absPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** greenness = g - max(r, b); high for chroma green, low for cyan/white/black. */
export function greenness(img: RawImage, x: number, y: number): number {
  const o = (y * img.width + x) * 4;
  const r = img.data[o];
  const g = img.data[o + 1];
  const b = img.data[o + 2];
  if (g < 100) return 0; // dark pixels are never chroma green
  return g - Math.max(r, b);
}

export function isGreen(img: RawImage, x: number, y: number, tolerance: number): boolean {
  return greenness(img, x, y) > tolerance;
}

/**
 * Remove chroma green with a soft edge band and despill.
 * lo..hi map greenness to alpha 1..0. Pixels already transparent stay so.
 */
export function dechroma(img: RawImage, lo = 40, hi = 110, despillStrong = false, darkFloor = 80): RawImage {
  const out = Buffer.from(img.data);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      const r = out[o];
      const g = out[o + 1];
      const b = out[o + 2];
      // dark-green ground shadows still need keying; only very dark pixels are safe
      if (g < darkFloor) continue;
      const d = g - Math.max(r, b);
      if (despillStrong && d > 0) {
        // neutralize any green cast (mist / particle sheets)
        out[o + 1] = Math.max(r, b);
      }
      if (d <= lo) continue;
      if (d >= hi) {
        out[o + 3] = 0;
      } else {
        const t = (d - lo) / (hi - lo);
        out[o + 3] = Math.min(out[o + 3], Math.round((1 - t) * 255));
        if (!despillStrong) {
          // despill: clamp green channel toward the other channels on edge pixels
          out[o + 1] = Math.min(g, Math.max(r, b) + Math.round(lo * 0.75));
        }
      }
    }
  }
  return { data: out, width: img.width, height: img.height };
}

/**
 * Key out a solid black background that is CONNECTED TO THE IMAGE BORDER,
 * turning glow falloff into an alpha ramp (art like title/overlay cards on
 * pure black). Interior dark facets stay opaque.
 */
export function keyBlackBorder(img: RawImage, dark = 42, ramp = true, erode = 0): RawImage {
  const { width: w, height: h } = img;
  const out = Buffer.from(img.data);
  const region = new Uint8Array(w * h);
  const stack: number[] = [];
  const maxc = (i: number): number => Math.max(out[i * 4]!, out[i * 4 + 1]!, out[i * 4 + 2]!);
  const pushIfDark = (i: number): void => {
    if (!region[i] && maxc(i) < dark) {
      region[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    pushIfDark(x);
    pushIfDark((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushIfDark(y * w);
    pushIfDark(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w;
    const py = (p / w) | 0;
    if (px > 0) pushIfDark(p - 1);
    if (px < w - 1) pushIfDark(p + 1);
    if (py > 0) pushIfDark(p - w);
    if (py < h - 1) pushIfDark(p + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (!region[i]) continue;
    if (!ramp) {
      // Binary key: the authored artwork keeps FULL opacity. Ramping alpha by
      // brightness dissolved the dark metal panels that are part of the design
      // (they connect to the outer background), which made banners look
      // washed out and let the arena show through.
      out[i * 4 + 3] = 0;
      continue;
    }
    const m = maxc(i);
    out[i * 4 + 3] = m <= 8 ? 0 : Math.min(255, Math.round(((m - 8) / (dark - 8)) * 255));
  }
  // erode the remaining dark anti-aliasing fringe (never touches bright art)
  for (let it = 0; it < erode; it++) {
    const kill: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (out[i * 4 + 3]! === 0 || maxc(i) > 95) continue;
        const nb =
          (x > 0 && out[(i - 1) * 4 + 3] === 0) ||
          (x < w - 1 && out[(i + 1) * 4 + 3] === 0) ||
          (y > 0 && out[(i - w) * 4 + 3] === 0) ||
          (y < h - 1 && out[(i + w) * 4 + 3] === 0);
        if (nb) kill.push(i);
      }
    }
    for (const i of kill) out[i * 4 + 3] = 0;
  }
  return { data: out, width: w, height: h };
}

/** Tighten an image to its own alpha bounds (drops dead transparent margin). */
export function retrimAlpha(img: RawImage, minAlpha = 12): RawImage {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3]! >= minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return img;
  return crop(img, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}

/**
 * Key out a near-WHITE background connected to the image border (the paper
 * backdrop AI glow/VFX art is generated on). stripWhiteHaze only attenuates
 * translucent haze; a fully opaque white field survives it and — because VFX
 * sprites render with ADD blending — shows up as a bright rectangle over the
 * fighters. Flood-filling from the border and ramping alpha by "whiteness"
 * removes the box while feathering the glow edges.
 */
export function keyWhiteBorder(img: RawImage, floodMin = 205, solid = 248): RawImage {
  const { width: w, height: h } = img;
  const out = Buffer.from(img.data);
  const region = new Uint8Array(w * h);
  const stack: number[] = [];
  // "whiteness" = the darkest channel; high for white/near-white paper
  const minc = (i: number): number => Math.min(out[i * 4]!, out[i * 4 + 1]!, out[i * 4 + 2]!);
  const pushIfWhite = (i: number): void => {
    if (!region[i] && minc(i) >= floodMin) {
      region[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    pushIfWhite(x);
    pushIfWhite((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    pushIfWhite(y * w);
    pushIfWhite(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w;
    const py = (p / w) | 0;
    if (px > 0) pushIfWhite(p - 1);
    if (px < w - 1) pushIfWhite(p + 1);
    if (py > 0) pushIfWhite(p - w);
    if (py < h - 1) pushIfWhite(p + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (!region[i]) continue;
    const m = minc(i);
    // pure paper -> fully transparent; tinted glow near the edge -> ramp
    const a = m >= solid ? 0 : Math.round(((solid - m) / (solid - floodMin)) * 255);
    out[i * 4 + 3] = Math.min(out[i * 4 + 3]!, a);
  }
  return { data: out, width: w, height: h };
}

/**
 * Remove disconnected debris from a cropped animation frame: components that
 * are tiny (frame-number digits) or small-and-greenish (keyed ground-shadow
 * remnants), keeping everything connected to the main subject.
 */
export function removeSmallBlobs(frame: RawImage, minKeepArea = 400, isolatedPx = 0): RawImage {
  const { width: w, height: h } = frame;
  const labels = new Int32Array(w * h).fill(-1);
  const comps: Array<{ area: number; greenish: number; px: number[]; x0: number; y0: number; x1: number; y1: number }> = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (labels[i] >= 0 || frame.data[i * 4 + 3] < 32) continue;
    const id = comps.length;
    const comp = { area: 0, greenish: 0, px: [] as number[], x0: w, y0: h, x1: 0, y1: 0 };
    comps.push(comp);
    stack.push(i);
    labels[i] = id;
    while (stack.length) {
      const p = stack.pop()!;
      comp.area++;
      comp.px.push(p);
      {
        const bx = p % w;
        const by = (p / w) | 0;
        if (bx < comp.x0) comp.x0 = bx;
        if (by < comp.y0) comp.y0 = by;
        if (bx > comp.x1) comp.x1 = bx;
        if (by > comp.y1) comp.y1 = by;
      }
      const o = p * 4;
      const g = frame.data[o + 1];
      if (g > 70 && g - Math.max(frame.data[o], frame.data[o + 2]) > 20) comp.greenish++;
      const px = p % w;
      const py = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (labels[n] < 0 && frame.data[n * 4 + 3] >= 32) {
          labels[n] = id;
          stack.push(n);
        }
      }
    }
  }
  const maxArea = Math.max(0, ...comps.map((c) => c.area));
  const main = comps.find((c) => c.area === maxArea);
  const out = Buffer.from(frame.data);
  // strict isolation mode: dilated mask of the main component's pixels;
  // any other component not touching it is neighbor-frame debris (detached
  // boots / sword pieces inside split rects), regardless of its size
  let mainMask: Uint8Array | null = null;
  if (isolatedPx > 0 && main) {
    mainMask = new Uint8Array(w * h);
    for (const p of main.px) mainMask[p] = 1;
    for (let it = 0; it < isolatedPx; it++) {
      const next = new Uint8Array(mainMask);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mainMask[y * w + x]) continue;
          if (
            (x > 0 && mainMask[y * w + x - 1]) ||
            (x < w - 1 && mainMask[y * w + x + 1]) ||
            (y > 0 && mainMask[(y - 1) * w + x]) ||
            (y < h - 1 && mainMask[(y + 1) * w + x])
          ) {
            next[y * w + x] = 1;
          }
        }
      }
      mainMask = next;
    }
  }
  for (const c of comps) {
    if (c.area === maxArea) continue;
    const mostlyGreen = c.greenish / c.area > 0.35;
    // neighbor-frame bleed (ghost fragments): small relative to the body AND
    // not overlapping the body bbox (slash trails overlap; own weapons are
    // connected through the hand and never appear here)
    const OV = 8;
    const overlapsMain =
      main != null && c.x0 <= main.x1 + OV && c.x1 >= main.x0 - OV && c.y0 <= main.y1 + OV && c.y1 >= main.y0 - OV;
    const ghost = c.area < maxArea * 0.06 && !overlapsMain;
    let isolated = false;
    if (mainMask && c.area < maxArea * 0.5) {
      isolated = !c.px.some((p) => mainMask![p] === 1);
    }
    if (c.area < minKeepArea || ghost || isolated || (mostlyGreen && c.area < 2500)) {
      for (const p of c.px) out[p * 4 + 3] = 0;
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * Sheet green content region = span from the first to the last green-dominant
 * row/column. Span (not longest-run) so that thin separator lines and label
 * bands inside the sheet don't truncate the region; solid header/footer bars
 * (0% green) stay excluded.
 */
export function findGreenRegion(img: RawImage, tolerance: number): Rect {
  const rowGreen: number[] = new Array(img.height).fill(0);
  for (let y = 0; y < img.height; y++) {
    let n = 0;
    for (let x = 0; x < img.width; x += 2) if (isGreen(img, x, y, tolerance)) n++;
    rowGreen[y] = n / Math.ceil(img.width / 2);
  }
  const [y0, y1] = spanOf(rowGreen, 0.25);
  const colGreen: number[] = new Array(img.width).fill(0);
  for (let x = 0; x < img.width; x++) {
    let n = 0;
    for (let y = y0; y <= y1; y += 2) if (isGreen(img, x, y, tolerance)) n++;
    colGreen[x] = n / Math.max(1, Math.ceil((y1 - y0 + 1) / 2));
  }
  const [x0, x1] = spanOf(colGreen, 0.25);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function spanOf(values: number[], threshold: number): [number, number] {
  let first = -1;
  let last = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i] >= threshold) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return [0, values.length - 1];
  return [first, last];
}

export interface Segment extends Rect {
  band: number;
  index: number;
}

/**
 * Projection-profile segmentation of non-green content inside a region.
 * 1. Split region into horizontal bands separated by fully-green row gaps.
 * 2. Split each band into column segments separated by >= gapCols green columns.
 * 3. Shrink-wrap each segment to its non-green content.
 */
export function segmentGreenSheet(
  img: RawImage,
  region: Rect,
  opts: {
    tolerance: number;
    gapRows?: number;
    gapCols?: number;
    minW?: number;
    minH?: number;
    maxSegW?: number;
    /** explicit normalized [y0, y1] ranges (of full image height) overriding auto bands */
    bandsY?: Array<[number, number]>;
    /** split over-wide runs into exactly n equal cells (identical touching tiles) */
    splitEven?: number;
  },
): Segment[] {
  const tol = opts.tolerance;
  const gapRows = opts.gapRows ?? 6;
  const gapCols = opts.gapCols ?? 6;
  const minW = opts.minW ?? 24;
  const minH = opts.minH ?? 24;
  const maxSegW = opts.maxSegW ?? Infinity;

  let bands: Array<{ y0: number; y1: number }>;
  if (opts.bandsY) {
    bands = opts.bandsY.map(([a, b]) => ({
      y0: Math.round(a * img.height),
      y1: Math.round(b * img.height),
    }));
  } else {
    // Rows that contain any meaningful non-green content
    const rowHas: boolean[] = [];
    for (let y = region.y; y < region.y + region.h; y++) {
      let n = 0;
      for (let x = region.x; x < region.x + region.w; x++) {
        if (!isGreen(img, x, y, tol) && img.data[(y * img.width + x) * 4 + 3] > 32) n++;
      }
      rowHas.push(n > 2);
    }
    bands = runsOf(rowHas, gapRows).map(([a, b]) => ({ y0: region.y + a, y1: region.y + b }));
  }

  const segments: Segment[] = [];
  bands.forEach((band, bandIdx) => {
    const colHas: boolean[] = [];
    for (let x = region.x; x < region.x + region.w; x++) {
      let n = 0;
      for (let y = band.y0; y <= band.y1; y++) {
        if (!isGreen(img, x, y, tol) && img.data[(y * img.width + x) * 4 + 3] > 32) n++;
      }
      colHas.push(n > 1);
    }
    const cols = runsOf(colHas, gapCols);
    let segIdx = 0;
    for (const [a, b] of cols) {
      const rough: Rect = { x: region.x + a, y: band.y0, w: b - a + 1, h: band.y1 - band.y0 + 1 };
      const pieces =
        opts.splitEven && opts.splitEven > 1 && rough.w > maxSegW
          ? splitEvenly(rough, opts.splitEven)
          : splitWide(img, rough, tol, maxSegW);
      for (const piece of pieces) {
        const tight = shrinkWrapGreen(img, piece, tol);
        if (!tight || tight.w < minW || tight.h < minH) continue;
        segments.push({ ...tight, band: bandIdx, index: segIdx++ });
      }
    }
  });
  return segments;
}

/**
 * Frames drawn with no fully-green gap between them merge into one wide
 * segment. When a segment exceeds maxSegW, split it recursively at the
 * weakest column (fewest non-green pixels) in its middle third.
 */
function splitEvenly(rect: Rect, n: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = rect.x + Math.round((rect.w * i) / n);
    const x1 = rect.x + Math.round((rect.w * (i + 1)) / n);
    out.push({ x: x0, y: rect.y, w: x1 - x0, h: rect.h });
  }
  return out;
}

function splitWide(img: RawImage, rect: Rect, tol: number, maxSegW: number): Rect[] {
  if (rect.w <= maxSegW) return [rect];
  let bestX = -1;
  let bestCount = Infinity;
  const from = rect.x + Math.floor(rect.w * 0.33);
  const to = rect.x + Math.ceil(rect.w * 0.67);
  for (let x = from; x <= to; x++) {
    let n = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      if (!isGreen(img, x, y, tol) && img.data[(y * img.width + x) * 4 + 3] > 32) n++;
    }
    if (n < bestCount) {
      bestCount = n;
      bestX = x;
    }
  }
  if (bestX < 0) return [rect];
  const left: Rect = { x: rect.x, y: rect.y, w: bestX - rect.x, h: rect.h };
  const right: Rect = { x: bestX + 1, y: rect.y, w: rect.x + rect.w - bestX - 1, h: rect.h };
  return [...splitWide(img, left, tol, maxSegW), ...splitWide(img, right, tol, maxSegW)];
}

function runsOf(flags: boolean[], maxGap: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i <= flags.length; i++) {
    const on = i < flags.length && flags[i];
    if (on) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap++;
      if (gap >= maxGap || i === flags.length) {
        runs.push([start, i - gap]);
        start = -1;
        gap = 0;
      }
    }
  }
  return runs;
}

/** Tight bbox of non-green, non-transparent pixels inside rect. */
export function shrinkWrapGreen(img: RawImage, rect: Rect, tolerance: number): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const a = img.data[(y * img.width + x) * 4 + 3];
      if (a > 32 && !isGreen(img, x, y, tolerance)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Tight bbox of non-transparent pixels inside rect (for alpha sheets). */
export function shrinkWrapAlpha(img: RawImage, rect: Rect, minAlpha = 24): Rect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Segment an alpha sheet into content blobs via projection profiles on alpha. */
export function segmentAlphaSheet(
  img: RawImage,
  opts: {
    gapRows?: number;
    gapCols?: number;
    minW?: number;
    minH?: number;
    minAlpha?: number;
    maxSegW?: number;
    /** explicit normalized [y0, y1] row ranges — for sheets whose poses cross grid cells */
    bandsY?: Array<[number, number]>;
  },
): Segment[] {
  const gapRows = opts.gapRows ?? 8;
  const gapCols = opts.gapCols ?? 8;
  const minW = opts.minW ?? 20;
  const minH = opts.minH ?? 20;
  const minAlpha = opts.minAlpha ?? 24;

  let bands: Array<[number, number]>;
  if (opts.bandsY) {
    bands = opts.bandsY.map(([a, b]) => [Math.round(a * img.height), Math.round(b * img.height)]);
  } else {
    const rowHas: boolean[] = [];
    for (let y = 0; y < img.height; y++) {
      let n = 0;
      for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) n++;
      rowHas.push(n > 2);
    }
    bands = runsOf(rowHas, gapRows);
  }
  const segments: Segment[] = [];
  bands.forEach(([ya, yb], bandIdx) => {
    const colHas: boolean[] = [];
    for (let x = 0; x < img.width; x++) {
      let n = 0;
      for (let y = ya; y <= yb; y++) if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) n++;
      colHas.push(n > 1);
    }
    let segIdx = 0;
    const maxSegW = opts.maxSegW ?? Infinity;
    for (const [a, b] of runsOf(colHas, gapCols)) {
      const rough: Rect = { x: a, y: ya, w: b - a + 1, h: yb - ya + 1 };
      for (const piece of splitWideAlpha(img, rough, minAlpha, maxSegW)) {
        const tight = shrinkWrapAlpha(img, piece, minAlpha);
        if (!tight || tight.w < minW || tight.h < minH) continue;
        segments.push({ ...tight, band: bandIdx, index: segIdx++ });
      }
    }
  });
  return segments;
}

/** alpha twin of splitWide: recursively split over-wide runs at the weakest alpha column */
function splitWideAlpha(img: RawImage, rect: Rect, minAlpha: number, maxSegW: number): Rect[] {
  if (rect.w <= maxSegW) return [rect];
  let bestX = -1;
  let bestCount = Infinity;
  const from = rect.x + Math.floor(rect.w * 0.33);
  const to = rect.x + Math.ceil(rect.w * 0.67);
  for (let x = from; x <= to; x++) {
    let n = 0;
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) n++;
    }
    if (n < bestCount) {
      bestCount = n;
      bestX = x;
    }
  }
  if (bestX < 0) return [rect];
  const left: Rect = { x: rect.x, y: rect.y, w: bestX - rect.x, h: rect.h };
  const right: Rect = { x: bestX, y: rect.y, w: rect.x + rect.w - bestX, h: rect.h };
  return [...splitWideAlpha(img, left, minAlpha, maxSegW), ...splitWideAlpha(img, right, minAlpha, maxSegW)];
}

/**
 * Some production sheets draw thin near-black separator lines across the full
 * width between animation rows. Those rows read as "content" and merge bands.
 * Returns a copy where any row that is >50% dark pixels is repainted pure
 * chroma green, so segmentation and dechroma both treat it as background.
 */
export function eraseDarkLineRows(img: RawImage): RawImage {
  const out: RawImage = { data: Buffer.from(img.data), width: img.width, height: img.height };
  for (let y = 0; y < img.height; y++) {
    let lineish = 0;
    for (let x = 0; x < img.width; x += 2) {
      const o = (y * img.width + x) * 4;
      if (out.data[o + 3] <= 32) continue;
      const r = out.data[o];
      const g = out.data[o + 1];
      const b = out.data[o + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const bright = Math.max(r, g, b);
      // separator lines are desaturated: near-black (Raider) or near-white (Guardian)
      if (sat < 60 && (bright < 70 || bright > 185)) lineish++;
    }
    if (lineish / Math.ceil(img.width / 2) > 0.5) {
      for (let x = 0; x < img.width; x++) {
        const o = (y * img.width + x) * 4;
        out.data[o] = 0;
        out.data[o + 1] = 255;
        out.data[o + 2] = 0;
        out.data[o + 3] = 255;
      }
    }
  }
  return out;
}

/**
 * Drop small floating content (frame-number digits, caption text) hovering
 * above the main subject of a green-sheet segment: if the rows above a clear
 * green gap hold under `maxFrac` of the segment height, cut below the gap.
 */
export function trimFloatingTop(img: RawImage, rect: Rect, tol: number, maxFrac = 0.3): Rect {
  const coverage: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    let n = 0;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!isGreen(img, x, y, tol) && img.data[(y * img.width + x) * 4 + 3] > 32) n++;
    }
    coverage.push(n);
  }
  // find the first gap (>=4 empty rows) below some top content
  let sawContent = false;
  let gapStart = -1;
  for (let i = 0; i < coverage.length; i++) {
    if (coverage[i] > 0) {
      if (gapStart >= 0 && i - gapStart >= 4 && gapStart <= rect.h * maxFrac && sawContent) {
        const shrunk = shrinkWrapGreen(img, { x: rect.x, y: rect.y + i, w: rect.w, h: rect.h - i }, tol);
        return shrunk ?? rect;
      }
      sawContent = true;
      gapStart = -1;
    } else if (sawContent && gapStart < 0) {
      gapStart = i;
    }
  }
  return rect;
}

/**
 * Buttons on the UI sheets have a caption plate hanging below the circular
 * button, separated by a low-alpha gap. Cut at the last near-empty row band
 * found below 55% of the height.
 */
export function detachBottomPlate(img: RawImage, rect: Rect, minAlpha = 24): Rect {
  const cov: number[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    let n = 0;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) n++;
    }
    cov.push(n / rect.w);
  }
  for (let i = Math.floor(rect.h * 0.55); i < rect.h - 4; i++) {
    if (cov[i] < 0.07 && cov[i + 1] < 0.07 && cov[i + 2] < 0.07) {
      const cut = { x: rect.x, y: rect.y, w: rect.w, h: i };
      return shrinkWrapAlpha(img, cut, minAlpha) ?? rect;
    }
  }
  return rect;
}

/**
 * Soft alpha fades on the edges of a cropped strip so rectangular painted
 * bands (mountains, ruins, haze) blend over the sky instead of showing hard
 * borders. Fractions are of the image height/width.
 */
export function fadeEdges(img: RawImage, topFrac = 0, sideFrac = 0): RawImage {
  const out = Buffer.from(img.data);
  const topRows = Math.round(img.height * topFrac);
  const sideCols = Math.round(img.width * sideFrac);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let f = 1;
      if (topRows > 0 && y < topRows) f = Math.min(f, y / topRows);
      if (sideCols > 0 && x < sideCols) f = Math.min(f, x / sideCols);
      if (sideCols > 0 && x >= img.width - sideCols) f = Math.min(f, (img.width - 1 - x) / sideCols);
      if (f < 1) {
        const o = (y * img.width + x) * 4 + 3;
        out[o] = Math.round(out[o] * f);
      }
    }
  }
  return { data: out, width: img.width, height: img.height };
}

/**
 * VFX sheets exported over faint white haze leave a visible box under ADD
 * blending. Kill low-alpha desaturated (grey/white) pixels, keep the bright
 * saturated cores and the high-alpha white centers.
 */
export function stripWhiteHaze(img: RawImage): RawImage {
  const out = Buffer.from(img.data);
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    const a = out[o + 3];
    if (a === 0) continue;
    const r = out[o], g = out[o + 1], b = out[o + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 36) {
      if (a < 160) out[o + 3] = 0;
      else if (a < 230 && Math.max(r, g, b) < 235) out[o + 3] = Math.round(a * 0.45);
    }
  }
  return { data: out, width: img.width, height: img.height };
}

export function crop(img: RawImage, rect: Rect): RawImage {
  const out = Buffer.alloc(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y++) {
    const srcOff = ((rect.y + y) * img.width + rect.x) * 4;
    img.data.copy(out, y * rect.w * 4, srcOff, srcOff + rect.w * 4);
  }
  return { data: out, width: rect.w, height: rect.h };
}

/**
 * High-quality Lanczos3 upscale. Low-resolution source sheets (307x512 batch)
 * are pre-upscaled here so runtime GPU bilinear sampling starts from a much
 * sharper base — this is the main anti-blur measure for character art.
 */
export async function upscaleImage(img: RawImage, factor: number): Promise<RawImage> {
  const { data, info } = await sharp(img.data, {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .resize(Math.max(1, Math.round(img.width * factor)), Math.max(1, Math.round(img.height * factor)), {
      kernel: sharp.kernel.lanczos3,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Exact-dimension Lanczos resample (used to keep packed cell boundaries exact). */
export async function resizeImageTo(img: RawImage, width: number, height: number): Promise<RawImage> {
  const { data, info } = await sharp(img.data, {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .resize(Math.max(1, width), Math.max(1, height), { kernel: sharp.kernel.lanczos3, fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export async function savePNG(img: RawImage, absPath: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .png()
    .toFile(absPath);
}

/**
 * Connected-component frame extraction for grid sheets whose art crosses
 * cell borders (sword tips etc.). Components are labeled over the whole
 * sheet and assigned to the grid cell containing their centroid; each
 * frame's rect is the union bbox of its components — so a blade extending
 * into an (empty) neighbor region is fully recovered instead of cut.
 */
export interface CellComponentResult {
  segments: Segment[];
  /** per-pixel component label (-1 = background/weak) */
  labels: Int32Array;
  /** component id -> owning cell key (row * cols + col), -1 = dropped */
  compCell: Int32Array;
  cols: number;
}

export function segmentsByCellComponents(
  img: RawImage,
  grid: { x: number; y: number; cols: number; rows: number; w: number; h: number },
  isContent: (o: number) => boolean,
  minArea = 160,
): CellComponentResult {
  const { width: w, height: h } = img;
  const labels = new Int32Array(w * h).fill(-1);
  interface Comp { area: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number }
  const comps: Comp[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (labels[i] >= 0 || !isContent(i * 4)) continue;
    const id = comps.length;
    const c: Comp = { area: 0, sx: 0, sy: 0, x0: w, y0: h, x1: 0, y1: 0 };
    comps.push(c);
    labels[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const px = p % w;
      const py = (p / w) | 0;
      c.area++;
      c.sx += px;
      c.sy += py;
      if (px < c.x0) c.x0 = px;
      if (py < c.y0) c.y0 = py;
      if (px > c.x1) c.x1 = px;
      if (py > c.y1) c.y1 = py;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (labels[n] < 0 && isContent(n * 4)) {
          labels[n] = id;
          stack.push(n);
        }
      }
    }
  }
  const cw = grid.w / grid.cols;
  const ch = grid.h / grid.rows;
  const byCell = new Map<number, Comp[]>();
  const compIndex = new Map<Comp, number>();
  comps.forEach((c, i) => compIndex.set(c, i));
  for (const c of comps) {
    if (c.area < minArea) continue;
    const cx = c.sx / c.area;
    const cy = c.sy / c.area;
    const col = Math.min(grid.cols - 1, Math.max(0, Math.floor((cx - grid.x) / cw)));
    const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((cy - grid.y) / ch)));
    const key = row * grid.cols + col;
    const list = byCell.get(key) ?? [];
    list.push(c);
    byCell.set(key, list);
  }
  const compCell = new Int32Array(comps.length).fill(-1);
  const out: Segment[] = [];
  for (const [key, list] of [...byCell.entries()].sort((a, c2) => a[0] - c2[0])) {
    // ghost-fragment guard: on grid-connected sheets every meaningful part
    // (weapon, limbs) is CONNECTED to the body through the hands, so any
    // disconnected satellite is neighbor-frame bleed — the source of the
    // "stray cutout / ghost frame" artifact. Keep only the main component
    // and satellites of substantial size (a deliberately detached element).
    const main = list.reduce((a2, b2) => (b2.area > a2.area ? b2 : a2));
    const kept = list.filter((c) => c === main || c.area >= main.area * 0.15);
    for (const c of kept) compCell[compIndex.get(c)!] = key;
    const b = kept.reduce(
      (acc, c) => ({
        x0: Math.min(acc.x0, c.x0),
        y0: Math.min(acc.y0, c.y0),
        x1: Math.max(acc.x1, c.x1),
        y1: Math.max(acc.y1, c.y1),
      }),
      { x0: main.x0, y0: main.y0, x1: main.x1, y1: main.y1 },
    );
    out.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, band: Math.floor(key / grid.cols), index: key % grid.cols });
  }
  return { segments: out, labels, compCell, cols: grid.cols };
}

/**
 * Masked crop for overlapping grid sheets: keeps ONLY pixels whose component
 * belongs to this frame's cell, plus unlabeled soft-edge pixels within
 * `feather` of an owned pixel. Neighbor-frame overlap inside the rect is
 * erased — this eliminates ghost fragments at the source.
 */
export function cropCellMasked(
  img: RawImage,
  seg: Segment,
  res: CellComponentResult,
  cellKey: number,
  feather = 8,
): RawImage {
  const out = crop(img, seg);
  const { width: w, height: h } = out;
  const owned = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gi = (seg.y + y) * img.width + (seg.x + x);
      const label = res.labels[gi]!;
      if (label >= 0 && res.compCell[label] === cellKey) owned[y * w + x] = 1;
    }
  }
  // dilate owned mask to keep anti-aliased fringe around owned pixels
  let mask = owned;
  for (let it = 0; it < feather; it++) {
    const next = new Uint8Array(mask);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x]) continue;
        if (
          (x > 0 && mask[y * w + x - 1]) ||
          (x < w - 1 && mask[y * w + x + 1]) ||
          (y > 0 && mask[(y - 1) * w + x]) ||
          (y < h - 1 && mask[(y + 1) * w + x])
        ) {
          next[y * w + x] = 1;
        }
      }
    }
    mask = next;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      const gi = (seg.y + y) * img.width + (seg.x + x);
      const label = res.labels[gi]!;
      // erase foreign components AND far unlabeled smudge
      out.data[i * 4 + 3] = 0;
      void label;
    }
  }
  return out;
}

/**
 * Remove semi-transparent dark painted glow (vignette auras some AI sheets
 * bake around characters) — reads as a dark rectangular smudge over bright
 * arenas. Fully opaque dark pixels (hair, armor) are untouched.
 */
/**
 * Keep only the largest connected component of strong-alpha pixels (plus a
 * feather halo so its soft glow rim survives), erasing everything else.
 *
 * The AI-generated control-button sheets place each button above a caption
 * plaque and let glows spill across cell borders, so a grid crop always
 * carries plaque slabs and neighbouring slivers. The button disc is the
 * largest solid component of its padded cell; everything else is junk.
 */
export function isolateLargestComponent(frame: RawImage, threshold = 150, feather = 8): RawImage {
  const { width: w, height: h } = frame;
  const labels = new Int32Array(w * h).fill(-1);
  let bestLabel = -1;
  let bestArea = 0;
  let nextLabel = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (labels[i]! >= 0 || frame.data[i * 4 + 3]! < threshold) continue;
    const id = nextLabel++;
    let area = 0;
    stack.push(i);
    labels[i] = id;
    while (stack.length) {
      const cur = stack.pop()!;
      area++;
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (labels[ni]! >= 0 || frame.data[ni * 4 + 3]! < threshold) continue;
          labels[ni] = id;
          stack.push(ni);
        }
      }
    }
    if (area > bestArea) {
      bestArea = area;
      bestLabel = id;
    }
  }
  if (bestLabel < 0) return frame;
  let mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (labels[i] === bestLabel) mask[i] = 1;
  for (let it = 0; it < feather; it++) {
    const grown = mask.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (mask[i]!) continue;
        if ((x > 0 && mask[i - 1]!) || (x < w - 1 && mask[i + 1]!) || (y > 0 && mask[i - w]!) || (y < h - 1 && mask[i + w]!)) {
          grown[i] = 1;
        }
      }
    }
    mask = grown;
  }
  const out: RawImage = { data: Buffer.from(frame.data), width: w, height: h };
  for (let i = 0; i < w * h; i++) if (!mask[i]!) out.data[i * 4 + 3] = 0;
  return out;
}

/**
 * Cut away a caption plaque fused to the bottom of a button disc.
 *
 * The disc is round, so its strong-alpha row coverage tapers toward the
 * bottom; the plaque below widens again. The cut goes through the narrowest
 * row (the waist) in the lower part of the frame — but only when coverage
 * genuinely rises again further down, so a plain disc with no plaque is
 * never truncated.
 */
export function cutBelowWaist(frame: RawImage, threshold = 150): RawImage {
  const { width: w, height: h } = frame;
  if (h < 24) return frame;
  const profile: number[] = [];
  let maxCov = 0;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (frame.data[(y * w + x) * 4 + 3]! >= threshold) n++;
    const cov = n / w;
    profile.push(cov);
    if (cov > maxCov) maxCov = cov;
  }
  if (maxCov <= 0) return frame;
  let cut = -1;
  let cutCov = Infinity;
  for (let y = Math.floor(h * 0.55); y < h - 2; y++) {
    const cov = profile[y]!;
    if (cov >= maxCov * 0.5 || cov >= cutCov) continue;
    // a plaque must actually exist below this row
    let rises = false;
    for (let y2 = y + 2; y2 < h; y2++) {
      if (profile[y2]! >= cov + 0.12) {
        rises = true;
        break;
      }
    }
    if (rises) {
      cut = y;
      cutCov = cov;
    }
  }
  if (cut < 0) return frame;
  const out: RawImage = { data: Buffer.from(frame.data), width: w, height: h };
  for (let y = cut; y < h; y++) {
    for (let x = 0; x < w; x++) out.data[(y * w + x) * 4 + 3] = 0;
  }
  return out;
}

export function stripDarkHaze(img: RawImage, maxAlpha = 170, maxLum = 100): RawImage {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3]!;
    if (a === 0 || a >= maxAlpha) continue;
    const lum = 0.299 * out[i]! + 0.587 * out[i + 1]! + 0.114 * out[i + 2]!;
    if (lum < maxLum) out[i + 3] = 0;
  }
  return { data: out, width: img.width, height: img.height };
}

/**
 * Defringe: shave the low-alpha halo band (white/black matte remnants from
 * AI generation) and re-expand the remaining alpha ramp, preserving the
 * anti-aliased edge core.
 */
export function alphaShave(img: RawImage, threshold = 36): RawImage {
  const out = Buffer.from(img.data);
  const k = 255 / (255 - threshold);
  for (let i = 3; i < out.length; i += 4) {
    const a = out[i]!;
    if (a === 0) continue;
    out[i] = a <= threshold ? 0 : Math.min(255, Math.round((a - threshold) * k));
  }
  return { data: out, width: img.width, height: img.height };
}

/** Mirror an image horizontally (fixes AI frames drawn facing the wrong way). */
export function flipHorizontal(img: RawImage): RawImage {
  const out: RawImage = { data: Buffer.alloc(img.data.length), width: img.width, height: img.height };
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const src = (y * img.width + x) * 4;
      const dst = (y * img.width + (img.width - 1 - x)) * 4;
      img.data.copy(out.data, dst, src, src + 4);
    }
  }
  return out;
}

/** Sheets must stay under conservative GPU texture limits (mobile-safe). */
export const MAX_SHEET_DIM = 2048;

/**
 * Pack frames into a row-major grid with uniform cells, keeping the sheet
 * within MAX_SHEET_DIM (oversized single-row strips exceed common GPU
 * texture limits and stall or blur on real hardware). Frames are aligned
 * bottom-center (feet baseline = cell bottom). Phaser's spritesheet loader
 * reads grids row-major, so frame indices are unchanged.
 */
/**
 * Horizontal anchor of a fighter frame = alpha-weighted centroid X of the
 * BOTTOM band of its content (the feet / ground contact). Aligning cells on
 * this instead of the bbox center keeps the body planted when a long sword
 * extends to one side — otherwise the weapon appears to drift between
 * frames and states as the bbox center swings around.
 */
function footAnchorX(f: RawImage): number {
  const bandTop = Math.max(0, Math.floor(f.height * 0.8));
  let sum = 0;
  let weight = 0;
  for (let y = bandTop; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      const a = f.data[(y * f.width + x) * 4 + 3]!;
      if (a > 64) {
        sum += x * a;
        weight += a;
      }
    }
  }
  return weight > 0 ? sum / weight : f.width / 2;
}

export function packStrip(
  frames: RawImage[],
  pad = 2,
  anchorFeet = false,
): { sheet: RawImage; cellW: number; cellH: number; cols: number; rows: number } {
  // with foot anchoring, the cell must fit the widest left/right extent
  // around each frame's anchor so every anchor lands exactly at cellW/2
  const anchors = anchorFeet ? frames.map((f) => footAnchorX(f)) : frames.map((f) => f.width / 2);
  const maxLeft = Math.max(...frames.map((f, i) => anchors[i]!));
  const maxRight = Math.max(...frames.map((f, i) => f.width - anchors[i]!));
  const cellW = Math.ceil(Math.max(maxLeft, maxRight) * 2) + pad * 2;
  const cellH = Math.max(...frames.map((f) => f.height)) + pad * 2;
  // choose the widest grid that fits MAX_SHEET_DIM in BOTH dimensions; if
  // impossible, fall back to the packing that minimizes the larger dimension
  let cols = Math.max(1, Math.min(frames.length, Math.floor(MAX_SHEET_DIM / cellW)));
  let rows = Math.ceil(frames.length / cols);
  if (rows * cellH > MAX_SHEET_DIM) {
    let best = { cols, rows, maxDim: Math.max(cols * cellW, rows * cellH) };
    for (let c = 1; c <= frames.length; c++) {
      const r = Math.ceil(frames.length / c);
      const maxDim = Math.max(c * cellW, r * cellH);
      if (maxDim < best.maxDim) best = { cols: c, rows: r, maxDim };
    }
    cols = best.cols;
    rows = best.rows;
  }
  const sheet: RawImage = {
    data: Buffer.alloc(cellW * cols * cellH * rows * 4),
    width: cellW * cols,
    height: cellH * rows,
  };
  frames.forEach((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // place so the frame's anchor sits at the cell's horizontal center
    const ox = col * cellW + Math.max(0, Math.round(cellW / 2 - anchors[i]!));
    const oy = row * cellH + (cellH - pad - f.height); // bottom aligned within the cell
    for (let y = 0; y < f.height; y++) {
      const srcOff = y * f.width * 4;
      const dstOff = ((oy + y) * sheet.width + Math.min(ox, cellW * (col + 1) - f.width)) * 4;
      f.data.copy(sheet.data, dstOff, srcOff, srcOff + f.width * 4);
    }
  });
  return { sheet, cellW, cellH, cols, rows };
}
