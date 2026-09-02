/**
 * Fight 2 enemy — Phase 2. The combat sheet
 * (Assets/characters/guardian/animations/04_guardian_combat_sprite_sheet.png)
 * uses the same labeled-row layout as the Raider sheet and will be sliced by
 * the same pipeline entry style. Not spawned in Phase 1.
 */
import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { FighterConfig } from '../data/fighterConfigs';

export class Guardian extends Enemy {
  constructor(scene: Phaser.Scene, config: FighterConfig, x: number) {
    super(scene, config, x, -1);
  }
}
