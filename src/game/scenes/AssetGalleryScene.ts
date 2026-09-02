/**
 * Developer-only Asset Gallery: pages through every record in the asset
 * manifest, shows classification/processing/wiring status and previews the
 * processed outputs (plus the raw source in dev via the /raw/ middleware).
 * Opened with ?debugAssets=1 or F4 (dev). Not part of production navigation.
 */
import Phaser from 'phaser';
import { SCENES } from '../config/constants';
import { ASSET_MANIFEST, type AssetManifestRecord } from '../data/assetManifest';

const CATEGORIES = ['all', 'characters', 'arena', 'ui', 'vfx', 'branding', 'weapons'] as const;

export class AssetGalleryScene extends Phaser.Scene {
  private index = 0;
  private category: (typeof CATEGORIES)[number] = 'all';
  private infoText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private previewImage: Phaser.GameObjects.Image | null = null;
  private rawImage: Phaser.GameObjects.Image | null = null;

  constructor() {
    super(SCENES.ASSET_GALLERY);
  }

  private records(): AssetManifestRecord[] {
    if (this.category === 'all') return [...ASSET_MANIFEST];
    return ASSET_MANIFEST.filter((r) => r.category === this.category);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0f1c');
    this.cameras.main.setZoom(Math.min(window.devicePixelRatio || 1, 2));
    this.cameras.main.centerOn(this.scale.width / (2 * Math.min(window.devicePixelRatio || 1, 2)), this.scale.height / (2 * Math.min(window.devicePixelRatio || 1, 2)));

    this.add
      .text(12, 8, 'ASSET GALLERY (dev)  —  N next · P prev · 1-7 filter · ESC back', {
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        color: '#6de3ff',
      })
      .setDepth(10);
    this.infoText = this.add
      .text(12, 30, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#d6ecff',
        backgroundColor: 'rgba(6,10,20,0.8)',
        padding: { x: 6, y: 4 },
        wordWrap: { width: 640 },
      })
      .setDepth(10);
    this.statusText = this.add
      .text(12, 200, '', {
        fontFamily: 'Consolas, monospace',
        fontSize: '12px',
        color: '#ffb27d',
      })
      .setDepth(10);

    const kb = this.input.keyboard;
    kb?.on('keydown-N', () => this.step(1));
    kb?.on('keydown-P', () => this.step(-1));
    kb?.on('keydown-ESC', () => this.scene.start(SCENES.BATTLE));
    CATEGORIES.forEach((cat, i) => {
      kb?.on(`keydown-${i + 1 === 10 ? 'ZERO' : ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'][i]}`, () => {
        this.category = cat;
        this.index = 0;
        this.show();
      });
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.step(pointer.x > this.scale.width / 2 ? 1 : -1);
    });

    this.show();
  }

  private step(dir: number): void {
    const list = this.records();
    this.index = (this.index + dir + list.length) % list.length;
    this.show();
  }

  private show(): void {
    const list = this.records();
    const rec = list[this.index];
    if (!rec) return;

    this.infoText.setText(
      [
        `[${this.index + 1}/${list.length}] filter=${this.category}`,
        `id:             ${rec.id}`,
        `source:         ${rec.sourcePath}`,
        `category:       ${rec.category} / ${rec.system}`,
        `classification: ${rec.classification}`,
        `processing:     ${rec.processingStatus}`,
        `wired:          ${rec.wired ? 'yes' : 'no'}   scene: ${rec.runtimeScene ?? '—'}`,
        `use:            ${rec.expectedUse}`,
        rec.notes ? `notes:          ${rec.notes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    this.previewImage?.destroy();
    this.previewImage = null;
    this.rawImage?.destroy();
    this.rawImage = null;
    this.statusText.setText('');

    const centerY = this.scale.height / (2 * Math.min(window.devicePixelRatio || 1, 2)) + 90;

    // processed preview (first processed output)
    const processed = rec.processedPaths[0];
    if (processed) {
      const url = processed.replace(/^assets_processed\//u, '');
      const key = `gallery:${url}`;
      const place = (): void => {
        this.previewImage = this.add.image(200, centerY, key).setDepth(5);
        const tex = this.textures.get(key).getSourceImage() as { width: number; height: number };
        const s = Math.min(360 / tex.width, 260 / tex.height, 1);
        this.previewImage.setScale(s);
      };
      if (this.textures.exists(key)) place();
      else {
        this.load.image(key, url);
        this.load.once(Phaser.Loader.Events.COMPLETE, place);
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
          this.statusText.setText(`MISSING processed file: ${processed}`);
        });
        this.load.start();
      }
    } else if (rec.classification !== 'reference-only') {
      this.statusText.setText(rec.processingStatus === 'pending' ? 'not processed yet (planned)' : '');
    }

    // raw source preview — dev server only (served via /raw/ middleware)
    if (import.meta.env.DEV) {
      const rawUrl = `/raw/${rec.sourcePath.replace(/^Assets\//u, '')}`;
      const rawKey = `raw:${rec.sourcePath}`;
      const placeRaw = (): void => {
        this.rawImage = this.add.image(620, centerY, rawKey).setDepth(5);
        const tex = this.textures.get(rawKey).getSourceImage() as { width: number; height: number };
        const s = Math.min(420 / tex.width, 300 / tex.height, 1);
        this.rawImage.setScale(s);
      };
      if (this.textures.exists(rawKey)) placeRaw();
      else {
        this.load.image(rawKey, rawUrl);
        this.load.once(Phaser.Loader.Events.COMPLETE, placeRaw);
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
          this.statusText.setText(`${this.statusText.text}\nraw preview unavailable: ${rawUrl}`.trim());
        });
        this.load.start();
      }
    }
  }
}
