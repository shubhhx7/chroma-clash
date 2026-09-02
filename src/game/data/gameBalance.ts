/** Central tuning values for Phase 1 (Kairo vs Raider). */

export const BALANCE = {
  kairo: {
    maxHealth: 100,
    walkSpeed: 280,
    attack1Damage: 12,
    attack1HitStunMs: 350,
    attack1HitStopMs: 70,
    attack1KnockbackX: 110,
  },
  raider: {
    maxHealth: 72,
    attackDamage: 8,
    attackHitStunMs: 320,
    attackHitStopMs: 55,
    attackKnockbackX: 90,
    ai: {
      preferredRange: 215,
      approachSpeed: 190,
      reactionDelayMs: 380,
      attackCooldownMs: 1700,
      /** 0..1 chance per decision tick to hold position instead of attacking */
      aggression: 0.7,
      /** reserved for Phase 2 */
      blockChance: 0,
    },
  },
  score: {
    baseClear: 600,
    perfectBlockBonus: 150,
    maxComboBonus: 40,
    remainingHealthBonus: 4,
    difficultyBonusPerFight: 250,
    damageTakenPenaltyPerHp: 3,
    timeBonusMaxMs: 120_000,
    timeBonusPerSecondLeft: 5,
    /** consolation score for a defeat, scaled by damage dealt */
    defeatPerHitLanded: 10,
  },
  rankThresholds: { S: 2400, A: 1800, B: 1200 },
} as const;

/** Rank thresholds (C, B, A, S) — configured in BALANCE.rankThresholds. */
export function rankForScore(score: number): 'C' | 'B' | 'A' | 'S' {
  const t = BALANCE.rankThresholds;
  if (score >= t.S) return 'S';
  if (score >= t.A) return 'A';
  if (score >= t.B) return 'B';
  return 'C';
}

export interface ScoreInput {
  victory: boolean;
  completionTimeMs: number;
  damageTaken: number;
  perfectBlocks: number;
  maxCombo?: number;
  remainingHealth?: number;
  /** 0 = Raider, 1 = Guardian, 2 = Vael */
  fightIndex?: number;
  hitsLanded?: number;
  comboScoreMult?: number;
}

/** Pure score computation (unit tested). */
export function computeScore(input: ScoreInput): number {
  const s = BALANCE.score;
  if (!input.victory) {
    return Math.max(0, Math.round((input.hitsLanded ?? 0) * s.defeatPerHitLanded));
  }
  const timeLeft = Math.max(0, s.timeBonusMaxMs - input.completionTimeMs);
  const comboBonus = (input.maxCombo ?? 0) * s.maxComboBonus * (input.comboScoreMult ?? 1);
  return Math.max(
    0,
    Math.round(
      s.baseClear +
        (timeLeft / 1000) * s.timeBonusPerSecondLeft +
        (input.remainingHealth ?? 0) * s.remainingHealthBonus +
        input.perfectBlocks * s.perfectBlockBonus +
        comboBonus +
        (input.fightIndex ?? 0) * s.difficultyBonusPerFight -
        input.damageTaken * s.damageTakenPenaltyPerHp,
    ),
  );
}
