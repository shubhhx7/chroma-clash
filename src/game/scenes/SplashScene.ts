/**
 * Phase 2 scene shell: splash intro using the processed branding assets
 * (Assets/branding/splash) once they enter the pipeline. Not part of the
 * Phase 1 flow (Preload boots directly into Battle).
 */
import Phaser from 'phaser';
import { SCENES } from '../config/constants';

export class SplashScene extends Phaser.Scene {
  constructor() {
    super(SCENES.SPLASH);
  }

  create(): void {
    this.scene.start(SCENES.MENU);
  }
}
