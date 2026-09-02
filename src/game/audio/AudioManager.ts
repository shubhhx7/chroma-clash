/**
 * Central audio system — file-based combat audio + procedural music beds.
 *
 * All sound files are ORIGINAL, rendered in-repo by
 * tools/generate-combat-audio.ts (layered DSP: filtered-noise whooshes,
 * inharmonic metal partials, formant-filtered grunts). No remote media, no
 * UI beeps standing in for combat sounds. See docs/AUDIO_LICENSES.md and
 * docs/AUDIO_MANIFEST.md.
 *
 * Buses: master -> { music, combat_sfx, voice, ui } (volumes persisted via
 * settings.ts; the ui bus follows the sfx volume). Playback adds controlled
 * variation: 2+ variants with no immediate repetition, ±3% pitch, ±1.5 dB
 * gain. Polyphony: one voice per character, capped whoosh overlap, defeat
 * voices fire once per fight. The context unlocks on the first user gesture
 * and suspends with tab visibility.
 */
import { settings } from '../config/settings';

export type SfxKey =
  | 'swing-light'
  | 'swing-heavy'
  | 'swing-hammer'
  | 'hit'
  | 'hit-heavy'
  | 'hit-armor'
  | 'block'
  | 'parry'
  | 'guard-break'
  | 'hammer-ground'
  | 'dash'
  | 'jump'
  | 'land'
  | 'special'
  | 'rift'
  | 'ko'
  | 'ui-move'
  | 'ui-select'
  | 'ui-denied'
  | 'victory'
  | 'defeat';

export type MusicKey = 'menu' | 'raider' | 'guardian' | 'vael' | 'none';

export type CharacterId = 'kairo' | 'raider' | 'guardian' | 'vael';
export type VoiceEvent = 'attack' | 'hurt-light' | 'hurt-heavy' | 'special' | 'taunt' | 'defeat';

type Bus = 'music' | 'combat_sfx' | 'voice' | 'ui';

interface EventDef {
  files: string[];
  bus: Bus;
  /** polyphony group; concurrent actives in a group are capped */
  group?: string;
  maxPoly?: number;
  gain?: number;
}

const A = (p: string): string => `audio/${p}`;

/** event -> files (variants), bus, polyphony group */
const SFX_MAP: Record<SfxKey, EventDef> = {
  'swing-light': { files: [A('weapons/sword/whoosh_light_01.wav'), A('weapons/sword/whoosh_light_02.wav'), A('weapons/sword/whoosh_light_03.wav')], bus: 'combat_sfx', group: 'whoosh', maxPoly: 4, gain: 0.7 },
  'swing-heavy': { files: [A('weapons/sword/whoosh_heavy_01.wav'), A('weapons/sword/whoosh_heavy_02.wav')], bus: 'combat_sfx', group: 'whoosh', maxPoly: 4, gain: 0.85 },
  'swing-hammer': { files: [A('weapons/hammer/swing_heavy_01.wav')], bus: 'combat_sfx', group: 'whoosh', maxPoly: 3, gain: 0.9 },
  hit: { files: [A('impacts/hit_light_01.wav'), A('impacts/hit_light_02.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 4, gain: 0.85 },
  'hit-heavy': { files: [A('impacts/hit_heavy_01.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 4, gain: 1 },
  'hit-armor': { files: [A('impacts/armor_hit_01.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 4, gain: 0.9 },
  block: { files: [A('impacts/block_metal_01.wav'), A('impacts/block_metal_02.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 3, gain: 0.75 },
  parry: { files: [A('impacts/parry_01.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 2, gain: 0.85 },
  'guard-break': { files: [A('impacts/guard_break_01.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 2, gain: 1 },
  'hammer-ground': { files: [A('weapons/hammer/impact_ground_01.wav')], bus: 'combat_sfx', group: 'impact', maxPoly: 2, gain: 1 },
  dash: { files: [A('weapons/sword/dash_01.wav')], bus: 'combat_sfx', group: 'whoosh', maxPoly: 2, gain: 0.55 },
  jump: { files: [A('misc/jump_01.wav')], bus: 'combat_sfx', group: 'move', maxPoly: 2, gain: 0.5 },
  land: { files: [A('misc/land_01.wav')], bus: 'combat_sfx', group: 'move', maxPoly: 2, gain: 0.55 },
  special: { files: [A('misc/special_01.wav')], bus: 'combat_sfx', maxPoly: 1, gain: 0.95 },
  rift: { files: [A('misc/rift_01.wav')], bus: 'combat_sfx', maxPoly: 2, gain: 0.9 },
  ko: { files: [A('misc/ko_01.wav')], bus: 'combat_sfx', maxPoly: 1, gain: 1 },
  'ui-move': { files: [A('ui/move_01.wav')], bus: 'ui', group: 'ui', maxPoly: 2, gain: 0.6 },
  'ui-select': { files: [A('ui/select_01.wav')], bus: 'ui', group: 'ui', maxPoly: 2, gain: 0.7 },
  'ui-denied': { files: [A('ui/denied_01.wav')], bus: 'ui', group: 'ui', maxPoly: 2, gain: 0.7 },
  victory: { files: [A('ui/victory_01.wav')], bus: 'ui', maxPoly: 1, gain: 0.8 },
  defeat: { files: [A('ui/defeat_01.wav')], bus: 'ui', maxPoly: 1, gain: 0.8 },
};

function voiceFiles(character: CharacterId, event: VoiceEvent): string[] {
  const base = `voices/${character}/`;
  switch (event) {
    case 'attack':
      return [A(base + 'attack_01.wav'), A(base + 'attack_02.wav')];
    case 'hurt-light':
      return [A(base + 'hurt_light_01.wav'), A(base + 'hurt_light_02.wav')];
    case 'hurt-heavy':
      return [A(base + 'hurt_heavy_01.wav')];
    case 'special':
      return character === 'kairo' ? [A(base + 'special_01.wav')] : [A(base + 'attack_01.wav')];
    case 'taunt':
      return character === 'vael' ? [A(base + 'taunt_01.wav')] : [A(base + 'attack_01.wav')];
    case 'defeat':
      return [A(base + 'defeat_01.wav')];
  }
}

/** per-track pad recipe for the procedural music beds */
const MUSIC_RECIPES: Record<Exclude<MusicKey, 'none'>, { root: number; bpm: number; minor: boolean }> = {
  menu: { root: 110.0, bpm: 60, minor: false },
  raider: { root: 130.8, bpm: 96, minor: true },
  guardian: { root: 98.0, bpm: 76, minor: true },
  vael: { root: 82.4, bpm: 112, minor: true },
};

const VOICE_COOLDOWN_MS = 950;

interface MusicNodes {
  gain: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
  pulseTimer: number | null;
}

export class AudioManager {
  private static sharedCtx: AudioContext | null = null;
  private buses: Partial<Record<Bus | 'master', GainNode>> = {};
  private buffers = new Map<string, AudioBuffer>();
  private loadStarted = false;
  private lastVariant = new Map<string, number>();
  private activeByGroup = new Map<string, number>();
  private voiceLast = new Map<string, number>();
  private defeatPlayed = new Set<string>();
  private musicNodes: MusicNodes | null = null;
  private currentTrack: MusicKey = 'none';
  private duckUntil = 0;

  /** Call from a user-gesture handler — required by mobile autoplay policies. */
  static unlock(): void {
    const ctx = AudioManager.ensureCtx();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    audio.preload();
  }

  private static ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!AudioManager.sharedCtx) {
      const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      AudioManager.sharedCtx = new Ctor();
      document.addEventListener('visibilitychange', () => {
        const c = AudioManager.sharedCtx;
        if (!c) return;
        if (document.hidden) void c.suspend();
        else void c.resume();
      });
    }
    return AudioManager.sharedCtx;
  }

  private get ctx(): AudioContext | null {
    return AudioManager.ensureCtx();
  }

  private bus(name: Bus): GainNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    if (!this.buses.master) {
      const master = ctx.createGain();
      master.connect(ctx.destination);
      this.buses.master = master;
      for (const b of ['music', 'combat_sfx', 'voice', 'ui'] as const) {
        const g = ctx.createGain();
        g.connect(master);
        this.buses[b] = g;
      }
      this.applyVolumes();
      settings.onChange(() => this.applyVolumes());
    }
    return this.buses[name] ?? null;
  }

  private applyVolumes(): void {
    const s = settings.get();
    if (this.buses.master) this.buses.master.gain.value = s.masterVolume;
    if (this.buses.music) this.buses.music.gain.value = s.musicVolume;
    if (this.buses.combat_sfx) this.buses.combat_sfx.gain.value = s.sfxVolume;
    if (this.buses.voice) this.buses.voice.gain.value = s.voiceVolume;
    if (this.buses.ui) this.buses.ui.gain.value = s.sfxVolume * 0.9;
  }

  /** Fetch + decode every combat file once (fire-and-forget, ~1.6 MB total). */
  preload(): void {
    if (this.loadStarted) return;
    this.loadStarted = true;
    const ctx = this.ctx;
    if (!ctx) return;
    const urls = new Set<string>();
    for (const def of Object.values(SFX_MAP)) def.files.forEach((f) => urls.add(f));
    for (const c of ['kairo', 'raider', 'guardian', 'vael'] as const) {
      for (const e of ['attack', 'hurt-light', 'hurt-heavy', 'special', 'taunt', 'defeat'] as const) {
        voiceFiles(c, e).forEach((f) => urls.add(f));
      }
    }
    for (const url of urls) {
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`))))
        .then((buf) => ctx.decodeAudioData(buf))
        .then((decoded) => this.buffers.set(url, decoded))
        .catch((err) => console.warn(`[audio] failed to load ${url}:`, err));
    }
  }

  /** New fight: defeat voices may fire once again. */
  resetFight(): void {
    this.defeatPlayed.clear();
  }

  // ------------------------------------------------------------- playback

  private playFile(def: EventDef, key: string): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const bus = this.bus(def.bus);
    if (!bus) return;

    // polyphony cap per group
    const group = def.group ?? key;
    const active = this.activeByGroup.get(group) ?? 0;
    if (active >= (def.maxPoly ?? 3)) return;

    // variant selection without immediate repetition
    let idx = Math.floor(Math.random() * def.files.length);
    if (def.files.length > 1 && idx === this.lastVariant.get(key)) {
      idx = (idx + 1) % def.files.length;
    }
    this.lastVariant.set(key, idx);
    const url = def.files[idx];
    if (!url) return;
    const buffer = this.buffers.get(url);
    if (!buffer) return; // not decoded yet — drop silently rather than block gameplay

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.97 + Math.random() * 0.06; // ±3%
    const g = ctx.createGain();
    const jitterDb = (Math.random() * 2 - 1) * 1.5; // ±1.5 dB
    g.gain.value = (def.gain ?? 0.8) * Math.pow(10, jitterDb / 20);
    src.connect(g).connect(bus);
    this.activeByGroup.set(group, active + 1);
    src.onended = () => {
      this.activeByGroup.set(group, Math.max(0, (this.activeByGroup.get(group) ?? 1) - 1));
    };
    src.start();
  }

  sfx(key: SfxKey): void {
    this.playFile(SFX_MAP[key], key);
  }

  /**
   * Character voice bark. Per-character cooldown (~1s) prevents vocal spam;
   * callers pass a per-event-type chance (light ~28%, heavy ~65%, special
   * 100%); defeat voices play exactly once per fight and bypass the cooldown.
   */
  voice(character: CharacterId, event: VoiceEvent, chance = 1): void {
    const now = performance.now();
    if (event === 'defeat') {
      if (this.defeatPlayed.has(character)) return;
      this.defeatPlayed.add(character);
    } else {
      const last = this.voiceLast.get(character) ?? -Infinity;
      if (now - last < VOICE_COOLDOWN_MS) return;
      if (Math.random() > chance) return;
    }
    this.voiceLast.set(character, now);
    this.playFile(
      { files: voiceFiles(character, event), bus: 'voice', group: `voice:${character}`, maxPoly: 1, gain: 0.85 },
      `voice:${character}:${event}`,
    );
  }

  /** Briefly duck the music bed under heavy impacts. */
  duckMusic(ms = 260): void {
    const ctx = this.ctx;
    const music = this.buses.music;
    if (!ctx || !music) return;
    const s = settings.get();
    const t = ctx.currentTime;
    this.duckUntil = performance.now() + ms;
    music.gain.cancelScheduledValues(t);
    music.gain.setValueAtTime(s.musicVolume * 0.35, t);
    music.gain.linearRampToValueAtTime(s.musicVolume, t + ms / 1000);
  }

  // ------------------------------------------------------------- music

  music(track: MusicKey): void {
    if (track === this.currentTrack) return;
    this.stopMusic();
    this.currentTrack = track;
    if (track === 'none') return;
    const ctx = this.ctx;
    const musicBus = this.bus('music');
    if (!ctx || !musicBus) return;
    const recipe = MUSIC_RECIPES[track];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 1.2);
    gain.connect(musicBus);

    const oscs: OscillatorNode[] = [];
    const freqs = [recipe.root, recipe.root * 1.005, recipe.root * (recipe.minor ? 1.189 : 1.26), recipe.root * 1.5];
    for (const f of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.22;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      o.connect(og).connect(lp).connect(gain);
      o.start();
      oscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    const beatMs = 60000 / recipe.bpm;
    const pulseTimer = window.setInterval(() => {
      if (this.currentTrack !== track) return;
      const c = this.ctx;
      if (!c || c.state !== 'running' || performance.now() < this.duckUntil) return;
      const t = c.currentTime;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      g.connect(gain);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(recipe.root / 2, t);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.24);
    }, beatMs);

    this.musicNodes = { gain, oscillators: oscs, lfo, pulseTimer };
  }

  stopMusic(fadeSec = 0.5): void {
    const m = this.musicNodes;
    this.musicNodes = null;
    this.currentTrack = 'none';
    if (!m) return;
    const ctx = this.ctx;
    if (m.pulseTimer != null) window.clearInterval(m.pulseTimer);
    if (ctx) {
      m.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
    }
    window.setTimeout(() => {
      for (const o of m.oscillators) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
      try {
        m.lfo.stop();
      } catch {
        /* already stopped */
      }
      m.gain.disconnect();
    }, fadeSec * 1000 + 100);
  }
}

/** Shared instance — scenes import this rather than constructing their own. */
export const audio = new AudioManager();
