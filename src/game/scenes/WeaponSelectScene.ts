/**
 * Weapon selection before the run. Three weapons with real icon art; the
 * Chroma Blade is playable now — Battle Axe and Dual Blades have full stat
 * profiles in the WeaponDefinition system but their dedicated swing
 * animation sets are not yet produced, so they present locked rather than
 * faking a weapon over sword animations.
 */
import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { TEX } from '../data/assetKeys';
import { RunState, WEAPONS, type WeaponDefinition } from '../data/runState';
import { KAIRO_CONFIG } from '../data/fighterConfigs';
import { audio } from '../audio/AudioManager';
import { TUTORIAL_NEXT, TUTORIAL_SEEN_KEY } from './TutorialScene';
import { onTap, MIN_TOUCH_PX } from '../ui/tapTarget';
import { SafeAreaService } from '../responsive/SafeAreaService';

const FONT = 'Segoe UI, system-ui, sans-serif';

/** Card art box, in CSS px (1 world unit == 1 CSS px in this scene). */
const CARD_W = 190;
const CARD_H = 240;
const CONFIRM_W = 240;
const CONFIRM_H = 46;
/** Below this viewport height the compact landscape budget is used. */
const COMPACT_HEIGHT = 560;

const clamp = (min: number, value: number, max: number): number => Math.min(max, Math.max(min, value));

export class WeaponSelectScene extends Phaser.Scene {
  private selectedId = WEAPONS[0]?.id ?? 'chroma-blade';
  private cards: Array<{ weapon: WeaponDefinition; icon: Phaser.GameObjects.Image; frame: Phaser.GameObjects.Rectangle; container: Phaser.GameObjects.Container }> = [];
  private confirmBg!: Phaser.GameObjects.Rectangle;
  private resizeHandler: (() => void) | null = null;
  private readonly safeArea = new SafeAreaService();

  constructor() {
    super(SCENES.WEAPON_SELECT);
  }

  create(): void {
    this.cards = [];
    this.selectedId = 'chroma-blade';
    this.cameras.main.setBackgroundColor('#080d18');
    this.add.image(0, 0, TEX.ARENA_RUINS).setName('backdrop').setAlpha(0.35);

    this.add
      .text(0, 0, 'CHOOSE YOUR WEAPON', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#9fe8ff', letterSpacing: 4 })
      .setName('title')
      .setOrigin(0.5);

    for (const weapon of WEAPONS) {
      const frame = this.add
        .rectangle(0, 0, CARD_W, CARD_H, 0x0c1220, 0.92)
        .setStrokeStyle(2, weapon.id === this.selectedId ? 0x6de3ff : 0x3a4a5c, 1)
        .setInteractive({ useHandCursor: true });
      const icon = this.add
        .image(0, -40, weapon.id === this.selectedId ? weapon.iconSelectedKey : weapon.iconKey)
        .setDisplaySize(120, 126);
      const name = this.add
        .text(0, 46, weapon.name, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#d8e9f6', letterSpacing: 1 })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, 70, weapon.description, { fontFamily: FONT, fontSize: '11px', color: '#8ba3b8', align: 'center', wordWrap: { width: 170 } })
        .setOrigin(0.5);
      const children: Phaser.GameObjects.GameObject[] = [frame, icon, name, desc];
      if (!weapon.available) {
        children.push(
          this.add.image(0, -40, TEX.WPN_LOCKED).setDisplaySize(64, 68).setAlpha(0.95),
          this.add
            .text(0, 96, 'ANIMATION SET IN PRODUCTION', { fontFamily: FONT, fontSize: '9px', color: '#7d8ea0', letterSpacing: 1 })
            .setOrigin(0.5),
        );
        icon.setAlpha(0.35);
      }
      const container = this.add.container(0, 0, children);
      onTap(this, frame, () => this.select(weapon));
      this.cards.push({ weapon, icon, frame, container });
    }

    this.confirmBg = this.add
      .rectangle(0, 0, CONFIRM_W, CONFIRM_H, 0x14324a, 1)
      .setStrokeStyle(1.5, 0x6de3ff, 0.9)
      .setName('confirm')
      .setInteractive({ useHandCursor: true });
    this.add
      .text(0, 0, 'BEGIN THE RUN', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#9fe8ff', letterSpacing: 3 })
      .setName('confirmLabel')
      .setOrigin(0.5);
    onTap(this, this.confirmBg, () => this.confirm());
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard?.on('keydown-LEFT', () => this.cycle(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.cycle(1));

    this.layout();
    this.resizeHandler = () => this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
      this.safeArea.destroy();
    });

    (window as Window & { __ccWeaponSelect?: boolean }).__ccWeaponSelect = true;
    audio.music('menu');
  }

  private cycle(dir: number): void {
    const available = WEAPONS.filter((w) => w.available);
    const idx = available.findIndex((w) => w.id === this.selectedId);
    const next = available[(idx + dir + available.length) % available.length];
    if (next) this.select(next);
  }

  private select(weapon: WeaponDefinition): void {
    if (!weapon.available) {
      audio.sfx('ui-denied');
      return;
    }
    this.selectedId = weapon.id;
    audio.sfx('ui-move');
    for (const card of this.cards) {
      const selected = card.weapon.id === weapon.id;
      card.frame.setStrokeStyle(2, selected ? 0x6de3ff : 0x3a4a5c, 1);
      if (card.weapon.available) {
        card.icon.setTexture(selected ? card.weapon.iconSelectedKey : card.weapon.iconKey);
      }
    }
  }

  private confirm(): void {
    audio.sfx('ui-select');
    const run = new RunState(this.selectedId, KAIRO_CONFIG.maxHealth);
    this.registry.set(REGISTRY.RUN_STATE, run);
    (window as Window & { __ccWeaponSelect?: boolean }).__ccWeaponSelect = false;
    let seen = true;
    try {
      seen = localStorage.getItem(TUTORIAL_SEEN_KEY) === '1';
    } catch {
      /* storage unavailable */
    }
    if (!seen) {
      // first run ever: show how to play once before the first fight
      this.registry.set(TUTORIAL_NEXT, SCENES.BATTLE);
      this.scene.start(SCENES.TUTORIAL);
    } else {
      this.scene.start(SCENES.BATTLE);
    }
  }

  private layout(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.scale.width / dpr;
    const h = this.scale.height / dpr;
    const cam = this.cameras.main;
    cam.setZoom(dpr);
    cam.centerOn(w / 2, h / 2);

    const backdrop = this.children.getByName('backdrop') as Phaser.GameObjects.Image | null;
    if (backdrop) {
      const tex = this.textures.get(TEX.ARENA_RUINS).getSourceImage() as { width: number; height: number };
      backdrop.setPosition(w / 2, h / 2).setScale(Math.max(w / tex.width, h / tex.height) * 1.05);
    }

    const title = this.children.getByName('title') as Phaser.GameObjects.Text | null;
    const confirm = this.children.getByName('confirm') as Phaser.GameObjects.Rectangle | null;
    const confirmLabel = this.children.getByName('confirmLabel') as Phaser.GameObjects.Text | null;

    // A landscape phone has roughly half the vertical room of the desktop
    // window, so percentage-of-height placement collides: measured at
    // 844x390 the cards (240 tall) ran into BEGIN THE RUN, and at 740x360
    // they also ran into the title. Below the threshold the screen is laid
    // out from an explicit vertical budget instead. Desktop (>= 560 CSS px
    // tall) keeps the original placement untouched.
    if (h >= COMPACT_HEIGHT) {
      title?.setFontSize(26).setPosition(w / 2, h * 0.13);
      const cardW = Math.min(CARD_W + 10, (w - 80) / 3);
      const gap = Math.min(34, cardW * 0.16);
      const totalW = 3 * cardW + 2 * gap;
      this.cards.forEach((card, i) => {
        const x = w / 2 - totalW / 2 + cardW / 2 + i * (cardW + gap);
        card.container.setPosition(x, h * 0.5).setScale(Math.min(1, cardW / (CARD_W + 10)));
      });
      confirm?.setScale(1).setPosition(w / 2, h * 0.86);
      confirmLabel?.setFontSize(16).setPosition(w / 2, h * 0.86);
      this.refreshHitAreas();
      return;
    }

    // ---- compact landscape budget: title | card row | confirm ----
    const safe = this.safeArea.read();
    const padX = 12 + Math.max(safe.left, safe.right);
    const padTop = 8 + safe.top;
    const padBottom = 8 + safe.bottom;

    const titleSize = clamp(15, w * 0.028, 22);
    const titleY = padTop + titleSize * 0.75;
    title?.setFontSize(titleSize).setPosition(w / 2, titleY);

    // the confirm button is a real touch target first: never below 44 CSS px
    const btnH = Math.max(MIN_TOUCH_PX, Math.min(54, h * 0.14));
    const btnW = clamp(200, w * 0.34, 300);
    const btnY = h - padBottom - btnH / 2;
    confirm?.setScale(btnW / CONFIRM_W, btnH / CONFIRM_H).setPosition(w / 2, btnY);
    confirmLabel?.setFontSize(clamp(13, w * 0.019, 16)).setPosition(w / 2, btnY);

    // whatever vertical space is left belongs to the cards, so they can never
    // overlap the title above or the button below
    const rowTop = titleY + titleSize * 0.75 + 8;
    const rowBottom = btnY - btnH / 2 - 10;
    const rowH = Math.max(72, rowBottom - rowTop);
    const gapRatio = 0.08;
    // fit three cards + two gaps across the width AND the card into the row
    const scale = Math.min((w - padX * 2) / (CARD_W * (3 + 2 * gapRatio)), rowH / CARD_H, 1);
    const cw = CARD_W * scale;
    const gap = cw * gapRatio;
    const totalW = 3 * cw + 2 * gap;
    const rowY = rowTop + rowH / 2;
    this.cards.forEach((card, i) => {
      card.container.setPosition(w / 2 - totalW / 2 + cw / 2 + i * (cw + gap), rowY).setScale(scale);
    });
    this.refreshHitAreas();
  }

  /**
   * Phaser sizes a Shape's hit area once, at setInteractive() time. The
   * confirm button is rescaled per layout, and while scaling transforms the
   * hit test correctly, the card frames are re-measured here so the
   * interactive region always matches what is drawn.
   */
  private refreshHitAreas(): void {
    const sync = (obj: Phaser.GameObjects.Rectangle): void => {
      const area = obj.input?.hitArea as Phaser.Geom.Rectangle | undefined;
      if (area && typeof area.setSize === 'function') area.setSize(obj.width, obj.height);
    };
    if (this.confirmBg) sync(this.confirmBg);
    for (const card of this.cards) sync(card.frame);
  }
}
