/** Enemy AI configuration (per-enemy data; consumed by ai/EnemyAI.ts). */
import { BALANCE } from './gameBalance';

export interface AttackChoice {
  id: string;
  weight: number;
}

export interface EnemyAIConfig {
  preferredRange: number;
  approachSpeed: number;
  reactionDelayMs: number;
  attackCooldownMs: number;
  /** chance per decision to attack when in range */
  aggression: number;
  /** chance to block when the player swings in range */
  blockChance: number;
  /** chance to hop back when the player swings in range */
  dodgeChance: number;
  /** chance to immediately punish a whiffed player attack */
  punishChance: number;
  /** weighted attack selection */
  attackChoices: AttackChoice[];
  /** attack id treated as the special (extra cooldown gate) */
  specialId?: string;
  specialCooldownMs?: number;
  /** deterministic seed for debuggable randomness */
  seed: number;
}

export const RAIDER_AI_CONFIG: EnemyAIConfig = {
  preferredRange: BALANCE.raider.ai.preferredRange,
  approachSpeed: BALANCE.raider.ai.approachSpeed,
  reactionDelayMs: BALANCE.raider.ai.reactionDelayMs,
  attackCooldownMs: BALANCE.raider.ai.attackCooldownMs,
  aggression: BALANCE.raider.ai.aggression,
  blockChance: 0.3,
  dodgeChance: 0.18,
  punishChance: 0.55,
  attackChoices: [
    { id: 'raider-attack-1', weight: 6 },
    { id: 'raider-attack-2', weight: 4 },
  ],
  seed: 0xc0ffee,
};

/** Heavy defensive wall: telegraphed smashes, lots of blocking, no dodging. */
export const GUARDIAN_AI_CONFIG: EnemyAIConfig = {
  preferredRange: 205,
  approachSpeed: 125,
  reactionDelayMs: 520,
  attackCooldownMs: 2400,
  aggression: 0.55,
  blockChance: 0.5,
  dodgeChance: 0.04,
  punishChance: 0.5,
  attackChoices: [
    { id: 'guardian-hammer', weight: 6 },
    { id: 'guardian-slam', weight: 4 },
  ],
  seed: 0xbad9e,
};

/** Final boss, phase 1. Phase 2 overrides below (applied at 50% health). */
export const VAEL_AI_CONFIG: EnemyAIConfig = {
  preferredRange: 235,
  approachSpeed: 225,
  reactionDelayMs: 340,
  attackCooldownMs: 1600,
  aggression: 0.7,
  blockChance: 0.28,
  dodgeChance: 0.22,
  punishChance: 0.65,
  attackChoices: [
    { id: 'vael-slash-1', weight: 5 },
    { id: 'vael-slash-2', weight: 5 },
    { id: 'vael-special', weight: 2 },
  ],
  specialId: 'vael-special',
  specialCooldownMs: 9000,
  seed: 0x5eed,
};

export const VAEL_PHASE2_OVERRIDES: Partial<EnemyAIConfig> = {
  reactionDelayMs: 240,
  attackCooldownMs: 1100,
  aggression: 0.88,
  dodgeChance: 0.32,
  punishChance: 0.8,
  specialCooldownMs: 5500,
};
