/**
 * Creates Phaser animations from the generated processed-asset metadata.
 * Loading happens in PreloadScene; this registers anims once per game.
 */
import Phaser from 'phaser';
import { PROCESSED_ANIMATIONS } from '../data/processedAssets';
import { animKeyFor } from './animationKeys';

export class AnimationRegistry {
  static registerAll(scene: Phaser.Scene): void {
    for (const [key, meta] of Object.entries(PROCESSED_ANIMATIONS)) {
      const animKey = animKeyFor(key);
      if (scene.anims.exists(animKey)) continue;
      if (!scene.textures.exists(key)) continue; // missing texture is reported by PreloadScene
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(key, { start: 0, end: meta.frameCount - 1 }),
        frameRate: meta.fps,
        repeat: meta.loop ? -1 : 0,
      });
    }
  }
}
