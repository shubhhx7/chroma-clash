/**
 * Between-fight upgrade choice: exactly three distinct, not-yet-taken cards
 * (real card frame + icon art, live text), select then confirm. The run
 * timer is not running here (fight time is measured inside battles only).
 */
import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { TEX } from '../data/assetKeys';
import { onTap } from '../ui/tapTarget';
import { RunState, type UpgradeDefinition } from '../data/runState';
import { audio } from '../audio/AudioManager';

const FONT = 'Segoe UI, system-ui, sans-serif';

export class UpgradeScene extends Phaser.Scene {
  private choices: UpgradeDefinition[] = [];
  private selectedId: string | null = null;
  private cards: Array<{ def: UpgradeDefinition; bg: Phaser.GameObjects.Image; container: Phaser.GameObjects.Container }> = [];
  private resizeHandler: (() => void) | null = null;

  constructor() {
    super(SCENES.UPGRADE);
  }

  create(): void {
    this.cards = [];
    this.selectedId = null;
    const run = this.registry.get(REGISTRY.RUN_STATE) as RunState | undefined;
    if (!run) {
      this.scene.start(SCENES.WEAPON_SELECT);
      return;
    }
    this.cameras.main.setBackgroundColor('#080d18');
    this.add.image(0, 0, TEX.ARENA_MOUNTAINS).setName('backdrop').setAlpha(0.3);
    this.add
      .text(0, 0, 'CHOOSE AN UPGRADE', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#9fe8ff', letterSpacing: 4 })
      .setName('title')
      .setOrigin(0.5);

    this.choices = run.drawUpgradeChoices();
    for (const def of this.choices) {
      const bg = this.add.image(0, 0, TEX.UPG_CARD).setDisplaySize(200, 300).setInteractive({ useHandCursor: true });
      const icon = this.add.image(0, -66, def.iconKey).setDisplaySize(84, 96);
      const title = this.add
        .text(0, 26, def.title, { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#d8e9f6', letterSpacing: 1, align: 'center', wordWrap: { width: 160 } })
        .setOrigin(0.5);
      const desc = this.add
        .text(0, 74, def.description, { fontFamily: FONT, fontSize: '12px', color: '#8ba3b8', align: 'center', wordWrap: { width: 156 } })
        .setOrigin(0.5, 0);
      const container = this.add.container(0, 0, [bg, icon, title, desc]);
      onTap(this, bg, () => this.select(def));
      this.cards.push({ def, bg, container });
    }

    const confirm = this.add
      .rectangle(0, 0, 240, 46, 0x14324a, 1)
      .setStrokeStyle(1.5, 0x6de3ff, 0.9)
      .setName('confirm')
      .setInteractive({ useHandCursor: true });
    this.add
      .text(0, 0, 'CONFIRM', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#9fe8ff', letterSpacing: 3 })
      .setName('confirmLabel')
      .setOrigin(0.5);
    onTap(this, confirm, () => this.confirm());
    this.input.keyboard?.on('keydown-ENTER', () => this.confirm());

    this.layout();
    this.resizeHandler = () => this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    });

    (window as Window & { __ccUpgrade?: string[] | false }).__ccUpgrade = this.choices.map((c) => c.id);
  }

  private select(def: UpgradeDefinition): void {
    this.selectedId = def.id;
    audio.sfx('ui-move');
    for (const card of this.cards) {
      card.bg.setTexture(card.def.id === def.id ? TEX.UPG_CARD_SEL : TEX.UPG_CARD);
    }
  }

  private confirm(): void {
    if (!this.selectedId) {
      audio.sfx('ui-denied');
      return;
    }
    const run = this.registry.get(REGISTRY.RUN_STATE) as RunState;
    run.applyUpgrade(this.selectedId);
    audio.sfx('ui-select');
    (window as Window & { __ccUpgrade?: string[] | false }).__ccUpgrade = false;
    this.scene.start(SCENES.BATTLE);
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
      const tex = this.textures.get(TEX.ARENA_MOUNTAINS).getSourceImage() as { width: number; height: number };
      backdrop.setPosition(w / 2, h / 2).setScale(Math.max(w / tex.width, h / tex.height) * 1.05);
    }
    (this.children.getByName('title') as Phaser.GameObjects.Text | null)?.setPosition(w / 2, h * 0.11);

    // three cards on wide screens; compact row (smaller scale) on narrow landscape
    const cardW = Math.min(210, (w - 70) / 3);
    const gap = Math.min(30, cardW * 0.14);
    const totalW = 3 * cardW + 2 * gap;
    this.cards.forEach((card, i) => {
      const x = w / 2 - totalW / 2 + cardW / 2 + i * (cardW + gap);
      card.container.setPosition(x, h * 0.5).setScale(Math.min(1, cardW / 210, (h * 0.62) / 300));
    });
    (this.children.getByName('confirm') as Phaser.GameObjects.Rectangle | null)?.setPosition(w / 2, h * 0.88);
    (this.children.getByName('confirmLabel') as Phaser.GameObjects.Text | null)?.setPosition(w / 2, h * 0.88);
  }
}
