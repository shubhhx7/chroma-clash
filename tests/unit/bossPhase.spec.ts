import { describe, expect, it } from 'vitest';
import { AIState, EnemyAI } from '../../src/game/ai/EnemyAI';
import { VaelAI } from '../../src/game/ai/VaelAI';
import { isGuardBroken, GUARD_BREAK_HITS, GUARD_BREAK_WINDOW_MS } from '../../src/game/combat/BlockSystem';
import type { Fighter } from '../../src/game/entities/Fighter';

function mockFighter(over: Partial<Record<string, unknown>> = {}): Fighter {
  return {
    x: 0,
    health: 150,
    config: { maxHealth: 150 },
    isDefeated: false,
    isInHitStun: false,
    isBlocking: false,
    activeAttack: null,
    findAttack: (id: string) => ({ id }),
    ...over,
  } as unknown as Fighter;
}

describe('Vael boss phases', () => {
  it('stays in phase 1 above half health', () => {
    const self = mockFighter({ health: 100 });
    const ai = new VaelAI(self, mockFighter({ x: 300 }));
    ai.decide(16);
    expect(ai.phase).toBe(1);
  });

  it('enters PHASE_CHANGE exactly once at 50% health and fires the hook', () => {
    const self = mockFighter({ health: 75 }); // exactly 50%
    const ai = new VaelAI(self, mockFighter({ x: 300 }));
    let fired = 0;
    ai.onPhaseChange = () => fired++;
    ai.decide(16);
    expect(ai.phase).toBe(2);
    expect(ai.state).toBe(AIState.PHASE_CHANGE);
    expect(fired).toBe(1);
    // stays paused during the phase-change beat, no double trigger
    for (let i = 0; i < 10; i++) ai.decide(16);
    expect(fired).toBe(1);
  });

  it('phase 2 is more aggressive than phase 1', () => {
    const self = mockFighter({ health: 60 });
    const ai = new VaelAI(self, mockFighter({ x: 300 }));
    ai.decide(16);
    // config was mutated by the phase change
    expect((ai as unknown as { config: { aggression: number } }).config.aggression).toBeGreaterThan(0.8);
  });
});

describe('special attack gating in AI', () => {
  it('never opens the fight with the special (cooldown pre-armed)', () => {
    const cfg = {
      preferredRange: 200, approachSpeed: 200, reactionDelayMs: 100, attackCooldownMs: 300,
      aggression: 1, blockChance: 0, dodgeChance: 0, punishChance: 0,
      attackChoices: [{ id: 'boss-special', weight: 100 }, { id: 'boss-slash', weight: 0.0001 }],
      specialId: 'boss-special', specialCooldownMs: 60_000, seed: 7,
    };
    const ai = new EnemyAI(mockFighter({ x: 0 }), mockFighter({ x: 180 }), cfg);
    const intents: Array<ReturnType<EnemyAI['decide']>> = [];
    for (let t = 0; t < 2000; t += 16) intents.push(ai.decide(16));
    const attacks = intents.filter((i) => i.attack);
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.every((i) => i.attackId === 'boss-slash')).toBe(true);
  });
});

describe('guard break', () => {
  it('triggers after the configured hits inside the window', () => {
    const now = 10_000;
    const times = Array.from({ length: GUARD_BREAK_HITS }, (_, i) => now - i * 300);
    expect(isGuardBroken(times, now)).toBe(true);
  });

  it('old blocked hits fall out of the window', () => {
    const now = 10_000;
    const times = [now, now - GUARD_BREAK_WINDOW_MS - 1, now - GUARD_BREAK_WINDOW_MS - 500];
    expect(isGuardBroken(times, now)).toBe(false);
  });
});
