/**
 * Code-driven result panel (vector panel + live text — no pre-rendered
 * bitmap boards). Premium dark navy surface, thin silver frame, restrained
 * cyan accent, gold only for victory rank. Compact so the fighters stay
 * visible behind it. Reads exclusively from the typed FightResult object,
 * so no row can ever render blank.
 */
import Phaser from 'phaser';
import { onTap } from './tapTarget';
import type { FightResult, RunTotals } from '../data/runState';

export interface ResultAction {
  label: string;
  handler: () => void;
}

const FONT = 'Segoe UI, system-ui, sans-serif';
const COLORS = {
  surface: 0x0c1220,
  surfaceEdge: 0xb9c6d4,
  accent: 0x6de3ff,
  gold: '#ffd45e',
  text: '#d8e9f6',
  dim: '#8ba3b8',
};

export class ResultPanel {
  readonly root: Phaser.GameObjects.Container;
  private buttons: Array<{ bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; action: ResultAction }> = [];
  private keyHandlers: Array<{ key: string; fn: () => void }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    title: string,
    result: FightResult,
    actions: ResultAction[],
    runTotals?: RunTotals,
  ) {
    const width = 380;
    const rows: Array<[string, string]> = runTotals
      ? [
          ['TOTAL TIME', formatTime(runTotals.timeMs)],
          ['TOTAL DAMAGE TAKEN', String(runTotals.damageTaken)],
          ['TOTAL PERFECT BLOCKS', String(runTotals.perfectBlocks)],
          ['MAX COMBO', String(runTotals.maxCombo)],
          ['FINAL SCORE', String(runTotals.score)],
          ['FINAL RANK', result.rank],
        ]
      : result.outcome === 'victory'
        ? [
            ['OPPONENT', result.enemyId.toUpperCase()],
            ['FIGHT TIME', formatTime(result.elapsedMs)],
            ['DAMAGE TAKEN', String(result.damageTaken)],
            ['PERFECT BLOCKS', String(result.perfectBlocks)],
            ['MAX COMBO', String(result.maxCombo)],
            ['SCORE', String(result.score)],
            ['RANK', result.rank],
          ]
        : [
            ['ENEMY', result.enemyId.toUpperCase()],
            ['FIGHT TIME', formatTime(result.elapsedMs)],
            ['HITS LANDED', String(result.hitsLanded)],
            ['SCORE EARNED', String(result.score)],
          ];

    const rowH = 26;
    const headerH = 64;
    const buttonsH = 62;
    const height = headerH + rows.length * rowH + buttonsH + 18;

    // ---- surface ----
    const g = scene.add.graphics();
    g.fillStyle(COLORS.surface, 0.94);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    g.lineStyle(1.5, COLORS.surfaceEdge, 0.55);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    g.lineStyle(1, COLORS.accent, 0.5);
    g.strokeRoundedRect(-width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 8);
    // header rule
    g.lineStyle(1, COLORS.accent, 0.35);
    g.lineBetween(-width / 2 + 22, -height / 2 + headerH - 14, width / 2 - 22, -height / 2 + headerH - 14);

    const isVictory = result.outcome === 'victory';
    const titleText = scene.add
      .text(0, -height / 2 + 26, title, {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: isVictory ? COLORS.gold : '#ff8d7a',
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [g, titleText];

    rows.forEach(([label, value], i) => {
      const y = -height / 2 + headerH + i * rowH + 4;
      const isRank = label.includes('RANK');
      children.push(
        scene.add
          .text(-width / 2 + 26, y, label, { fontFamily: FONT, fontSize: '13px', color: COLORS.dim, letterSpacing: 1 })
          .setOrigin(0, 0.5),
        scene.add
          .text(width / 2 - 26, y, value, {
            fontFamily: FONT,
            fontSize: isRank ? '20px' : '15px',
            fontStyle: 'bold',
            color: isRank && isVictory ? COLORS.gold : COLORS.text,
          })
          .setOrigin(1, 0.5),
      );
    });

    // ---- buttons ----
    const btnY = height / 2 - buttonsH / 2 - 4;
    const btnW = actions.length > 1 ? (width - 60) / actions.length : width - 120;
    actions.forEach((action, i) => {
      const x = actions.length > 1 ? -width / 2 + 24 + btnW / 2 + i * (btnW + 12) : 0;
      const primary = i === 0;
      const bg = scene.add
        .rectangle(x, btnY, btnW, 40, primary ? 0x14324a : 0x101826, 1)
        .setStrokeStyle(1.5, primary ? 0x6de3ff : 0x54687c, 0.9)
        .setInteractive({ useHandCursor: true });
      const label = scene.add
        .text(x, btnY, action.label, {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: primary ? '#9fe8ff' : COLORS.text,
          letterSpacing: 2,
        })
        .setOrigin(0.5);
      bg.on(Phaser.Input.Events.POINTER_OVER, () => bg.setFillStyle(primary ? 0x1d4562 : 0x18243a));
      bg.on(Phaser.Input.Events.POINTER_OUT, () => bg.setFillStyle(primary ? 0x14324a : 0x101826));
      onTap(scene, bg, () => action.handler());
      children.push(bg, label);
      this.buttons.push({ bg, label, action });
    });

    this.root = scene.add.container(0, 0, children).setDepth(500).setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 280, ease: 'Cubic.easeOut' });

    // keyboard: Enter/Space = primary, M = secondary
    const kb = scene.input.keyboard;
    const primaryFn = (): void => actions[0]?.handler();
    const secondaryFn = (): void => actions[1]?.handler();
    kb?.on('keydown-ENTER', primaryFn);
    this.keyHandlers.push({ key: 'keydown-ENTER', fn: primaryFn });
    if (actions.length > 1) {
      kb?.on('keydown-M', secondaryFn);
      this.keyHandlers.push({ key: 'keydown-M', fn: secondaryFn });
    }
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  destroy(): void {
    const kb = this.scene.input.keyboard;
    for (const h of this.keyHandlers) kb?.off(h.key, h.fn);
    this.root.destroy(true);
    this.buttons = [];
  }
}

function formatTime(ms: number): string {
  const t = Math.max(0, ms);
  const mm = Math.floor(t / 60000);
  const ss = Math.floor((t % 60000) / 1000);
  const cs = Math.floor((t % 1000) / 10);
  return `${mm}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
