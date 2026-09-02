/**
 * Per-fighter animation facade: plays strips, applies per-animation display
 * scale, tracks the current frame index for frame-timed combat.
 */
import Phaser from 'phaser';
import type { AnimationBinding } from '../data/fighterConfigs';
import { animKeyFor } from './animationKeys';

export class AnimationController {
  private current: string | null = null;

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    private readonly bindings: Record<string, AnimationBinding>,
  ) {}

  /** Play a bound animation by logical name (idle/walk/attack/hit/defeat). */
  play(name: string, restart = false): void {
    const binding = this.bindings[name];
    if (!binding) throw new Error(`No animation binding '${name}'`);
    const key = animKeyFor(binding.textureKey);
    if (!restart && this.current === name && this.sprite.anims.isPlaying) return;
    this.current = name;
    this.sprite.setScale(binding.scale * Math.sign(this.sprite.scaleX || 1), binding.scale);
    this.sprite.play(key, true);
    if (restart) this.sprite.anims.restart();
  }

  /** current logical animation name */
  get currentName(): string | null {
    return this.current;
  }

  /** 0-based frame index within the current animation. */
  get frameIndex(): number {
    const frame = this.sprite.anims.currentFrame;
    return frame ? frame.index - 1 : 0;
  }

  get isPlaying(): boolean {
    return this.sprite.anims.isPlaying;
  }

  /** scale of the given logical animation (for flipping helpers) */
  scaleOf(name: string): number {
    return this.bindings[name]?.scale ?? 1;
  }

  onComplete(cb: (animName: string) => void): void {
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      // Report the logical animation that is actually playing. Several logical
      // names may share one strip (e.g. kick and the light-2 slash), so a
      // reverse lookup from the Phaser key would return whichever binding came
      // first and the owning state would never see its own name complete —
      // leaving the fighter locked in that state mid-fight.
      const current = this.current;
      if (current) {
        const binding = this.bindings[current];
        if (binding && animKeyFor(binding.textureKey) === anim.key) {
          cb(current);
          return;
        }
      }
      // fallback for animations played outside this controller
      for (const [name, binding] of Object.entries(this.bindings)) {
        if (animKeyFor(binding.textureKey) === anim.key) {
          cb(name);
          return;
        }
      }
    });
  }
}
