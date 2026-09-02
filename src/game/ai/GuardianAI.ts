/** Fight 2 AI: heavy defensive wall — telegraphed smashes, frequent blocking. */
import { EnemyAI } from './EnemyAI';
import type { Fighter } from '../entities/Fighter';
import { GUARDIAN_AI_CONFIG } from '../data/enemyConfigs';

export class GuardianAI extends EnemyAI {
  constructor(self: Fighter, target: Fighter) {
    super(self, target, GUARDIAN_AI_CONFIG);
  }
}
