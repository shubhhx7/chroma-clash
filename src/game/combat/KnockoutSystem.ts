/** Pure KO rules — unit tested. */

export type KOOutcome = 'none' | 'player-wins' | 'enemy-wins';

export function evaluateKnockout(playerHealth: number, enemyHealth: number): KOOutcome {
  // simultaneous KO resolves in the player's favour for V1
  if (enemyHealth <= 0) return 'player-wins';
  if (playerHealth <= 0) return 'enemy-wins';
  return 'none';
}
