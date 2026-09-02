/**
 * Compact pause settings: four volume rows (−/+ steppers) and three toggles
 * (screen shake, reduced flashes, vibration). Persisted via settings store.
 * Deliberately small — not a settings dashboard.
 */
import Phaser from 'phaser';
import { onTap } from './tapTarget';
import { settings, type GameSettings } from '../config/settings';
import { audio } from '../audio/AudioManager';

const FONT = 'Segoe UI, system-ui, sans-serif';

type VolumeKey = 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'voiceVolume';
type ToggleKey = 'screenShake' | 'reducedFlash' | 'vibration';

const VOLUME_ROWS: Array<[VolumeKey, string]> = [
  ['masterVolume', 'MASTER'],
  ['musicVolume', 'MUSIC'],
  ['sfxVolume', 'SFX'],
  ['voiceVolume', 'VOICE'],
];
const TOGGLE_ROWS: Array<[ToggleKey, string]> = [
  ['screenShake', 'SCREEN SHAKE'],
  ['reducedFlash', 'REDUCED FLASHES'],
  ['vibration', 'VIBRATION'],
];

export class SettingsPanel {
  readonly root: Phaser.GameObjects.Container;
  private valueTexts = new Map<string, Phaser.GameObjects.Text>();

  constructor(scene: Phaser.Scene, onResume: () => void, onRestart: () => void, onMainMenu: () => void) {
    const width = 340;
    const rowH = 30;
    const rows = VOLUME_ROWS.length + TOGGLE_ROWS.length;
    const height = 74 + rows * rowH + 120;

    const g = scene.add.graphics();
    g.fillStyle(0x0c1220, 0.95);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
    g.lineStyle(1.5, 0xb9c6d4, 0.5);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);

    const title = scene.add
      .text(0, -height / 2 + 24, 'PAUSED', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#9fe8ff', letterSpacing: 4 })
      .setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [g, title];

    let y = -height / 2 + 66;
    for (const [key, label] of VOLUME_ROWS) {
      children.push(...this.volumeRow(scene, key, label, width, y));
      y += rowH;
    }
    for (const [key, label] of TOGGLE_ROWS) {
      children.push(...this.toggleRow(scene, key, label, width, y));
      y += rowH;
    }

    // action buttons
    const mkButton = (by: number, label: string, primary: boolean, handler: () => void): Phaser.GameObjects.GameObject[] => {
      const bg = scene.add
        .rectangle(0, by, width - 80, 32, primary ? 0x14324a : 0x101826, 1)
        .setStrokeStyle(1.2, primary ? 0x6de3ff : 0x54687c, 0.9)
        .setInteractive({ useHandCursor: true });
      const text = scene.add
        .text(0, by, label, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: primary ? '#9fe8ff' : '#d8e9f6', letterSpacing: 2 })
        .setOrigin(0.5);
      onTap(scene, bg, () => {
        audio.sfx('ui-select');
        handler();
      });
      return [bg, text];
    };
    children.push(
      ...mkButton(y + 12, 'RESUME', true, onResume),
      ...mkButton(y + 50, 'RESTART FIGHT', false, onRestart),
      ...mkButton(y + 88, 'MAIN MENU', false, onMainMenu),
    );

    this.root = scene.add.container(0, 0, children).setDepth(600).setVisible(false);
  }

  private volumeRow(scene: Phaser.Scene, key: VolumeKey, label: string, width: number, y: number): Phaser.GameObjects.GameObject[] {
    const name = scene.add
      .text(-width / 2 + 24, y, label, { fontFamily: FONT, fontSize: '13px', color: '#8ba3b8', letterSpacing: 1 })
      .setOrigin(0, 0.5);
    const value = scene.add
      .text(width / 2 - 64, y, `${Math.round(settings.get()[key] * 100)}`, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#d8e9f6' })
      .setOrigin(1, 0.5);
    this.valueTexts.set(key, value);
    const step = (delta: number): void => {
      const next = Math.min(1, Math.max(0, Math.round((settings.get()[key] + delta) * 10) / 10));
      settings.update({ [key]: next } as Partial<GameSettings>);
      value.setText(`${Math.round(next * 100)}`);
      audio.sfx('ui-move');
    };
    const minus = scene.add
      .text(width / 2 - 44, y, '−', { fontFamily: FONT, fontSize: '20px', color: '#6de3ff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const plus = scene.add
      .text(width / 2 - 20, y, '+', { fontFamily: FONT, fontSize: '20px', color: '#6de3ff' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    onTap(scene, minus, () => step(-0.1));
    onTap(scene, plus, () => step(0.1));
    return [name, value, minus, plus];
  }

  private toggleRow(scene: Phaser.Scene, key: ToggleKey, label: string, width: number, y: number): Phaser.GameObjects.GameObject[] {
    const name = scene.add
      .text(-width / 2 + 24, y, label, { fontFamily: FONT, fontSize: '13px', color: '#8ba3b8', letterSpacing: 1 })
      .setOrigin(0, 0.5);
    const value = scene.add
      .text(width / 2 - 24, y, settings.get()[key] ? 'ON' : 'OFF', {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: settings.get()[key] ? '#8dff9d' : '#8ba3b8',
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    onTap(scene, value, () => {
      const next = !settings.get()[key];
      settings.update({ [key]: next } as Partial<GameSettings>);
      value.setText(next ? 'ON' : 'OFF').setColor(next ? '#8dff9d' : '#8ba3b8');
      audio.sfx('ui-move');
    });
    return [name, value];
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  setPosition(x: number, y: number): void {
    this.root.setPosition(x, y);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
