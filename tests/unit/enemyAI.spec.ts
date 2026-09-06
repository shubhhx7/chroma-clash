import { describe, expect, it } from 'vitest';
import { AIState, EnemyAI } from '../../src/game/ai/EnemyAI';
import type { EnemyAIConfig } from '../../src/game/data/enemyConfigs';
import type { Fighter } from '../../src/game/entities/Fighter';

/** Minimal fighter double — the AI only reads these members. */
function mockFighter(over: Partial<Record<string, unknown>> = {}): Fighter {
  return {
    x: 0,
    isDefeated: false,
    isInHitStun: false,
    isBlocking: false,
    activeAttack: null,
    findAttack: (id: string) => ({ id }),
    ...over,
  } as unknown as Fighter;
}

const CFG: EnemyAIConfig = {
  preferredRange: 200,
  approachSpeed: 190,
  reactionDelayMs: 300,
  attackCooldownMs: 1500,
  aggression: 1, // deterministic: always attack when ready
  blockChance: 0,
  dodgeChance: 0,
  punishChance: 1,
  attackChoices: [{ id: 'raider-attack-1', weight: 1 }],
  seed: 42,
};

/** Run the AI for a duration, collecting every per-tick intent. */
function run(ai: EnemyAI, ms: number, step = 16): Array<ReturnType<EnemyAI['decide']>> {
  const intents: Array<ReturnType<EnemyAI['decide']>> = [];
  for (let t = 0; t < ms; t += step) intents.push(ai.decide(step));
  return intents;
}

describe('EnemyAI', () => {
  it('approaches when the player is far away', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 600 });
    const ai = new EnemyAI(self, target, CFG);
    ai.decide(16); // IDLE -> APPROACH
    const intent = ai.decide(16);
    expect(ai.state).toBe(AIState.APPROACH);
    expect(intent.moveX).toBe(1);
  });

  it('waits with intent inside preferred range, then attacks', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 180 });
    const ai = new EnemyAI(self, target, CFG);
    const attackTick = run(ai, 800).find((i) => i.attack); // > reactionDelay
    expect(attackTick).toBeDefined();
    expect(attackTick?.attackId).toBe('raider-attack-1');
  });

  it('backs off when the player crowds it', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 60 }); // well under 0.55 * range
    const ai = new EnemyAI(self, target, CFG);
    ai.decide(16); // IDLE -> SPACING
    const intent = ai.decide(16);
    expect(ai.state).toBe(AIState.SPACING);
    expect(intent.moveX).toBe(-1);
  });

  it('blocks when the player swings in range (blockChance = 1)', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 180, activeAttack: { id: 'kairo-light-1' } });
    const ai = new EnemyAI(self, target, { ...CFG, blockChance: 1 });
    const intent = ai.decide(16);
    expect(ai.state).toBe(AIState.BLOCK);
    expect(intent.block).toBe(true);
  });

  it('hops back when dodging (dodgeChance = 1)', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 180, activeAttack: { id: 'kairo-light-1' } });
    const ai = new EnemyAI(self, target, { ...CFG, blockChance: 0, dodgeChance: 1 });
    const intent = ai.decide(16);
    expect(ai.state).toBe(AIState.DODGE);
    expect(intent.moveX).toBe(-1);
  });

  it('does nothing while stunned or defeated', () => {
    const stunned = new EnemyAI(mockFighter({ isInHitStun: true }), mockFighter({ x: 100 }), CFG);
    expect(stunned.decide(16)).toMatchObject({ moveX: 0, attack: false });
    expect(stunned.state).toBe(AIState.HIT);

    const dead = new EnemyAI(mockFighter({ isDefeated: true }), mockFighter({ x: 100 }), CFG);
    expect(dead.decide(16)).toMatchObject({ moveX: 0, attack: false });
    expect(dead.state).toBe(AIState.DEFEAT);
  });

  it('returns to combat decisions after hit-stun ends', () => {
    const self = mockFighter({ isInHitStun: true });
    const target = mockFighter({ x: 180 });
    const ai = new EnemyAI(self, target, CFG);

    ai.decide(16);
    expect(ai.state).toBe(AIState.HIT);

    (self as unknown as { isInHitStun: boolean }).isInHitStun = false;
    ai.decide(16);
    expect(ai.state).toBe(AIState.IDLE);
    expect(run(ai, 800).some((intent) => intent.attack)).toBe(true);
  });

  it('respects the attack cooldown', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 180 });
    const ai = new EnemyAI(self, target, CFG);
    expect(run(ai, 800).some((i) => i.attack)).toBe(true);
    // immediately after attacking, WAIT resumes but the cooldown forbids a new attack
    expect(run(ai, 500).some((i) => i.attack)).toBe(false);
  });

  it('picks attack 2 when configured', () => {
    const self = mockFighter({ x: 0 });
    const target = mockFighter({ x: 180 });
    const ai = new EnemyAI(self, target, { ...CFG, attackChoices: [{ id: 'raider-attack-2', weight: 1 }] });
    const attackTick = run(ai, 800).find((i) => i.attack);
    expect(attackTick).toBeDefined();
    expect(attackTick?.attackId).toBe('raider-attack-2');
  });
});
