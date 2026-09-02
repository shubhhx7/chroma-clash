/**
 * Special-meter bar built from the real neon energy bar art:
 * empty frame underneath + full-fill image cropped by charge fraction.
 * Pulses subtly when full (special ready).
 */
import Phaser from 'phaser';
import { TEX } from '../data/assetKeys';

/** fill region inside the bar art (fractions of texture width) */
const FILL_START = 0.16;
const FILL_END = 0.94;

export class EnergyBar {
  readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private fraction = 0;
  private readonly texWidth: number;
  private readonly texHeight: number;
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, mirrored = false) {
    this.frame = scene.add.image(0, 0, TEX.ENERGY_FRAME).setOrigin(0, 0);
    this.fill = scene.add.image(0, 0, TEX.ENERGY_FILL).setOrigin(0, 0);
    const src = scene.textures.get(TEX.ENERGY_FILL).getSourceImage() as { width: number; height: number };
    this.texWidth = src.width;
    this.texHeight = src.height;
    if (mirrored) {
      this.frame.setFlipX(true);
      this.fill.setFlipX(true);
    }
    this.container = scene.add.container(0, 0, [this.frame, this.fill]);
    this.pulseTween = scene.tweens.add({
      targets: this.fill,
      alpha: 0.55,
      duration: 420,
      yoyo: true,
      repeat: -1,
      paused: true,
    });
    this.setFraction(0);
  }

  layout(x: number, y: number, width: number): void {
    const scale = width / this.texWidth;
    this.frame.setScale(scale);
    this.fill.setScale(scale);
    this.container.setPosition(x, y);
    this.applyCrop();
  }

  setFraction(fraction: number): void {
    this.fraction = Math.min(1, Math.max(0, fraction));
    this.applyCrop();
    if (this.fraction >= 1) {
      if (this.pulseTween?.isPaused()) this.pulseTween.resume();
    } else if (this.pulseTween && !this.pulseTween.isPaused()) {
      this.pulseTween.pause();
      this.fill.setAlpha(1);
    }
  }

  get heightFor(): number {
    return this.texHeight;
  }

  private applyCrop(): void {
    if (this.fraction <= 0.02) {
      this.fill.setVisible(false);
      return;
    }
    this.fill.setVisible(true);
    const fillWidth = (FILL_START + (FILL_END - FILL_START) * this.fraction) * this.texWidth;
    this.fill.setCrop(0, 0, fillWidth, this.texHeight);
  }

  destroy(): void {
    this.pulseTween?.destroy();
    this.container.destroy(true);
  }
}
