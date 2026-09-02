/** Hurtbox resolution — kept separate from any physics body. */
import type { Fighter } from '../entities/Fighter';
import type { WorldRect } from './combatTypes';

export class HurtboxSystem {
  hurtbox(fighter: Fighter): WorldRect | null {
    if (fighter.isDefeated) return null; // downed fighters can't be juggled in V1
    return fighter.hurtbox();
  }
}
