/**
 * Hit stop: briefly freezes combat presentation on confirmed hits without
 * touching browser timers. Implemented by pausing the scene's time scale for
 * animation + our own update gate; BattleScene consults `isFrozen` before
 * advancing fighters.
 */
import Phaser from 'phaser';

export class HitStopController {
  private remainingMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  trigger(durationMs: number): void {
    this.remainingMs = Math.max(this.remainingMs, durationMs);
    this.scene.anims.globalTimeScale = 0.05;
  }

  update(dtMs: number): void {
    if (this.remainingMs <= 0) return;
    this.remainingMs -= dtMs;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.scene.anims.globalTimeScale = 1;
    }
  }

  get isFrozen(): boolean {
    return this.remainingMs > 0;
  }

  reset(): void {
    this.remainingMs = 0;
    this.scene.anims.globalTimeScale = 1;
  }
}
