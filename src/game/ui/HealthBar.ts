/**
 * Health bar built from the real futuristic health bar art:
 * empty frame underneath + full-fill image cropped by health fraction on top.
 */
import Phaser from 'phaser';
import { TEX } from '../data/assetKeys';

/** fill region inside the bar art (fractions of texture width) */
const FILL_START = 0.115;
const FILL_END = 0.965;

export class HealthBar {
  readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private fraction = 1;
  private readonly texWidth: number;
  private readonly texHeight: number;

  constructor(
    scene: Phaser.Scene,
    private readonly mirrored: boolean,
    name: string,
  ) {
    this.frame = scene.add.image(0, 0, TEX.HEALTH_FRAME).setOrigin(0, 0);
    this.fill = scene.add.image(0, 0, TEX.HEALTH_FILL).setOrigin(0, 0);
    const src = scene.textures.get(TEX.HEALTH_FILL).getSourceImage() as { width: number; height: number };
    this.texWidth = src.width;
    this.texHeight = src.height;
    if (mirrored) {
      this.frame.setFlipX(true);
      this.fill.setFlipX(true);
    }
    this.label = scene.add
      .text(0, 0, name, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#bfeaff',
      })
      .setOrigin(mirrored ? 1 : 0, 0);
    this.container = scene.add.container(0, 0, [this.frame, this.fill, this.label]);
    this.setFraction(1);
  }

  /** Lay out at a screen position with a target width in CSS px. */
  layout(x: number, y: number, width: number): void {
    const scale = width / this.texWidth;
    this.frame.setScale(scale);
    this.fill.setScale(scale);
    this.container.setPosition(x, y);
    this.label.setPosition(this.mirrored ? width : 0, this.texHeight * scale + 2);
    this.applyCrop();
  }

  setFraction(fraction: number): void {
    this.fraction = Math.min(1, Math.max(0, fraction));
    this.applyCrop();
  }

  private applyCrop(): void {
    const fillWidth = (FILL_START + (FILL_END - FILL_START) * this.fraction) * this.texWidth;
    if (this.fraction <= 0) {
      this.fill.setVisible(false);
      return;
    }
    this.fill.setVisible(true);
    // crop is defined in texture space; with flipX the cropped region renders
    // mirrored so the cap stays on the outer edge for the enemy bar.
    this.fill.setCrop(0, 0, fillWidth, this.texHeight);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
