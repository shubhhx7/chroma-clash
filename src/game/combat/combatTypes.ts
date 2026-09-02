/** Shared combat data types. All values are data-driven from fighter configs. */

export interface RectDefinition {
  /** offset from the fighter's origin (feet center), +x = facing direction */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AttackDefinition {
  id: string;
  /** logical animation binding name on the fighter (attack, attack2, kick, ...) */
  animation: string;
  /** animation frame indices */
  startupFrames: number[];
  activeFrames: number[];
  recoveryFrames: number[];
  damage: number;
  hitStunMs: number;
  hitStopMs: number;
  knockbackX: number;
  knockbackY: number;
  /** hitbox per active frame index */
  hitboxByFrame: Record<number, RectDefinition>;
  canHitOncePerTarget: boolean;
  /** id of the attack this one chains into when light is pressed again */
  chainInto?: string;
  /** frames during which the chain input is accepted / executed */
  chainFrames?: number[];
  /** forward lunge applied on these frames (dash attack) */
  lungeSpeed?: number;
  lungeFrames?: number[];
  /** special meter gained on a clean hit */
  energyGain?: number;
  /** meter cost to start (special) */
  energyCost?: number;
  /** may be started while airborne */
  airOk?: boolean;
  /** minimum ms between uses (dash etc.) */
  cooldownMs?: number;
}

export interface HitEvent {
  attackerId: string;
  targetId: string;
  attack: AttackDefinition;
  /** effective damage dealt (after run modifiers) */
  damage: number;
  /** world-space contact point (for VFX) */
  contactX: number;
  contactY: number;
}

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectsOverlap(a: WorldRect, b: WorldRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Resolve a facing-relative RectDefinition to world space.
 * facing: 1 = right, -1 = left. Origin is the fighter's feet center.
 */
export function resolveRect(def: RectDefinition, originX: number, originY: number, facing: 1 | -1): WorldRect {
  const x = facing === 1 ? originX + def.x : originX - def.x - def.w;
  return { x, y: originY + def.y, w: def.w, h: def.h };
}
