import { describe, expect, it } from 'vitest';
import { PROCESSED_ANIMATIONS } from '../../src/game/data/processedAssets';
import { ENEMY_CONFIGS, KAIRO_CONFIG } from '../../src/game/data/fighterConfigs';

const ANIMS = PROCESSED_ANIMATIONS as Record<string, { url: string; source: string; frameCount: number }>;

/** Legacy strips explicitly allowed (no HD counterpart exists — see docs/reports/missing-vael-hd-assets.md). */
const LEGACY_ALLOWLIST = new Set<string>(); // no legacy strips remain active

describe('HD sprite integration', () => {
  it('every Guardian animation resolves to a normalized HD asset', () => {
    for (const key of Object.keys(ANIMS).filter((k) => k.startsWith('characters.guardian.'))) {
      expect(ANIMS[key]!.source, key).toMatch(/^Assets\/sprites\/guardian\//);
    }
  });

  it('Vael idle and every available Vael HD animation resolve to HD assets', () => {
    // the final Vael identity set lives in the extracted _vael_hd_new batch
    expect(ANIMS['characters.vael.idle']!.source).toMatch(/_vael_hd_new\/.*vael_idle_hd_sheet\.png$/);
    for (const key of Object.keys(ANIMS).filter((k) => k.startsWith('characters.vael.'))) {
      if (LEGACY_ALLOWLIST.has(key)) continue;
      expect(ANIMS[key]!.source, key).toMatch(/^Assets\/sprites\/vael\//);
    }
  });

  it('every Raider animation resolves to a normalized HD asset', () => {
    for (const key of Object.keys(ANIMS).filter((k) => k.startsWith('characters.raider.'))) {
      expect(ANIMS[key]!.source, key).toMatch(/^Assets\/sprites\/raider\//);
    }
  });

  it('no replaced animation resolves to a legacy combat-sheet file', () => {
    for (const [key, meta] of Object.entries(ANIMS)) {
      if (!/^characters\.(guardian|vael|raider)\./.test(key) || LEGACY_ALLOWLIST.has(key)) continue;
      expect(meta.source, key).not.toMatch(/combat_sprite_sheet/);
    }
  });

  it('rendered world height is one constant per fighter across ALL animation states', () => {
    // scale derives from each strip's bakedStandingPx, so scale × baked height
    // must equal the fighter's world height for EVERY binding — this is the
    // no-size-pop invariant (texel density may differ, size may not)
    const BAKED = PROCESSED_ANIMATIONS as Record<string, { bakedStandingPx?: number }>;
    for (const config of [KAIRO_CONFIG, ENEMY_CONFIGS.raider, ENEMY_CONFIGS.guardian, ENEMY_CONFIGS.vael]) {
      const worldHeights = Object.entries(config.animations).map(([name, b]) => {
        const baked = BAKED[b.textureKey]?.bakedStandingPx;
        expect(baked, `${config.id}.${name} missing bakedStandingPx`).toBeDefined();
        return b.scale * (baked ?? 0);
      });
      const first = worldHeights[0] ?? 0;
      for (const h of worldHeights) {
        expect(Math.abs(h - first), `${config.id} world height must not vary between states`).toBeLessThan(0.6);
      }
    }
  });

  it('every configured binding has a processed strip with frames', () => {
    for (const config of [ENEMY_CONFIGS.guardian, ENEMY_CONFIGS.vael, ENEMY_CONFIGS.raider]) {
      for (const [name, binding] of Object.entries(config.animations)) {
        const rec = ANIMS[binding.textureKey];
        expect(rec, `${config.id}.${name}`).toBeDefined();
        expect(rec!.frameCount, `${config.id}.${name}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('dodge and run states are wired for the HD enemies', () => {
    expect(ENEMY_CONFIGS.raider.animations['dodge']).toBeDefined();
    expect(ENEMY_CONFIGS.vael.animations['dodge']).toBeDefined();
    expect(ENEMY_CONFIGS.raider.animations['run']).toBeDefined();
    expect(ENEMY_CONFIGS.guardian.animations['run']).toBeDefined();
    expect(ENEMY_CONFIGS.vael.animations['run']).toBeDefined();
  });
});
