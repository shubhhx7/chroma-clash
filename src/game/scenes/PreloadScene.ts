/**
 * Loads the Phase 1 asset set (processed art only — reference sheets are
 * never preloaded into gameplay), shows progress, records failures readably
 * and registers animations.
 */
import Phaser from 'phaser';
import { REGISTRY, SCENES } from '../config/constants';
import { PROCESSED_ANIMATIONS, PROCESSED_STILLS } from '../data/processedAssets';
import { AnimationRegistry } from '../animation/AnimationRegistry';
import { versioned } from '../data/assetVersion';

/**
 * Enemy fighter strips are NOT preloaded here — only one enemy exists per
 * fight, so BattleScene lazy-loads the current opponent and unloads the
 * previous one. This bounds resident texture memory (mobile GPUs).
 * The dev Asset Gallery still loads everything.
 */
const ENEMY_TEXTURE = /^characters\.(raider|guardian|vael)\./;

export class PreloadScene extends Phaser.Scene {
  private loadErrors: string[] = [];

  constructor() {
    super(SCENES.PRELOAD);
  }

  preload(): void {
    const { width, height } = this.scale;
    const barW = Math.min(420, width * 0.6);
    const barBg = this.add.rectangle(width / 2, height / 2, barW, 10, 0x12233d).setOrigin(0.5);
    const bar = this.add.rectangle(width / 2 - barW / 2, height / 2, 1, 10, 0x6de3ff).setOrigin(0, 0.5);
    const label = this.add
      .text(width / 2, height / 2 - 26, 'LOADING PRISMFALL COURTYARD', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        color: '#9fd8ff',
      })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.width = Math.max(1, barW * p);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      const msg = `Failed to load asset '${file.key}' from ${file.url}`;
      this.loadErrors.push(msg);
      console.error(`[ChromaClash] ${msg}`);
    });
    this.load.on(Phaser.Loader.Events.COMPLETE, () => {
      barBg.destroy();
      bar.destroy();
      label.destroy();
    });

    // Animations load as uniform-cell spritesheets produced by the pipeline.
    // Enemy strips are deferred to BattleScene except in the dev gallery.
    const loadEverything = new URLSearchParams(window.location.search).has('debugAssets');
    for (const [key, meta] of Object.entries(PROCESSED_ANIMATIONS)) {
      if (!loadEverything && ENEMY_TEXTURE.test(key)) continue;
      this.load.spritesheet(key, versioned(meta.url), {
        frameWidth: meta.frameWidth,
        frameHeight: meta.frameHeight,
      });
    }
    for (const [key, meta] of Object.entries(PROCESSED_STILLS)) {
      this.load.image(key, versioned(meta.url));
    }

    if (import.meta.env.DEV) {
      // dev assertion: replaced fighters must never load from a legacy source
      const allow = new Set<string>();
      for (const [key, meta] of Object.entries(PROCESSED_ANIMATIONS)) {
        const record = meta as { source?: string };
        if (/^characters\.(guardian|vael|raider)\./.test(key) && !allow.has(key)) {
          console.assert(
            record.source?.startsWith('Assets/sprites/') ?? true,
            `[ChromaClash] ${key} resolves to a legacy low-res source: ${record.source}`,
          );
        }
      }
    }
  }

  create(): void {
    this.registry.set(REGISTRY.LOAD_ERRORS, this.loadErrors);
    AnimationRegistry.registerAll(this);

    if (this.loadErrors.length > 0 && import.meta.env.DEV) {
      // fail loudly (but readably) in development
      this.add
        .text(16, 16, `ASSET ERRORS (${this.loadErrors.length}):\n${this.loadErrors.join('\n')}`, {
          fontFamily: 'Consolas, monospace',
          fontSize: '12px',
          color: '#ff7d7d',
          backgroundColor: 'rgba(20,0,0,0.85)',
          padding: { x: 8, y: 6 },
          wordWrap: { width: this.scale.width - 32 },
        })
        .setDepth(2000);
      this.time.delayedCall(4000, () => this.startNext());
      return;
    }
    this.startNext();
  }

  private startNext(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debugAssets') === '1') {
      this.scene.start(SCENES.ASSET_GALLERY);
    } else if (import.meta.env.DEV && params.has('cycle')) {
      this.scene.start(SCENES.CYCLE); // dev visual-regression cycle
    } else if (params.get('scene') === 'battle') {
      this.scene.start(SCENES.BATTLE); // direct battle entry (automation / deep link)
    } else {
      this.scene.start(SCENES.MENU);
    }
  }
}
