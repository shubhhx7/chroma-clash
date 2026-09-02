/** Pure damage math — unit tested, no Phaser dependencies. */

/** Clamp health into [0, max]. */
export function clampHealth(health: number, maxHealth: number): number {
  if (Number.isNaN(health)) return 0;
  return Math.min(maxHealth, Math.max(0, health));
}

/** Apply damage; returns the new health, never below 0. */
export function applyDamage(currentHealth: number, damage: number, maxHealth: number): number {
  const dmg = Math.max(0, damage);
  return clampHealth(currentHealth - dmg, maxHealth);
}

/**
 * One-hit-per-swing rule (unit tested): a target may be hit at most once per
 * attack instance. Returns true when this hit should register.
 */
export function shouldRegisterHit(
  canHitOncePerTarget: boolean,
  hitTargets: ReadonlySet<string>,
  targetId: string,
): boolean {
  if (!canHitOncePerTarget) return true;
  return !hitTargets.has(targetId);
}
