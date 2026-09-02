/**
 * One arena layer with its scaling strategy. Objects are created eagerly in
 * create() (so camera ignore-lists can be built deterministically) and
 * re-laid out on every viewport change without restarting the fight.
 */
import Phaser from 'phaser';

export type LayerFit =
  /** cover the whole visible viewport (sky) */
  | 'cover'
  /** horizontal band: uniform scale ensuring it spans the visible width (far strips) */
  | 'strip'
  /** scale to a fixed world height, tile horizontally across visible width (floor) */
  | 'tile-x'
  /** fixed world size anchored to the ground (props, architecture) */
  | 'prop';

export interface ParallaxLayerConfig {
  textureKey: string;
  fit: LayerFit;
  depth: number;
  /** 0 = static relative to camera center; 1 = full parallax with world */
  scrollFactor: number;
  /** target world height for 'strip' | 'prop' | 'tile-x' */
  worldHeight?: number;
  /** world x offset from stage center */
  offsetX?: number;
  /** bottom y in world units */
  bottomY?: number;
  alpha?: number;
}

export class ParallaxLayer {
  private image: Phaser.GameObjects.Image | null = null;
  private tile: Phaser.GameObjects.TileSprite | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly config: ParallaxLayerConfig,
  ) {}

  /** Create display objects (eager — before camera ignore lists are built). */
  create(): void {
    const cfg = this.config;
    if (cfg.fit === 'tile-x') {
      const tex = this.textureSize();
      this.tile = this.scene.add.tileSprite(0, cfg.bottomY ?? 0, 16, tex.height, cfg.textureKey).setOrigin(0.5, 1);
      this.tile.setDepth(cfg.depth).setScrollFactor(cfg.scrollFactor).setAlpha(cfg.alpha ?? 1);
    } else {
      this.image = this.scene.add.image(0, 0, cfg.textureKey);
      this.image.setDepth(cfg.depth).setScrollFactor(cfg.scrollFactor).setAlpha(cfg.alpha ?? 1);
    }
  }

  private textureSize(): { width: number; height: number } {
    return this.scene.textures.get(this.config.textureKey).getSourceImage() as { width: number; height: number };
  }

  /** Resize/reposition for the given visible world rect. */
  layout(viewWidth: number, viewHeight: number, centerX: number, centerY: number): void {
    const cfg = this.config;
    const tex = this.textureSize();

    if (cfg.fit === 'tile-x' && this.tile) {
      const h = cfg.worldHeight ?? 140;
      const scale = h / tex.height;
      const width = viewWidth + 64;
      this.tile.setScale(scale);
      this.tile.setSize(Math.ceil(width / scale), tex.height);
      this.tile.setPosition(centerX + (cfg.offsetX ?? 0), cfg.bottomY ?? 0);
      return;
    }
    if (!this.image) return;

    if (cfg.fit === 'cover') {
      const scale = Math.max((viewWidth + 8) / tex.width, (viewHeight + 8) / tex.height);
      this.image.setOrigin(0.5, 0.5);
      this.image.setScale(scale);
      this.image.setPosition(centerX, centerY);
    } else if (cfg.fit === 'strip') {
      // 12% overscan keeps the strip's faded side edges off screen
      const h = cfg.worldHeight ?? tex.height;
      const scale = Math.max(h / tex.height, (viewWidth * 1.12) / tex.width);
      this.image.setOrigin(0.5, 1);
      this.image.setScale(scale);
      this.image.setPosition(centerX + (cfg.offsetX ?? 0), cfg.bottomY ?? 0);
    } else {
      // prop: fixed world height anchored to its ground line
      const h = cfg.worldHeight ?? tex.height;
      const scale = h / tex.height;
      this.image.setOrigin(0.5, 1);
      this.image.setScale(scale);
      this.image.setPosition(cfg.offsetX ?? 0, cfg.bottomY ?? 0);
    }
  }

  /** Display objects owned by this layer (for camera ignore lists). */
  gameObjects(): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    if (this.image) out.push(this.image);
    if (this.tile) out.push(this.tile);
    return out;
  }

  destroy(): void {
    this.image?.destroy();
    this.tile?.destroy();
    this.image = null;
    this.tile = null;
  }
}
