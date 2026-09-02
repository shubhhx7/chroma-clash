/**
 * Dev-only visual regression: cycles every animation of one fighter at a
 * fixed world position over a baseline line, with a live geometry readout
 * (anim key, frame, cell size, render size, scale). Open with
 *   /?cycle=kairo | raider | guardian | vael
 * Excluded from production navigation (query-gated, DEV builds only).
 */
import Phaser from 'phaser';
import { GROUND_Y, REGISTRY, SCENES } from '../config/constants';
import { ENEMY_CONFIGS, KAIRO_CONFIG, type FighterConfig } from '../data/fighterConfigs';
import { PROCESSED_ANIMATIONS } from '../data/processedAssets';
import { versioned } from '../data/assetVersion';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { AnimationController } from '../animation/AnimationController';

const CONFIGS: Record<string, FighterConfig> = {
  kairo: KAIRO_CONFIG,
  raider: ENEMY_CONFIGS.raider,
  guardian: ENEMY_CONFIGS.guardian,
  vael: ENEMY_CONFIGS.vael,
};

export class CycleScene extends Phaser.Scene {
  private config!: FighterConfig;
  private sprite!: Phaser.GameObjects.Sprite;
  private anims2!: AnimationController;
  private names: string[] = [];
  private index = 0;
  private label!: Phaser.GameObjects.Text;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super(SCENES.CYCLE);
  }

  preload(): void {
    const who = new URLSearchParams(window.location.search).get('cycle') ?? 'kairo';
    this.config = CONFIGS[who] ?? KAIRO_CONFIG;
    for (const binding of Object.values(this.config.animations)) {
      const meta = (PROCESSED_ANIMATIONS as Record<string, { url: string; frameWidth: number; frameHeight: number }>)[
        binding.textureKey
      ];
      if (meta && !this.textures.exists(binding.textureKey)) {
        this.load.spritesheet(binding.textureKey, versioned(meta.url), {
          frameWidth: meta.frameWidth,
          frameHeight: meta.frameHeight,
        });
      }
    }
  }

  create(): void {
    this.index = 0; // scene instances are reused
    AnimationRegistry.registerAll(this);
    this.cameras.main.setBackgroundColor('#141822');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.scale.width / dpr;
    const h = this.scale.height / dpr;
    this.cameras.main.setZoom(dpr * Math.min(1, (h * 0.9) / 720));
    this.cameras.main.centerOn(0, 400);

    // ground baseline + center pivot line
    const g = this.add.graphics();
    g.lineStyle(2, 0x00e0ff, 0.9).lineBetween(-600, GROUND_Y, 600, GROUND_Y);
    g.lineStyle(1, 0xffc94d, 0.5).lineBetween(0, GROUND_Y - 520, 0, GROUND_Y + 30);

    this.sprite = this.add.sprite(0, GROUND_Y, this.config.animations.idle.textureKey, 0).setOrigin(0.5, 1);
    this.anims2 = new AnimationController(this.sprite, this.config.animations);
    this.label = this.add
      .text(-580, GROUND_Y - 660, '', { fontFamily: 'Consolas, monospace', fontSize: '20px', color: '#bfeaff' })
      .setDepth(10);

    this.names = Object.keys(this.config.animations);
    this.playCurrent();
    this.timer = this.time.addEvent({ delay: 1400, loop: true, callback: () => this.next() });
    this.input.keyboard?.on('keydown-RIGHT', () => this.next());
    (window as Window & { __ccCycle?: { fighter: string; anim: string } }).__ccCycle = {
      fighter: this.config.id,
      anim: this.names[0] ?? 'idle',
    };
  }

  private next(): void {
    this.index = (this.index + 1) % this.names.length;
    this.playCurrent();
  }

  private playCurrent(): void {
    const name = this.names[this.index] ?? 'idle';
    this.anims2.play(name, true);
    (window as Window & { __ccCycle?: { fighter: string; anim: string } }).__ccCycle = {
      fighter: this.config.id,
      anim: name,
    };
  }

  override update(): void {
    const name = this.names[this.index] ?? 'idle';
    const fr = this.sprite.frame;
    this.label.setText(
      [
        `character=${this.config.id}  state=${name}  frame=${this.anims2.frameIndex}`,
        `sprite=${this.sprite.texture.key}  cell=${fr.width}x${fr.height}`,
        `render=${this.sprite.displayWidth.toFixed(0)}x${this.sprite.displayHeight.toFixed(0)}  scale=${Math.abs(this.sprite.scaleX).toFixed(3)}`,
        `pivot=bottom-center  baseline=${GROUND_Y}`,
      ].join('\n'),
    );
    void REGISTRY;
  }

  shutdown(): void {
    this.timer?.destroy();
  }
}
