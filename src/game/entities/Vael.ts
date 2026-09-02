/**
 * Final boss — Phase 2. Sourced from
 * Assets/characters/vael/animations/06_final_villain_combat_sprite_sheet.png
 * ("final villain" filenames map to the game entity Vael). Not spawned in
 * Phase 1.
 */
import Phaser from 'phaser';
import { Enemy } from './Enemy';
import type { FighterConfig } from '../data/fighterConfigs';

export class Vael extends Enemy {
  constructor(scene: Phaser.Scene, config: FighterConfig, x: number) {
    super(scene, config, x, -1);
  }
}
