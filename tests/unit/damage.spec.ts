import { describe, expect, it } from 'vitest';
import { applyDamage, clampHealth, shouldRegisterHit } from '../../src/game/combat/DamageSystem';

describe('DamageSystem', () => {
  it('applies damage', () => {
    expect(applyDamage(100, 12, 100)).toBe(88);
  });

  it('never drops health below zero', () => {
    expect(applyDamage(5, 12, 100)).toBe(0);
  });

  it('ignores negative damage', () => {
    expect(applyDamage(50, -10, 100)).toBe(50);
  });

  it('clamps health into [0, max]', () => {
    expect(clampHealth(-5, 100)).toBe(0);
    expect(clampHealth(150, 100)).toBe(100);
    expect(clampHealth(42, 100)).toBe(42);
    expect(clampHealth(Number.NaN, 100)).toBe(0);
  });

  describe('one-hit-per-swing rule', () => {
    it('registers the first hit on a target', () => {
      expect(shouldRegisterHit(true, new Set(), 'raider')).toBe(true);
    });

    it('refuses a second hit on the same target within one swing', () => {
      expect(shouldRegisterHit(true, new Set(['raider']), 'raider')).toBe(false);
    });

    it('allows multi-hit attacks when configured', () => {
      expect(shouldRegisterHit(false, new Set(['raider']), 'raider')).toBe(true);
    });
  });
});
