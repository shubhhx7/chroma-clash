# HD Sprite Coverage Report

Generated during the HD integration milestone.

## Vael — expected HD sheets (per spec §3)

All ten expected Vael HD sheets are present in `Assets/sprites/vael/` and are
integrated: idle, walk_forward, run_chase, attack_01, attack_02, block, dodge,
hit_reaction, knockdown, defeat.

Layout divergences found on inspection (configured explicitly, not guessed):

| Sheet | Spec said | Actual | Handling |
|---|---|---|---|
| 29_vael_attack_02 | 8 frames | 8 cells, but the final frame contains only the spell explosion (no character) | last frame dropped → 7-frame animation |
| 34_vael_defeat | 6 frames (3×2) | 5 real frames + header text bar + one empty cell | header excluded via green-region clamp; 5-frame animation |
| 33_vael_knockdown | 7 frames | 7 ✓ | — |

## Vael legacy assets — fully retired

The legacy combat sheet depicted a DIFFERENT villain design and caused the
mixed-identity bug when the special played. It is now fully retired: the
Violet Rift special uses Vael's own HD rift-pillar animation (attack2) with
amplified damage and rift VFX. Every active Vael strip is HD-sourced; the
legacy allowlists were removed from the validator, preloader and tests.

## Guardian

All nine expected HD sheets present and integrated. Divergence: the idle sheet
contains 8 filled cells (spec table matched). The legacy sheet's `guard_hit`
row has no HD counterpart and its runtime strip was **removed** (it was never
played by any state; the block sheet covers guarding).

## Raider (bonus batch, fully integrated)

All ten sheets present. Divergence: `14_raider_knockdown` fills all 8 cells
(spec's "7 with one unused cell" doesn't apply); `15_raider_defeat` is 8 frames
(4×2), not 6.

## Kairo (status after the V3 fix pass)

HD movement batch active (idle, walk, walk-back, run, dash — dash now has its
dark painted glow stripped). The LIGHT attack now uses the sharp big-batch
counter-slash row (sheet 17, bottom row, 4 frames) and the HEAVY attack uses
sheet 11 (8 frames, recovered via connected-component grid extraction). Still
on the de-fringed classic sheets (no sharper source exists): attack2 (light
chain hit 2 — its baked slash trails mask the softness), block, hit,
knockdown/defeat, get-up. Superseded and preserved: 05_basic_attack_1.
