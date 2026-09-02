# Chroma Clash — Implementation Audit (pre-completion milestone)

## Architecture discovered

| Area | Implementation |
|---|---|
| Framework | Phaser 3.90 + TypeScript strict + Vite; Arcade physics configured, fighters kinematic |
| Rendering | Manual DPR shell (`ResponsiveGameShell`): drawing buffer = CSS × min(DPR, 2), `Scale.NONE` + `NO_CENTER` (CENTER_BOTH shoved the canvas off-screen after rotation — fixed in the previous milestone), `roundPixels`, antialias on |
| Scenes | Boot → Preload → Menu → Battle (+ stubs: Splash, WeaponSelect, Upgrade, Result; dev AssetGallery) |
| World | 720-unit logical height, adaptive width (960–1600 layout clamp), world camera + separate CSS-px UI camera |
| Sprites | Offline pipeline (`tools/`): chroma-key removal, segmentation, per-animation packed strips + JSON metadata; runtime loads spritesheets from generated data |
| Animation | `AnimationController` per fighter; per-animation display scales hand-tuned in `fighterConfigs.ts` |
| Input | `InputRouter` merging `KeyboardInput` + `TouchInput` (Phaser pointer events); 220 ms press buffer in `Fighter` |
| Combat | Data-driven `AttackDefinition` (frame-timed hitboxes, chains, lunges, energy); `CombatSystem` with block/parry resolution; one-hit-per-swing |
| AI | `EnemyAI` FSM (approach/spacing/wait/attack/block/dodge/whiff-punish), seeded deterministic |
| Result | KO overlay art + monospace stats text — flagged for redesign |
| Audio | `AudioManager` stub, hook points wired, no output |
| Tests | 46 Vitest unit + 9 Playwright e2e; asset manifest validation tooling |

## Root causes found for the reported defects

1. **Characters change size / sharpness between animations.** Frames are trimmed to
   their content bounding box per animation and packed per-sheet; the source sheets
   are drawn at *different* character scales (idle sheet ~169 px standing, walk batch
   ~131 px, big-batch sheets 299–406 px). The game compensated with hand-tuned
   per-animation display scales (0.81–1.225), so (a) small tuning errors read as size
   jumps, and (b) texel density differs per animation, so sharpness visibly changes
   (big sheets crisp, small sheets soft). **Fix:** bake a canonical character height
   into the textures at pipeline time (per-sheet Lanczos resample to a shared
   standing height), then render every animation at one uniform scale.
2. **KO screen.** The sliced `overlay_ko` raster is shown at up to 50% of the screen
   width and stays up permanently with a plain text block. **Fix:** short KO stinger
   (≤ 35% width, ~700 ms) + code-driven result panel (vector panel + text, typed
   `FightResult`, buttons).
3. **"Button does nothing".** Traced: the crystal SPECIAL button emits
   `InputAction.SPECIAL` → `handleGroundIntents` → `canUseSpecial()` gate — with an
   empty meter the press is silently discarded (no feedback), reading as broken.
   KICK exists only as the combo finisher with no direct binding. **Fix:** denied-press
   feedback (meter flash + buzz), keep the ready/disabled art states, add a direct
   KICK binding, and add automated end-to-end action tests.
4. **Single passive enemy.** Only the Raider is wired. Guardian/Vael combat sheets
   (same labeled-row layout) were classified planned-runtime. **Fix:** process + config
   both, add run progression, boss phase for Vael.
5. **No upgrades / weapons / audio.** Scenes are stubs; `Assets/audio/` is empty.
   **Fix:** real WeaponSelect + Upgrade scenes, `RunState`, WebAudio-synthesized
   original SFX/music (no external files), voice event system with manifest.

## Constraints honoured

- Raw assets under `Assets/` remain read-only (validated by `assets:validate`).
- No second rendering engine; no framework change; incremental refactors only.
- Contact sheets / reference boards are never loaded at runtime (enforced by the
  asset manifest classifications).
