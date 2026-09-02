import { describe, expect, it } from 'vitest';
import { FighterStateId, isTransitionAllowed } from '../../src/game/state/FighterState';

describe('fighter state transition guards', () => {
  it('DEFEAT is terminal', () => {
    for (const to of Object.values(FighterStateId)) {
      expect(isTransitionAllowed(FighterStateId.DEFEAT, to)).toBe(false);
    }
  });

  it('an attack cannot be cancelled into WALK', () => {
    expect(isTransitionAllowed(FighterStateId.BASIC_ATTACK_1, FighterStateId.WALK)).toBe(false);
  });

  it('an attack can be interrupted by HIT and DEFEAT', () => {
    expect(isTransitionAllowed(FighterStateId.BASIC_ATTACK_1, FighterStateId.HIT)).toBe(true);
    expect(isTransitionAllowed(FighterStateId.BASIC_ATTACK_1, FighterStateId.DEFEAT)).toBe(true);
  });

  it('an attack recovers to IDLE', () => {
    expect(isTransitionAllowed(FighterStateId.BASIC_ATTACK_1, FighterStateId.IDLE)).toBe(true);
  });

  it('HIT can only recover, re-stun or die', () => {
    expect(isTransitionAllowed(FighterStateId.HIT, FighterStateId.IDLE)).toBe(true);
    expect(isTransitionAllowed(FighterStateId.HIT, FighterStateId.DEFEAT)).toBe(true);
    expect(isTransitionAllowed(FighterStateId.HIT, FighterStateId.BASIC_ATTACK_1)).toBe(false);
    expect(isTransitionAllowed(FighterStateId.HIT, FighterStateId.WALK)).toBe(false);
  });

  it('self transitions are refused (except forced re-stun handled separately)', () => {
    expect(isTransitionAllowed(FighterStateId.IDLE, FighterStateId.IDLE)).toBe(false);
  });
});
