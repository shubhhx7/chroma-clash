/**
 * Tutorial page: the full HOW-TO-PLAY art (controls + abilities), contain-fit
 * and centered. Reached from the menu's HOW TO PLAY entry and automatically
 * once before the first run (localStorage flag). Any click/tap, ENTER, ESC or
 * SPACE continues to wherever the caller pointed via the registry.
 */
import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { TEX } from '../data/assetKeys';
import { audio } from '../audio/AudioManager';

export const TUTORIAL_SEEN_KEY = 'chroma-clash-tutorial-seen';
/** registry key: scene to start after the tutorial closes */
export const TUTORIAL_NEXT = 'tutorial-next-scene';

export class TutorialScene extends Phaser.Scene {
  private page!: Phaser.GameObjects.Image;
  private hint!: Phaser.GameObjects.Text;
  private resizeHandler: (() => void) | null = null;
  private closing = false;

  constructor() {
    super(SCENES.TUTORIAL);
  }

  create(): void {
    this.closing = false;
    this.cameras.main.setBackgroundColor('#05070d');
    this.page = this.add.image(0, 0, TEX.TUTORIAL_PAGE);
    this.hint = this.add
      .text(0, 0, 'TAP OR PRESS ANY KEY TO CONTINUE', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        color: '#9fd8ff',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    this.layout();
    this.resizeHandler = () => this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    });

    // a short grace period so the tap that OPENED the tutorial can't close it
    this.time.delayedCall(350, () => {
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.close());
      this.input.keyboard?.once('keydown', () => this.close());
    });

    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      /* storage unavailable — tutorial will simply show again next run */
    }
    (window as Window & { __ccTutorial?: boolean }).__ccTutorial = true;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    audio.sfx('ui-select');
    (window as Window & { __ccTutorial?: boolean }).__ccTutorial = false;
    const next = (this.registry.get(TUTORIAL_NEXT) as string | undefined) ?? SCENES.MENU;
    this.registry.set(TUTORIAL_NEXT, undefined);
    this.cameras.main.fadeOut(180, 5, 7, 13);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(next));
  }

  private layout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.scale.width / dpr;
    const h = this.scale.height / dpr;
    const cam = this.cameras.main;
    cam.setZoom(dpr);
    cam.centerOn(w / 2, h / 2);
    // contain-fit, slightly inset so the ornate frame breathes
    const s = Math.min((w * 0.96) / this.page.width, (h * 0.9) / this.page.height);
    this.page.setPosition(w / 2, h * 0.47).setScale(s);
    this.hint.setPosition(w / 2, h - 16);
  }
}
