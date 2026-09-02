/** Fight 1 AI: the base EnemyAI behaviour with Raider tuning. */
import { EnemyAI } from './EnemyAI';
import type { Fighter } from '../entities/Fighter';
import { RAIDER_AI_CONFIG } from '../data/enemyConfigs';

export class RaiderAI extends EnemyAI {
  constructor(self: Fighter, target: Fighter) {
    super(self, target, RAIDER_AI_CONFIG);
  }
}
