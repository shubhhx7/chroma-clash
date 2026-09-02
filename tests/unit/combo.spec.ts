import { describe, expect, it } from 'vitest';
import { ComboSystem, COMBO_TIMEOUT_MS } from '../../src/game/combat/ComboSystem';
import { resolveBlockedDamage } from '../../src/game/combat/BlockSystem';
import { resolveRect, rectsOverlap } from '../../src/game/combat/combatTypes';

describe('ComboSystem', () => {
  it('counts consecutive player hits', () => {
    const c = new ComboSystem();
    expect(c.registerPlayerHit()).toBe(1);
    expect(c.registerPlayerHit()).toBe(2);
  });

  it('resets when the player is hurt', () => {
    const c = new ComboSystem();
    c.registerPlayerHit();
    c.registerPlayerHurt();
    expect(c.current).toBe(0);
  });

  it('times out after inactivity', () => {
    const c = new ComboSystem();
    c.registerPlayerHit();
    c.update(COMBO_TIMEOUT_MS + 1);
    expect(c.current).toBe(0);
  });
});

describe('BlockSystem foundation', () => {
  it('perfect block inside the window negates damage', () => {
    expect(resolveBlockedDamage(20, 100)).toEqual({ damage: 0, wasPerfect: true });
  });

  it('regular block reduces damage', () => {
    expect(resolveBlockedDamage(20, 800)).toEqual({ damage: 5, wasPerfect: false });
  });
});

describe('facing-relative hitbox resolution', () => {
  const def = { x: 30, y: -100, w: 50, h: 60 };

  it('extends forward when facing right', () => {
    const r = resolveRect(def, 0, 0, 1);
    expect(r).toEqual({ x: 30, y: -100, w: 50, h: 60 });
  });

  it('mirrors when facing left', () => {
    const r = resolveRect(def, 0, 0, -1);
    expect(r).toEqual({ x: -80, y: -100, w: 50, h: 60 });
  });

  it('overlap detection', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 5, h: 5 })).toBe(false);
  });
});
