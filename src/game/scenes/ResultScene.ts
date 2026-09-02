/**
 * Phase 2 scene shell: victory/defeat + score + rank from the results and
 * score/rank sheets once processed. The score math foundation already lives
 * in data/gameBalance.ts (computeScore / rankForScore, unit tested).
 */
import Phaser from 'phaser';
import { SCENES } from '../config/constants';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super(SCENES.RESULT);
  }

  create(): void {
    this.scene.start(SCENES.BATTLE);
  }
}
