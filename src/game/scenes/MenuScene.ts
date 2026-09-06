/**
 * Start screen: the Main Logo crystal banner (black-keyed branding art) over a darkened
 * arena backdrop, with a pulsing start prompt and compact control hints.
 * Any key / tap starts the fight.
 */
import Phaser from 'phaser';
import { SCENES } from '../config/constants';
import { TEX } from '../data/assetKeys';

export class MenuScene extends Phaser.Scene {
  private logo!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private controlsTitle!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  private backdrop!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private started = false;
  private resizeHandler: (() => void) | null = null;

  constructor() {
    super(SCENES.MENU);
  }

  create(): void {
    // Phaser reuses scene instances, so re-entering the menu must clear this
    // one-shot start guard.
    this.started = false;
    const isTouch = window.matchMedia?.('(pointer: coarse)').matches || (navigator.maxTouchPoints ?? 0) > 1;

    this.backdrop = this.add.image(0, 0, TEX.ARENA_RUINS);
    this.shade = this.add.rectangle(0, 0, 10, 10, 0x060912, 0.72).setOrigin(0);
    this.logo = this.add.image(0, 0, TEX.MAIN_LOGO);
    this.prompt = this.add
      .text(0, 0, isTouch ? 'TAP TO FIGHT' : 'PRESS ANY KEY TO FIGHT', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#6de3ff',
        stroke: '#04121f',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.controlsTitle = this.add
      .text(0, 0, 'HOW TO PLAY  /  CONTROLS', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#9fe8ff',
        letterSpacing: 1,
      })
      .setName('controlsTitle')
      .setOrigin(0.5);
    this.controls = this.add
      .text(
        0,
        0,
        isTouch
          ? 'LEFT SIDE  Move left / right\nRIGHT SIDE  Light · Heavy · Jump · Dash · Block · Special'
          : 'MOVE  A / ←  ·  D / →    JUMP  Space / W / ↑\nATTACK  J Light  ·  K Heavy  ·  I Kick    E Dash  ·  S / ↓ Block  ·  L Special',
        {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '14px',
          color: '#9fc4dd',
          align: 'center',
          lineSpacing: 3,
        },
      )
      .setName('controls')
      .setOrigin(0.5);

    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    this.layout();
    this.resizeHandler = () => this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    });

    this.input.keyboard?.once('keydown', () => this.start());
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.start());

    // test hook
    (window as Window & { __ccMenu?: boolean }).__ccMenu = true;
  }

  private layout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.scale.width / dpr;
    const h = this.scale.height / dpr;
    const cam = this.cameras.main;
    cam.setZoom(dpr);
    cam.centerOn(w / 2, h / 2);

    const tex = this.textures.get(TEX.ARENA_RUINS).getSourceImage() as { width: number; height: number };
    this.backdrop.setPosition(w / 2, h / 2).setScale(Math.max(w / tex.width, h / tex.height) * 1.05);
    this.shade.setSize(w + 4, h + 4).setPosition(-2, -2);
    // wide crystal banner: cap by width AND height, preserve intrinsic ratio
    const logoScale = Math.min((w * 0.62) / this.logo.width, (h * 0.34) / this.logo.height, 1);
    this.logo.setPosition(w / 2, h * 0.36).setScale(logoScale);
    this.prompt.setPosition(w / 2, h * 0.72);
    this.controlsTitle.setPosition(w / 2, h * 0.81);
    this.controls.setPosition(w / 2, h * 0.9);
  }

  private start(): void {
    if (this.started) return;
    this.started = true;
    (window as Window & { __ccMenu?: boolean }).__ccMenu = false;
    this.cameras.main.fadeOut(240, 6, 9, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENES.WEAPON_SELECT);
    });
  }
}
