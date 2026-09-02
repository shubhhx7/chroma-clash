/** Fight 1 enemy. Data-driven via RAIDER_CONFIG + RaiderAI. */
import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { RAIDER_CONFIG } from '../data/fighterConfigs';

export class Raider extends Enemy {
  constructor(scene: Phaser.Scene, x: number, facing: 1 | -1 = -1) {
    super(scene, RAIDER_CONFIG, x, facing);
  }
}
