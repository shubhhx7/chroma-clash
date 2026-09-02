/**
 * Fighter state identifiers. The full V1 roster is declared now; Phase 1
 * implements IDLE, WALK, BASIC_ATTACK_1, HIT and DEFEAT (KNOCKDOWN doubles
 * as the defeat animation until GET_UP ships).
 */
export enum FighterStateId {
  IDLE = 'IDLE',
  WALK = 'WALK',
  RUN = 'RUN',
  JUMP = 'JUMP',
  LAND = 'LAND',
  BASIC_ATTACK_1 = 'BASIC_ATTACK_1',
  BASIC_ATTACK_2 = 'BASIC_ATTACK_2',
  SLASH_ATTACK = 'SLASH_ATTACK',
  HEAVY_ATTACK = 'HEAVY_ATTACK',
  KICK = 'KICK',
  BLOCK = 'BLOCK',
  PERFECT_BLOCK_COUNTER = 'PERFECT_BLOCK_COUNTER',
  HIT = 'HIT',
  KNOCKDOWN = 'KNOCKDOWN',
  GET_UP = 'GET_UP',
  BACKWARD_DODGE = 'BACKWARD_DODGE',
  SPECIAL = 'SPECIAL',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT',
}

/** State behaviour contract. States receive their owning fighter as context. */
export interface FighterStateHandler<TContext> {
  readonly id: FighterStateId;
  enter(ctx: TContext): void;
  update(ctx: TContext, dtMs: number): void;
  exit(ctx: TContext): void;
  /** which states may this state transition to (explicit transition table) */
  canTransitionTo(next: FighterStateId): boolean;
}

/**
 * Pure transition guard (unit tested): the canonical rules for which
 * transitions are legal regardless of the per-state allowlists.
 *
 * BASIC_ATTACK_1 acts as the single generic ATTACK state — the concrete
 * attack (light/heavy/dash/special and combo chains) is data selected by
 * the fighter's pending AttackDefinition.
 */
export function isTransitionAllowed(from: FighterStateId, to: FighterStateId): boolean {
  if (from === to) return false;
  if (from === FighterStateId.DEFEAT) return false; // terminal
  // HIT can only be left for IDLE (recover), HIT (re-stun) or DEFEAT (KO)
  if (from === FighterStateId.HIT) {
    return to === FighterStateId.IDLE || to === FighterStateId.HIT || to === FighterStateId.DEFEAT;
  }
  // attacks lock movement: no WALK out of an attack until it finishes (chains
  // swap the attack def inside the state). Being hit or KO'd always interrupts.
  if (from === FighterStateId.BASIC_ATTACK_1) {
    return to === FighterStateId.IDLE || to === FighterStateId.HIT || to === FighterStateId.DEFEAT;
  }
  // blocking can be broken by damage, released to idle, or convert to a parry counter
  if (from === FighterStateId.BLOCK) {
    return (
      to === FighterStateId.IDLE ||
      to === FighterStateId.HIT ||
      to === FighterStateId.DEFEAT ||
      to === FighterStateId.PERFECT_BLOCK_COUNTER
    );
  }
  if (from === FighterStateId.PERFECT_BLOCK_COUNTER) {
    return to === FighterStateId.IDLE || to === FighterStateId.HIT || to === FighterStateId.DEFEAT;
  }
  // dodge hop: runs to completion unless interrupted by damage
  if (from === FighterStateId.BACKWARD_DODGE) {
    return to === FighterStateId.IDLE || to === FighterStateId.HIT || to === FighterStateId.DEFEAT;
  }
  // airborne: land to idle, air attack, or get interrupted
  if (from === FighterStateId.JUMP) {
    return (
      to === FighterStateId.IDLE ||
      to === FighterStateId.BASIC_ATTACK_1 ||
      to === FighterStateId.HIT ||
      to === FighterStateId.DEFEAT
    );
  }
  return true;
}
