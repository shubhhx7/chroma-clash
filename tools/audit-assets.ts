/**
 * tools/audit-assets.ts
 *
 * Non-destructive workspace asset audit for Chroma Clash.
 *
 * - Walks the raw asset tree (Assets/) without modifying anything.
 * - Records exact filename, extension, path, byte size.
 * - Reads image dimensions, alpha channel presence.
 * - Samples pixels to detect chroma green (near #00FF00) and measures
 *   green coverage so we can distinguish green-screen production sheets
 *   from transparent / opaque reference collages.
 * - Emits:
 *     assets_processed/metadata/audit.json   (machine-readable)
 *     docs/ASSET_AUDIT_REPORT.md             (human-readable)
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'Assets');
const OUT_JSON = path.join(ROOT, 'assets_processed', 'metadata', 'audit.json');
const OUT_MD = path.join(ROOT, 'docs', 'ASSET_AUDIT_REPORT.md');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);
const OTHER_TRACKED_EXT = new Set(['.json', '.zip', '.md', '.mp3', '.ogg', '.wav', '.m4a']);

interface AuditRecord {
  id: string;
  fileName: string;
  extension: string;
  sourcePath: string; // relative, exact as found on disk
  bytes: number;
  width: number | null;
  height: number | null;
  channels: number | null;
  hasAlpha: boolean | null;
  /** fraction (0..1) of sampled pixels that are near-chroma-green */
  greenCoverage: number | null;
  isChromaGreen: boolean | null;
  /** fraction of sampled pixels that are fully/mostly transparent */
  transparentCoverage: number | null;
  error?: string;
}

function isNearChromaGreen(r: number, g: number, b: number): boolean {
  // Near #00FF00: strong green, weak red/blue. Tolerant of AI-render noise.
  return g > 180 && r < 120 && b < 120 && g - Math.max(r, b) > 90;
}

async function auditImage(absPath: string, rel: string, id: string): Promise<AuditRecord> {
  const stat = await fs.stat(absPath);
  const base: AuditRecord = {
    id,
    fileName: path.basename(absPath),
    extension: path.extname(absPath).toLowerCase(),
    sourcePath: rel,
    bytes: stat.size,
    width: null,
    height: null,
    channels: null,
    hasAlpha: null,
    greenCoverage: null,
    isChromaGreen: null,
    transparentCoverage: null,
  };
  try {
    const img = sharp(absPath);
    const meta = await img.metadata();
    base.width = meta.width ?? null;
    base.height = meta.height ?? null;
    base.channels = meta.channels ?? null;
    base.hasAlpha = meta.hasAlpha ?? null;

    // Downsample for pixel statistics — enough to measure coverage reliably.
    const SAMPLE = 256;
    const { data, info } = await sharp(absPath)
      .resize(SAMPLE, SAMPLE, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let green = 0;
    let transparent = 0;
    const total = info.width * info.height;
    for (let i = 0; i < total; i++) {
      const o = i * 4;
      const a = data[o + 3];
      if (a < 32) {
        transparent++;
        continue;
      }
      if (isNearChromaGreen(data[o], data[o + 1], data[o + 2])) green++;
    }
    base.greenCoverage = +(green / total).toFixed(4);
    base.transparentCoverage = +(transparent / total).toFixed(4);
    base.isChromaGreen = base.greenCoverage > 0.05;
  } catch (err) {
    base.error = String(err);
  }
  return base;
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function slugId(rel: string): string {
  return rel
    .replace(/\.[^.]+$/u, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

async function main(): Promise<void> {
  const files = await walk(ASSETS_DIR);
  const records: AuditRecord[] = [];
  const skipped: string[] = [];

  for (const abs of files) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const ext = path.extname(abs).toLowerCase();
    const id = slugId(path.relative(ASSETS_DIR, abs).split(path.sep).join('/'));
    if (IMAGE_EXT.has(ext)) {
      records.push(await auditImage(abs, rel, id));
      console.log(`audited ${rel}`);
    } else if (OTHER_TRACKED_EXT.has(ext)) {
      const stat = await fs.stat(abs);
      records.push({
        id,
        fileName: path.basename(abs),
        extension: ext,
        sourcePath: rel,
        bytes: stat.size,
        width: null,
        height: null,
        channels: null,
        hasAlpha: null,
        greenCoverage: null,
        isChromaGreen: null,
        transparentCoverage: null,
      });
    } else {
      skipped.push(rel);
    }
  }

  await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
  await fs.writeFile(
    OUT_JSON,
    JSON.stringify({ generatedAt: new Date().toISOString(), root: 'Assets/', records, skipped }, null, 2),
  );

  // ---- Markdown report ----
  const lines: string[] = [];
  lines.push('# Chroma Clash — Asset Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Total files found under \`Assets/\`: **${files.length}**`);
  lines.push(`Image files audited: **${records.filter((r) => IMAGE_EXT.has(r.extension)).length}**`);
  lines.push(`Non-image tracked files: **${records.filter((r) => !IMAGE_EXT.has(r.extension)).length}**`);
  lines.push(`Unrecognized files skipped: **${skipped.length}**`);
  lines.push('');
  const greens = records.filter((r) => r.isChromaGreen);
  const alphas = records.filter((r) => r.hasAlpha && (r.transparentCoverage ?? 0) > 0.01);
  lines.push(`Chroma-green (near #00FF00) sheets detected: **${greens.length}**`);
  lines.push(`Sheets with meaningful existing transparency: **${alphas.length}**`);
  lines.push('');
  lines.push('| # | Path | Size | WxH | Alpha | Green % | Transparent % | Notes |');
  lines.push('|---|------|------|-----|-------|---------|---------------|-------|');
  records.forEach((r, i) => {
    const notes: string[] = [];
    if (r.error) notes.push(`ERROR: ${r.error}`);
    if (r.isChromaGreen) notes.push('chroma-green');
    if (/\.png\.png$/u.test(r.fileName)) notes.push('double extension (preserved)');
    lines.push(
      `| ${i + 1} | \`${r.sourcePath}\` | ${(r.bytes / 1024).toFixed(0)} KB | ${r.width ?? '?'}x${r.height ?? '?'} | ${
        r.hasAlpha ? 'yes' : 'no'
      } | ${r.greenCoverage != null ? (r.greenCoverage * 100).toFixed(1) : '-'} | ${
        r.transparentCoverage != null ? (r.transparentCoverage * 100).toFixed(1) : '-'
      } | ${notes.join('; ')} |`,
    );
  });
  if (skipped.length) {
    lines.push('');
    lines.push('## Skipped (unrecognized extension)');
    for (const s of skipped) lines.push(`- \`${s}\``);
  }
  lines.push('');
  await fs.mkdir(path.dirname(OUT_MD), { recursive: true });
  await fs.writeFile(OUT_MD, lines.join('\n'));
  console.log(`\nWrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_MD)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
