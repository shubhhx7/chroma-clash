/**
 * Block/parry rules. Phase 1 ships the pure damage-mitigation math (unit
 * testable); the BLOCK fighter state and perfect-block window are wired in
 * Phase 2 together with Kairo's block sheets.
 */

export interface BlockResult {
  damage: number;
  wasPerfect: boolean;
}

export const BLOCK_DAMAGE_MULTIPLIER = 0.25;
export const PERFECT_BLOCK_WINDOW_MS = 140;

/** Guard break: this many blocked hits inside the window staggers the blocker. */
export const GUARD_BREAK_HITS = 3;
export const GUARD_BREAK_WINDOW_MS = 2500;

export function resolveBlockedDamage(
  rawDamage: number,
  blockHeldMs: number,
  windowMs: number = PERFECT_BLOCK_WINDOW_MS,
): BlockResult {
  if (blockHeldMs <= windowMs) {
    return { damage: 0, wasPerfect: true };
  }
  return { damage: Math.round(rawDamage * BLOCK_DAMAGE_MULTIPLIER), wasPerfect: false };
}

/** Pure guard-break check over a rolling list of blocked-hit timestamps. */
export function isGuardBroken(blockedHitTimes: readonly number[], now: number): boolean {
  return blockedHitTimes.filter((t) => now - t <= GUARD_BREAK_WINDOW_MS).length >= GUARD_BREAK_HITS;
}
