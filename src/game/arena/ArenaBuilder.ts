/**
 * Builds Prismfall Courtyard from real processed arena layers:
 *   far sky (cover) -> distant mountains -> far ruins -> midground
 *   architecture props -> combat floor (tiled) -> ground mist overlay.
 * Every layer re-lays out on viewport changes; nothing is stretched.
 */
import Phaser from 'phaser';
import { ParallaxLayer } from './ParallaxLayer';
import { TEX } from '../data/assetKeys';
import { GROUND_Y } from '../config/constants';

const DEPTHS = {
  SKY: -100,
  ISLANDS: -95,
  MOUNTAINS: -90,
  RUINS: -80,
  HAZE: -75,
  MID_ARCH: -60,
  MID_COLUMN: -55,
  MID_WALL: -58,
  FLOOR: -40,
  MIST: 40, // in front of fighters, soft
} as const;

export class ArenaBuilder {
  private layers: ParallaxLayer[] = [];
  private extraObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** All display objects (for camera ignore lists). */
  gameObjects(): Phaser.GameObjects.GameObject[] {
    return [...this.layers.flatMap((l) => l.gameObjects()), ...this.extraObjects];
  }

  build(): void {
    const add = (layer: ParallaxLayer): void => {
      this.layers.push(layer);
    };

    add(new ParallaxLayer(this.scene, { textureKey: TEX.ARENA_SKY, fit: 'cover', depth: DEPTHS.SKY, scrollFactor: 0 }));
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_HAZE,
        fit: 'strip',
        depth: DEPTHS.ISLANDS - 1,
        scrollFactor: 1,
        worldHeight: 320,
        bottomY: GROUND_Y - 200,
        alpha: 0.85,
      }),
    );
    // floating islands drifting slowly high in the sky (subtle life)
    const islands = new ParallaxLayer(this.scene, {
      textureKey: TEX.ARENA_ISLANDS,
      fit: 'prop',
      depth: DEPTHS.ISLANDS,
      scrollFactor: 1,
      worldHeight: 200,
      offsetX: 330,
      bottomY: GROUND_Y - 420,
      alpha: 0.75,
    });
    add(islands);
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_MOUNTAINS,
        fit: 'strip',
        depth: DEPTHS.MOUNTAINS,
        scrollFactor: 1,
        worldHeight: 300,
        bottomY: GROUND_Y - 170,
      }),
    );
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_RUINS,
        fit: 'strip',
        depth: DEPTHS.RUINS,
        scrollFactor: 1,
        worldHeight: 250,
        bottomY: GROUND_Y - 30,
      }),
    );
    // midground architecture: arch left, columns right, wall far right
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_ARCH_BROKEN,
        fit: 'prop',
        depth: DEPTHS.MID_ARCH,
        scrollFactor: 1,
        worldHeight: 330,
        offsetX: -520,
        bottomY: GROUND_Y + 4,
      }),
    );
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_COLUMN_A,
        fit: 'prop',
        depth: DEPTHS.MID_COLUMN,
        scrollFactor: 1,
        worldHeight: 300,
        offsetX: 560,
        bottomY: GROUND_Y + 4,
      }),
    );
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_WALL,
        fit: 'prop',
        depth: DEPTHS.MID_WALL,
        scrollFactor: 1,
        worldHeight: 170,
        offsetX: 760,
        bottomY: GROUND_Y + 4,
      }),
    );
    // combat floor: tile the full 5-tile strip across the visible width —
    // internal tile borders read as intentional paneling, no odd seams
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_FLOOR_STRIP,
        fit: 'tile-x',
        depth: DEPTHS.FLOOR,
        scrollFactor: 1,
        worldHeight: 128,
        bottomY: GROUND_Y + 112,
      }),
    );
    // ground mist atmosphere drifting in front
    add(
      new ParallaxLayer(this.scene, {
        textureKey: TEX.ARENA_MIST,
        fit: 'prop',
        depth: DEPTHS.MIST,
        scrollFactor: 1,
        worldHeight: 90,
        offsetX: -180,
        bottomY: GROUND_Y + 40,
        alpha: 0.4,
      }),
    );

    // ground fill below the floor tiles for very tall/narrow viewports
    const fill = this.scene.add
      .rectangle(0, GROUND_Y + 110, 4200, 900, 0x0b101e)
      .setOrigin(0.5, 0)
      .setDepth(DEPTHS.FLOOR - 2);
    this.extraObjects.push(fill);

    for (const layer of this.layers) layer.create();

    // gentle drift tweens: islands bob, mist slides — the arena feels alive
    const islandObjs = islands.gameObjects();
    if (islandObjs[0]) {
      this.scene.tweens.add({
        targets: islandObjs[0],
        y: '+=14',
        duration: 3600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    const mistObjs = this.layers[this.layers.length - 1]?.gameObjects() ?? [];
    if (mistObjs[0]) {
      this.scene.tweens.add({
        targets: mistObjs[0],
        x: '+=90',
        duration: 7000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Re-lay all layers for a new visible world rect (called on resize). */
  layout(viewWidth: number, viewHeight: number, centerX: number, centerY: number): void {
    for (const layer of this.layers) layer.layout(viewWidth, viewHeight, centerX, centerY);
  }

  destroy(): void {
    for (const layer of this.layers) layer.destroy();
    for (const o of this.extraObjects) o.destroy();
    this.layers = [];
    this.extraObjects = [];
  }
}
