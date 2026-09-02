/** Enemy base: a Fighter driven by an EnemyAI instead of player input. */
import Phaser from 'phaser';
import { EMPTY_INTENT, Fighter } from './Fighter';
import type { FighterConfig } from '../data/fighterConfigs';
import type { EnemyAI } from '../ai/EnemyAI';

export class Enemy extends Fighter {
  private ai: EnemyAI | null = null;

  constructor(scene: Phaser.Scene, config: FighterConfig, x: number, facing: 1 | -1 = -1) {
    super(scene, config, x, facing);
  }

  attachAI(ai: EnemyAI): void {
    this.ai = ai;
  }

  override update(dtMs: number): void {
    if (this.ai && !this.isDefeated) {
      this.intent = this.ai.decide(dtMs);
    } else {
      this.intent = { ...EMPTY_INTENT };
    }
    super.update(dtMs);
  }
}
