/**
 * Hitbox resolution: reads the attacker's frame-timed hitbox (only exists on
 * active frames — see Fighter.currentHitbox) for the combat system.
 */
import type { Fighter } from '../entities/Fighter';
import type { WorldRect } from './combatTypes';

export class HitboxSystem {
  activeHitbox(attacker: Fighter): WorldRect | null {
    // skip-proof poll: covers every frame traversed since the last check
    return attacker.combatHitbox();
  }
}
