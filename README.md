# Chroma Clash

Premium 2D browser action fighter — Phaser 3 + TypeScript + Vite.
**Complete vertical slice:** Menu → Weapon Select → Raider → Upgrade → Guardian → Upgrade → **Vael** (two-phase boss) → Run Complete.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` (http://localhost:5173) |
| Asset audit | `npm run assets:audit` |
| Asset processing (chroma key + slicing + canonical-height baking) | `npm run assets:process` (`-- --scan` dry-run, `-- --only <id,...>`) |
| Combat audio generation (original DSP-rendered WAVs) | `npm run assets:audio` |
| Slice inspector | `npm run assets:slice -- <path>` |
| Frame normalization check | `npm run assets:normalize` |
| Build asset manifest (+ generated TS) | `npm run assets:manifest` |
| Validate asset usage | `npm run assets:validate` |
| Unit tests (Vitest, 81) | `npm run test` |
| Typecheck (strict) | `npm run typecheck` |
| Production build | `npm run build` → static `dist/` (deploy anywhere) |
| E2E tests (Playwright, 11: responsive + full run + mobile multitouch) | `npm run test:e2e` |

## Keyboard controls

| Key | Action |
|---|---|
| A/D or ←/→ | move |
| Space / W / ↑ | jump (air light attack with J) |
| J | light attack — chain J-J-J into the kick finisher |
| K | heavy attack |
| I | kick |
| E | dash attack (short cooldown) |
| S / ↓ (hold) | block — within 140 ms of the hit = **perfect parry** (no damage, counter, +25 meter) |
| L | Chroma Burst special (full meter) |
| Esc | pause + settings (volumes, shake, flashes, vibration) |
| Enter / M | result-panel primary / secondary action |
| R | restart fight · F3 debug HUD · F4 asset gallery (dev) |

## Touch controls (landscape)

Bottom-left: ◀ ▶ movement. Bottom-right thumb arc: **Attack** (large), **Heavy**,
**Jump**, **Block**, **Special** (crystal lights when the meter is full — pressing it
empty flashes the meter). Top-right: pause. Portrait shows the rotate gate; rotating
back never loses progress and clears any held input.

## The run

- **Raider** — fast duelist: two attacks, blocks, hop-back dodges, punishes whiffs.
- **Guardian** — heavy wall: telegraphed hammer smashes, frequent guard;
  break his guard with 3 hits in 2.5 s (heavies crush harder with Impact Drive).
- **Vael** — final boss: slash chains, heavy, block/dodge, **Violet Rift Slash**;
  at 50 % health he pauses, flares violet and fights enraged.
- Between fights: pick 1 of 3 upgrades (10-item configurable pool). Health and
  meter carry across fights; upgrades reset on a new run.
- Weapons: Chroma Blade playable; Battle Axe / Dual Blades have full stat
  profiles + selection UI but present locked until their animation sets exist.

## Audio

51 original WAV files rendered in-repo by `tools/generate-combat-audio.ts`:
sword whooshes, metal blocks/parries, weighted impacts, hammer ground-shakes
and formant-synth vocal grunts per character — played through
master/music/combat_sfx/voice/ui buses with pitch/gain variation, polyphony
caps, per-character voice cooldowns, once-per-fight defeat voices and music
ducking under heavy hits. Procedural music beds per fight. Docs:
[AUDIO_MANIFEST](docs/AUDIO_MANIFEST.md), [AUDIO_LICENSES](docs/AUDIO_LICENSES.md).

## Asset rules

- Raw art in `Assets/` is **read-only**; all runtime art is generated into
  `assets_processed/` (`assets.config.json` drives slicing).
- Fighter sheets are baked to one canonical standing height (380 px) so every
  animation shares one scale and texel density — no size or sharpness jumps.
- Guardian, Vael and the Raider run on the HD sprite batches under
  `Assets/sprites/` (grid-sliced, chroma-keyed, per-sheet scale-calibrated);
  legacy strips are deactivated with a build-time assertion — only Vael
  heavy + Violet Rift remain from the old sheet (no HD counterparts; see
  docs/reports/missing-vael-hd-assets.md).
- Sheets are grid-packed under 2048 px (mobile GPU-safe).
- Every asset is tracked: `docs/ASSET_MANIFEST.md`, `docs/ASSET_USAGE_MATRIX.md`;
  `npm run assets:validate` fails on any untracked or modified file.
- Dev asset gallery: `http://localhost:5173/?debugAssets=1`.

## Structure

`src/app` shell/gate · `src/game/{scenes,entities,state,combat,ai,input,ui,vfx,audio,arena,responsive,data,config}` ·
`tools/` asset pipeline · `tests/unit` + `tests/e2e` ·
audit: [docs/IMPLEMENTATION_AUDIT.md](docs/IMPLEMENTATION_AUDIT.md)
