/**
 * Player settings, persisted in localStorage. Consumed by AudioManager
 * (volumes), CameraFeedback (shake), VfxManager (reduced flashes) and the
 * vibration hook.
 */

export interface GameSettings {
  masterVolume: number; // 0..1
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  screenShake: boolean;
  reducedFlash: boolean;
  vibration: boolean;
}

const STORAGE_KEY = 'chroma-clash-settings-v1';

const DEFAULTS: GameSettings = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  voiceVolume: 0.8,
  screenShake: true,
  reducedFlash: false,
  vibration: true,
};

class SettingsStore {
  private state: GameSettings;
  private listeners: Array<(s: GameSettings) => void> = [];

  constructor() {
    this.state = { ...DEFAULTS, ...this.load() };
  }

  private load(): Partial<GameSettings> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Partial<GameSettings>) : {};
    } catch {
      return {};
    }
  }

  get(): GameSettings {
    return this.state;
  }

  update(patch: Partial<GameSettings>): void {
    this.state = { ...this.state, ...patch };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage unavailable (private mode) — settings stay session-only */
    }
    for (const l of this.listeners) l(this.state);
  }

  onChange(listener: (s: GameSettings) => void): void {
    this.listeners.push(listener);
  }
}

export const settings = new SettingsStore();
