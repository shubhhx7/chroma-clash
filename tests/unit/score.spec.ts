import { describe, expect, it } from 'vitest';
import { computeScore, rankForScore } from '../../src/game/data/gameBalance';

describe('score foundation', () => {
  it('defeat scores zero', () => {
    expect(computeScore({ victory: false, completionTimeMs: 1000, damageTaken: 0, perfectBlocks: 5 })).toBe(0);
  });

  it('faster wins with less damage score higher', () => {
    const fast = computeScore({ victory: true, completionTimeMs: 60_000, damageTaken: 10, perfectBlocks: 0 });
    const slow = computeScore({ victory: true, completionTimeMs: 110_000, damageTaken: 60, perfectBlocks: 0 });
    expect(fast).toBeGreaterThan(slow);
  });

  it('perfect blocks add bonus', () => {
    const base = computeScore({ victory: true, completionTimeMs: 90_000, damageTaken: 20, perfectBlocks: 0 });
    const withBlocks = computeScore({ victory: true, completionTimeMs: 90_000, damageTaken: 20, perfectBlocks: 4 });
    expect(withBlocks).toBe(base + 4 * 150);
  });

  it('score never goes negative', () => {
    expect(
      computeScore({ victory: true, completionTimeMs: 120_000, damageTaken: 500, perfectBlocks: 0 }),
    ).toBeGreaterThanOrEqual(0);
  });

  it('rank thresholds', () => {
    expect(rankForScore(500)).toBe('C');
    expect(rankForScore(1300)).toBe('B');
    expect(rankForScore(1900)).toBe('A');
    expect(rankForScore(2600)).toBe('S');
  });
});
