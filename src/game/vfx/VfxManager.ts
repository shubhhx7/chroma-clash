/**
 * Pooled one-shot VFX sprites (hit sparks, slash arcs, KO burst) using the
 * real processed VFX art. No per-hit allocations: sprites come from a pool.
 */
import Phaser from 'phaser';
import { TEX } from '../data/assetKeys';
import { settings } from '../config/settings';
import { animKeyFor } from '../animation/animationKeys';

const POOL_SIZE = 12;

export class VfxManager {
  private animPool: Phaser.GameObjects.Sprite[] = [];
  /** optional callback so lazily-created pool sprites join the world camera set */
  uiIgnored: ((obj: Phaser.GameObjects.GameObject) => void) | null = null;
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const img = scene.add.image(0, 0, TEX.VFX_HIT_BLUE);
      img.setVisible(false).setActive(false).setDepth(60);
      this.pool.push(img);
    }
  }

  private acquire(): Phaser.GameObjects.Image | null {
    return this.pool.find((s) => !s.active) ?? null;
  }

  private burst(
    texture: string,
    x: number,
    y: number,
    scale: number,
    durationMs: number,
    angle = 0,
    flipX = false,
    blend: Phaser.BlendModes = Phaser.BlendModes.ADD,
  ): void {
    const img = this.acquire();
    if (!img) return; // pool exhausted: drop the effect rather than allocate
    const flashScale = settings.get().reducedFlash ? 0.55 : 0.95; // accessibility: dimmer bursts
    img
      .setTexture(texture)
      .setPosition(x, y)
      .setScale(scale * 0.6)
      .setAngle(angle)
      .setFlipX(flipX)
      .setAlpha(flashScale)
      .setBlendMode(blend)
      .setVisible(true)
      .setActive(true);
    this.scene.tweens.add({
      targets: img,
      scale: scale,
      alpha: 0,
      duration: durationMs,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        img.setVisible(false).setActive(false);
      },
    });
  }

  hitSpark(x: number, y: number, fromPlayer: boolean): void {
    this.burst(fromPlayer ? TEX.VFX_HIT_BLUE : TEX.VFX_HIT_RED, x, y, 2.2, 260);
  }

  slashArc(x: number, y: number, facing: 1 | -1): void {
    this.burst(TEX.VFX_RAIDER_SLASH, x, y, 1.8, 220, facing === 1 ? 0 : 180);
  }

  /** Kairo's blue Chroma Blade trail, flipped with facing. */

  koBurst(x: number, y: number): void {
    this.burst(TEX.VFX_KO_BURST, x, y, 4.2, 620);
  }

  /** Hex shield flash on a blocked hit. */
  blockShield(x: number, y: number): void {
    this.burst(TEX.VFX_BLOCK_SHIELD, x, y, 2.4, 240);
  }

  /** Golden pop on a perfect parry (shield + star layered). */
  parryFlash(x: number, y: number): void {
    this.burst(TEX.VFX_HIT_BLUE, x, y, 3.0, 320);
    this.burst(TEX.VFX_KO_BURST, x, y, 2.0, 300);
  }

  /** Chroma Burst special: the dedicated crystal starburst set, layered. */
  chromaBurst(x: number, y: number): void {
    this.burst(TEX.VFX_CHROMA_RING, x, y + 30, 1.4, 520);
    this.burst(TEX.VFX_CHROMA_MAIN, x, y - 30, 1.15, 560);
    this.burst(TEX.VFX_CHROMA_FLASH, x, y - 60, 1.2, 420);
  }

  /**
   * Heavy sword slash: the wide crescent arc swept along the blade path, with
   * a cross-flash on the impact beat. Pooled + tweened to zero alpha, so no
   * ghost frame or rectangle is ever left behind.
   */
  heavyArc(x: number, y: number, facing: 1 | -1): void {
    // NORMAL blend: this arc is already a bright glow, and ADD over the bright
    // sky saturated it to invisibility
    // sized to the blade (~240 world px ≈ 1.2x sword length), NOT to the
    // viewport: the source art is 667px wide, so scale stays well under 0.4
    this.burst(TEX.VFX_HEAVY_ARC, x, y, 0.36, 300, facing === 1 ? 14 : -14, facing === -1, Phaser.BlendModes.NORMAL);
  }


  /** Vael's sword swing trail arc. */
  vaelTrail(x: number, y: number, facing: 1 | -1): void {
    this.burst(TEX.VFX_VAEL_TRAIL, x, y, 1.6, 300, facing === 1 ? 0 : 0, facing === -1);
  }

  /** Final boss defeat: light pillar + ground burst. */
  bossDefeat(x: number, groundY: number): void {
    this.burst(TEX.VFX_BOSS_GROUND, x, groundY - 60, 2.2, 900);
    this.burst(TEX.VFX_BOSS_PILLAR, x, groundY - 260, 2.0, 1100);
  }

  /** Play a one-shot ANIMATED effect (dust puffs etc.) from the sprite pool. */
  playAnim(textureKey: string, x: number, y: number, scale = 1, flipX = false): void {
    let spr = this.animPool.find((s) => !s.visible);
    if (!spr) {
      if (this.animPool.length >= 8) return; // pool cap: drop rather than allocate
      spr = this.scene.add.sprite(0, 0, textureKey, 0).setDepth(7).setVisible(false);
      this.uiIgnored?.(spr);
      this.animPool.push(spr);
    }
    spr
      .setTexture(textureKey, 0)
      .setPosition(x, y)
      .setScale(scale)
      .setFlipX(flipX)
      .setAlpha(0.9)
      .setVisible(true);
    spr.play({ key: animKeyFor(textureKey) }, true);
    spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr!.setVisible(false));
  }

  /** Guardian's hammer connects — orange concussive blast. */
  hammerImpact(x: number, y: number): void {
    this.burst(TEX.VFX_HAMMER_IMPACT, x, y, 2.6, 340);
  }

  /** Vael's Violet Rift Slash energy. */
  riftBurst(x: number, y: number): void {
    this.burst(TEX.VFX_RIFT_BURST, x, y, 2.8, 380);
  }

  /** Boss phase-change aura ring. */
  riftRing(x: number, y: number): void {
    this.burst(TEX.VFX_RIFT_RING, x, y, 3.4, 700);
    this.burst(TEX.VFX_RIFT_BURST, x, y + 40, 2.2, 620);
  }

  destroy(): void {
    for (const s of this.pool) s.destroy();
    this.pool = [];
  }
}
