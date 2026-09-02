import { describe, expect, it } from 'vitest';
import { evaluateKnockout } from '../../src/game/combat/KnockoutSystem';

describe('KnockoutSystem', () => {
  it('reports no KO while both fighters live', () => {
    expect(evaluateKnockout(50, 30)).toBe('none');
  });

  it('player wins when the enemy reaches zero', () => {
    expect(evaluateKnockout(20, 0)).toBe('player-wins');
  });

  it('enemy wins when the player reaches zero', () => {
    expect(evaluateKnockout(0, 15)).toBe('enemy-wins');
  });

  it('simultaneous KO resolves for the player in V1', () => {
    expect(evaluateKnockout(0, 0)).toBe('player-wins');
  });
});
