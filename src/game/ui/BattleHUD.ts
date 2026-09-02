/**
 * Battle HUD: two health bars + the player's special meter (all real art),
 * combo readout, READY/FIGHT/KO overlays, KO stats panel and the restart
 * prompt. Lives in the UI camera's screen space.
 */
import Phaser from 'phaser';
import { HealthBar } from './HealthBar';
import { EnergyBar } from './EnergyBar';
import { onTap } from './tapTarget';
import { TEX } from '../data/assetKeys';
import { computeHudLayout } from '../responsive/ResponsiveLayout';
import { PROCESSED_STILLS } from '../data/processedAssets';
import type { SafeAreaInsets } from '../responsive/SafeAreaService';

export class BattleHUD {
  readonly root: Phaser.GameObjects.Container;
  private readonly playerBar: HealthBar;
  private readonly enemyBar: HealthBar;
  private readonly energyBar: EnergyBar;
  private readonly overlay: Phaser.GameObjects.Image;
  private readonly promptText: Phaser.GameObjects.Text;
  private pauseButton: Phaser.GameObjects.Image;
  private comboBadge: Phaser.GameObjects.Image;
  private lastBadgeMilestone = 0;
  private barWidth = 300;
  private lastCssWidth = 1280;
  private lastCssHeight = 720;

  constructor(
    private readonly scene: Phaser.Scene,
    playerName: string,
    enemyName: string,
    onPause: () => void,
  ) {
    this.playerBar = new HealthBar(scene, false, playerName);
    this.enemyBar = new HealthBar(scene, true, enemyName);
    this.energyBar = new EnergyBar(scene, false);
    this.overlay = scene.add.image(0, 0, TEX.OVERLAY_READY).setVisible(false);
    this.promptText = scene.add
      .text(0, 0, '', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#d8f4ff',
        stroke: '#04121f',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.comboBadge = scene.add.image(0, 0, TEX.COMBO_X2).setVisible(false);
    this.pauseButton = scene.add
      .image(0, 0, TEX.BTN_PAUSE)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0.9);
    this.pauseButton.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.pauseButton.setTexture(TEX.BTN_PAUSE_PRESSED);
    });
    onTap(scene, this.pauseButton, () => {
      this.pauseButton.setTexture(TEX.BTN_PAUSE);
      onPause();
    });
    this.pauseButton.on(Phaser.Input.Events.POINTER_OUT, () => this.pauseButton.setTexture(TEX.BTN_PAUSE));

    this.root = scene.add.container(0, 0, [
      this.playerBar.container,
      this.enemyBar.container,
      this.energyBar.container,
      this.comboBadge,
      this.overlay,
      this.promptText,
      this.pauseButton,
    ]);
  }

  layout(cssWidth: number, cssHeight: number, safe: SafeAreaInsets): void {
    const l = computeHudLayout(cssWidth, cssHeight, safe);
    this.barWidth = l.barWidth;
    this.playerBar.layout(l.playerBarX, l.playerBarY, l.barWidth);
    this.enemyBar.layout(l.enemyBarX, l.enemyBarY, l.barWidth);
    // special meter under the player's health bar, below the name label
    this.energyBar.layout(l.playerBarX + l.barWidth * 0.02, l.playerBarY + l.barHeight + 22, l.barWidth * 0.6);
    this.comboBadge.setPosition(l.centerX, l.playerBarY + l.barHeight + 78);
    this.overlay.setPosition(l.centerX, l.centerY - cssHeight * 0.14);
    this.lastCssWidth = cssWidth;
    this.lastCssHeight = cssHeight;
    this.rescaleOverlay();
    this.promptText.setPosition(l.centerX, l.centerY + cssHeight * 0.24);
    this.pauseButton.setPosition(l.pauseX, l.pauseY).setDisplaySize(l.pauseSize, l.pauseSize);
  }

  get healthBarBottomY(): number {
    return this.barWidth * (109 / 1140) + 22 + this.barWidth * 0.6 * (113 / 676);
  }

  setPlayerHealth(fraction: number): void {
    this.playerBar.setFraction(fraction);
  }

  setEnemyHealth(fraction: number): void {
    this.enemyBar.setFraction(fraction);
  }

  setPlayerEnergy(fraction: number): void {
    this.energyBar.setFraction(fraction);
  }

  /**
   * ONE combo indicator: the badge art. (The old text counters were removed —
   * the badge already reads "COMBO xN", so text on top of it duplicated it.)
   */
  setCombo(count: number): void {
    if (count >= 2) {
      this.showComboBadge(count);
    } else {
      this.lastBadgeMilestone = 0;
      this.scene.tweens.killTweensOf(this.comboBadge);
      this.comboBadge.setVisible(false);
    }
  }

  /**
   * Badge tiers: the highest tier at or below the current hit count stays up
   * while the combo lives, and re-pops when a new tier is reached.
   */
  private showComboBadge(count: number): void {
    const tiers: Array<[number, string]> = [
      [30, TEX.COMBO_X30], [15, TEX.COMBO_X15], [10, TEX.COMBO_X10],
      [5, TEX.COMBO_X5], [3, TEX.COMBO_X3], [2, TEX.COMBO_X2],
    ];
    const tier = tiers.find(([n]) => count >= n);
    if (!tier) return;
    const [milestone, tex] = tier;
    if (milestone === this.lastBadgeMilestone) {
      // same tier: just keep it alive (refresh the hold) without re-popping
      this.scene.tweens.killTweensOf(this.comboBadge);
      this.comboBadge.setVisible(true).setAlpha(1);
      this.scene.tweens.add({
        targets: this.comboBadge,
        alpha: 0,
        delay: 780,
        duration: 240,
        onComplete: () => this.comboBadge.setVisible(false),
      });
      return;
    }
    this.lastBadgeMilestone = milestone;
    this.comboBadge.setTexture(tex).setVisible(true).setAlpha(1);
    const s = Math.min(1, 260 / this.comboBadge.width);
    this.comboBadge.setScale(s * 0.5);
    this.scene.tweens.killTweensOf(this.comboBadge);
    this.scene.tweens.add({ targets: this.comboBadge, scaleX: s, scaleY: s, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: this.comboBadge,
      alpha: 0,
      delay: 780,
      duration: 240,
      onComplete: () => this.comboBadge.setVisible(false),
    });
  }

  /** Boss intro: FINAL FIGHT banner, then hand off to the fight. */
  playFinalFightIntro(onDone: () => void): void {
    this.showOverlay(TEX.OVERLAY_FINAL_FIGHT, 950, () => {
      this.showOverlay(TEX.OVERLAY_FIGHT, 600, onDone);
    });
  }

  /** Denied-special feedback: pulse the meter so the gate reads as intentional. */
  flashEnergyBar(): void {
    this.scene.tweens.add({ targets: this.energyBar.container, alpha: 0.25, duration: 90, yoyo: true, repeat: 2 });
  }

  /** Show READY -> FIGHT intro, then hide. */
  playIntro(onFightShown: () => void): void {
    this.showOverlay(TEX.OVERLAY_READY, 900, () => {
      this.showOverlay(TEX.OVERLAY_FIGHT, 700, () => {
        onFightShown();
      });
    });
  }


  hideOverlays(): void {
    this.overlay.setVisible(false);
    this.promptText.setVisible(false);
  }

  /** overlay banners differ wildly in source width — scale per texture */
  /**
   * Stinger banners are MEDIUM-sized: ~22% of viewport width on desktop,
   * ~30% on narrow landscape phones (they must not cover the fighters or the
   * health bars). Aspect ratio is preserved and height is capped too.
   */
  private rescaleOverlay(): void {
    const narrow = this.lastCssWidth < 900;
    const widthFrac = narrow ? 0.3 : 0.22;
    const scale = Math.min(
      (this.lastCssWidth * widthFrac) / Math.max(1, this.overlay.width),
      (this.lastCssHeight * 0.18) / Math.max(1, this.overlay.height),
      1,
    );
    this.overlay.setScale(scale);
  }

  private showOverlay(texture: string, holdMs: number, then: () => void): void {
    // full opacity, normal blend, no tint: the artwork is shown as provided
    this.overlay
      .setTexture(texture)
      .setVisible(true)
      .setAlpha(1)
      .clearTint()
      .setBlendMode(Phaser.BlendModes.NORMAL);
    this.rescaleOverlay();
    this.scene.time.delayedCall(holdMs, () => {
      this.overlay.setVisible(false);
      then();
    });
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
