import { describe, expect, it } from 'vitest';
import { ENEMY_CONFIGS, KAIRO_CONFIG } from '../../src/game/data/fighterConfigs';
import type { FighterConfig } from '../../src/game/data/fighterConfigs';

const ALL: FighterConfig[] = [KAIRO_CONFIG, ENEMY_CONFIGS.raider, ENEMY_CONFIGS.guardian, ENEMY_CONFIGS.vael];

describe('attack definition integrity', () => {
  for (const config of ALL) {
    describe(config.id, () => {
      it('every attack has a bound animation', () => {
        for (const atk of config.attacks) {
          expect(config.animations[atk.animation], `${atk.id} animation '${atk.animation}'`).toBeDefined();
        }
      });

      it('hitboxes exist ONLY on declared active frames', () => {
        for (const atk of config.attacks) {
          for (const frame of Object.keys(atk.hitboxByFrame).map(Number)) {
            expect(atk.activeFrames, `${atk.id} frame ${frame}`).toContain(frame);
          }
          // and every active frame carries a hitbox
          for (const frame of atk.activeFrames) {
            expect(atk.hitboxByFrame[frame], `${atk.id} active frame ${frame} lacks a hitbox`).toBeDefined();
          }
        }
      });

      it('frame windows do not overlap and damage is positive', () => {
        for (const atk of config.attacks) {
          const startup = new Set(atk.startupFrames);
          for (const f of atk.activeFrames) expect(startup.has(f), `${atk.id} frame ${f} in startup+active`).toBe(false);
          expect(atk.damage).toBeGreaterThan(0);
          expect(atk.hitStunMs).toBeGreaterThan(0);
        }
      });

      it('chain targets resolve', () => {
        for (const atk of config.attacks) {
          if (atk.chainInto) {
            expect(config.attacks.some((a) => a.id === atk.chainInto), `${atk.id} -> ${atk.chainInto}`).toBe(true);
          }
        }
      });
    });
  }

  it('the SPECIAL action is meter-gated and mapped for Kairo', () => {
    const special = KAIRO_CONFIG.attacks.find((a) => a.id === 'kairo-special');
    expect(special).toBeDefined();
    expect(special?.energyCost).toBe(100);
    expect(special?.animation).toBe('kick');
  });

  it('the KICK action exists as chain finisher and direct attack', () => {
    const kick = KAIRO_CONFIG.attacks.find((a) => a.id === 'kairo-kick');
    expect(kick).toBeDefined();
    const light2 = KAIRO_CONFIG.attacks.find((a) => a.id === 'kairo-light-2');
    expect(light2?.chainInto).toBe('kairo-kick');
  });

  it('Vael has the Violet Rift Slash special (HD rift-pillar animation)', () => {
    const rift = ENEMY_CONFIGS.vael.attacks.find((a) => a.id === 'vael-special');
    expect(rift).toBeDefined();
    // the legacy 'special' strip was a different villain design — retired;
    // the special plays his HD rift summon with amplified damage/VFX
    expect(rift?.animation).toBe('attack2');
    expect(rift?.damage).toBeGreaterThanOrEqual(20);
  });
});
