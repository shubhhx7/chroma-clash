/** Small impact camera shake, kept subtle and bounded. Honours the screen-shake setting. */
import Phaser from 'phaser';
import { settings } from '../config/settings';

export class CameraFeedback {
  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  hitShake(intensity = 0.004, durationMs = 90): void {
    if (!settings.get().screenShake) return;
    this.camera.shake(durationMs, intensity);
  }

  koShake(): void {
    if (!settings.get().screenShake) return;
    this.camera.shake(220, 0.008);
  }
}
