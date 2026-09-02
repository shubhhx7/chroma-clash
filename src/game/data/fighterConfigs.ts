/**
 * Data-driven fighter configuration. The Fighter base class consumes these;
 * no per-character combat code.
 *
 * Binding scales derive from each strip's baked standing height, so the
 * rendered character height is constant per fighter across all states.
 */
import type { AttackDefinition, RectDefinition } from '../combat/combatTypes';
import { TEX } from './assetKeys';
import { BALANCE } from './gameBalance';
import { PROCESSED_ANIMATIONS } from './processedAssets';

export interface AnimationBinding {
  textureKey: string;
  /** world display scale for this animation's frames */
  scale: number;
}

export interface FighterConfig {
  id: string;
  displayName: string;
  maxHealth: number;
  walkSpeed: number;
  /** facing of the source art: 1 = drawn facing right, -1 = drawn facing left */
  artFacing: 1 | -1;
  animations: Record<string, AnimationBinding> & {
    idle: AnimationBinding;
    walk: AnimationBinding;
    attack: AnimationBinding;
    hit: AnimationBinding;
    defeat: AnimationBinding;
  };
  hurtbox: RectDefinition;
  attacks: AttackDefinition[];
}

/**
 * Every fighter strip records its baked standing height (bakedStandingPx,
 * from the pipeline's per-sheet calibration). A binding's runtime scale is
 * worldHeight / bakedStandingPx, so the RENDERED character height is a
 * per-fighter constant across every animation state by construction —
 * no size pops, no baseline jumps — while each strip carries the highest
 * texel density its source can support.
 */
const KAIRO_WORLD = 330;
const RAIDER_WORLD = 330;
const GUARDIAN_WORLD = 370; // heavy fighter reads ~12% taller
const VAEL_WORLD = 350; // final boss slightly taller

function binding(textureKey: string, worldHeight: number): AnimationBinding {
  const rec = (PROCESSED_ANIMATIONS as Record<string, { bakedStandingPx?: number }>)[textureKey];
  const baked = rec?.bakedStandingPx;
  if (!baked) throw new Error(`No bakedStandingPx for fighter strip '${textureKey}' — re-run assets:process + assets:manifest`);
  return { textureKey, scale: worldHeight / baked };
}

export const KAIRO_CONFIG: FighterConfig = {
  id: 'kairo',
  displayName: 'KAIRO',
  maxHealth: BALANCE.kairo.maxHealth,
  walkSpeed: BALANCE.kairo.walkSpeed,
  artFacing: 1,
  animations: {
    idle: binding(TEX.KAIRO_IDLE, KAIRO_WORLD),
    walk: binding(TEX.KAIRO_WALK, KAIRO_WORLD),
    walkback: binding(TEX.KAIRO_WALKBACK, KAIRO_WORLD),
    run: binding(TEX.KAIRO_RUN, KAIRO_WORLD),
    attack: binding(TEX.KAIRO_ATTACK1, KAIRO_WORLD),
    attack2: binding(TEX.KAIRO_ATTACK2, KAIRO_WORLD),
    dash: binding(TEX.KAIRO_DASH, KAIRO_WORLD),
    block: binding(TEX.KAIRO_BLOCK, KAIRO_WORLD),
    hit: binding(TEX.KAIRO_HIT, KAIRO_WORLD),
    defeat: binding(TEX.KAIRO_KNOCKDOWN, KAIRO_WORLD),
    // Every Kairo state renders the SAME character and the SAME Chroma
    // Blade. The older large-batch sheets (heavy/parry/kick/jump) drew a
    // different hero design holding a plain sword, so those states now reuse
    // the HD combo choreography instead of swapping Kairo mid-fight.
    heavy: binding(TEX.KAIRO_HEAVY, KAIRO_WORLD),
    parry: binding(TEX.KAIRO_ATTACK1, KAIRO_WORLD),
    kick: binding(TEX.KAIRO_ATTACK2, KAIRO_WORLD),
    jump: binding(TEX.KAIRO_DASH, KAIRO_WORLD),
    getup: binding(TEX.KAIRO_GETUP, KAIRO_WORLD),
  },
  hurtbox: { x: -55, y: -300, w: 110, h: 300 },
  attacks: [
    {
      id: 'kairo-light-1',
      animation: 'attack',
      // HD combo sheet, first half @14fps — stance, windup, overhead slash, thrust
      startupFrames: [0, 1],
      activeFrames: [2, 3],
      recoveryFrames: [],
      damage: BALANCE.kairo.attack1Damage,
      hitStunMs: BALANCE.kairo.attack1HitStunMs,
      hitStopMs: BALANCE.kairo.attack1HitStopMs,
      knockbackX: BALANCE.kairo.attack1KnockbackX,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 20, y: -330, w: 240, h: 260 },
        3: { x: 50, y: -260, w: 260, h: 180 },
      },
      canHitOncePerTarget: true,
      chainInto: 'kairo-light-2',
      chainFrames: [2, 3],
      energyGain: 10,
      airOk: true,
    },
    {
      id: 'kairo-light-2',
      animation: 'attack2',
      // HD combo sheet, second half @14fps — spin slash, lunge thrust, recover
      startupFrames: [],
      activeFrames: [0, 1],
      recoveryFrames: [2],
      damage: 12,
      hitStunMs: 380,
      hitStopMs: 80,
      knockbackX: 130,
      knockbackY: 0,
      hitboxByFrame: {
        0: { x: 10, y: -300, w: 260, h: 230 },
        1: { x: 50, y: -260, w: 280, h: 180 },
      },
      canHitOncePerTarget: true,
      chainInto: 'kairo-kick',
      chainFrames: [1, 2],
      energyGain: 10,
    },
    {
      id: 'kairo-kick',
      animation: 'kick',
      // 3 frames @14fps — spinning lunge finisher, big knockback
      startupFrames: [],
      activeFrames: [0, 1],
      recoveryFrames: [2],
      damage: 14,
      hitStunMs: 520,
      hitStopMs: 95,
      knockbackX: 280,
      knockbackY: 0,
      hitboxByFrame: {
        0: { x: 20, y: -300, w: 240, h: 230 },
        1: { x: 50, y: -280, w: 260, h: 210 },
      },
      canHitOncePerTarget: true,
      energyGain: 14,
    },
    {
      id: 'kairo-heavy',
      animation: 'heavy',
      // 6 frames @11fps — full committed swing: windup, overhead, thrust,
      // spin, lunge, recover
      startupFrames: [0, 1],
      activeFrames: [2, 3, 4],
      recoveryFrames: [5],
      damage: 22,
      hitStunMs: 650,
      hitStopMs: 115,
      knockbackX: 320,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 20, y: -330, w: 280, h: 260 },
        3: { x: 40, y: -290, w: 300, h: 220 },
        4: { x: 60, y: -260, w: 320, h: 190 },
      },
      canHitOncePerTarget: true,
      energyGain: 16,
    },
    {
      id: 'kairo-dash',
      animation: 'dash',
      // HD dash: 6 frames @14fps — forward lunge with blade extended
      startupFrames: [0, 1],
      activeFrames: [2, 3],
      recoveryFrames: [4, 5],
      damage: 13,
      hitStunMs: 400,
      hitStopMs: 85,
      knockbackX: 180,
      knockbackY: 0,
      lungeSpeed: 640,
      lungeFrames: [0, 1, 2],
      cooldownMs: 900,
      hitboxByFrame: {
        2: { x: 30, y: -270, w: 210, h: 200 },
        3: { x: 40, y: -250, w: 220, h: 180 },
      },
      canHitOncePerTarget: true,
      energyGain: 12,
    },
    {
      id: 'kairo-special',
      animation: 'kick',
      // Chroma Burst: the lunge body + the crystal burst VFX, meter-gated
      startupFrames: [],
      activeFrames: [0, 1],
      recoveryFrames: [2],
      damage: 30,
      hitStunMs: 800,
      hitStopMs: 150,
      knockbackX: 420,
      knockbackY: 0,
      hitboxByFrame: {
        0: { x: 10, y: -330, w: 300, h: 280 },
        1: { x: 30, y: -320, w: 320, h: 270 },
      },
      canHitOncePerTarget: true,
      energyCost: 100,
    },
  ],
};

export const RAIDER_CONFIG: FighterConfig = {
  id: 'raider',
  displayName: 'RAIDER',
  maxHealth: BALANCE.raider.maxHealth,
  walkSpeed: BALANCE.raider.ai.approachSpeed,
  artFacing: -1, // the Raider sheet is drawn facing left
  animations: {
    idle: binding(TEX.RAIDER_IDLE, RAIDER_WORLD),
    walk: binding(TEX.RAIDER_WALK, RAIDER_WORLD),
    run: binding(TEX.RAIDER_RUN, RAIDER_WORLD),
    dodge: binding(TEX.RAIDER_DODGE, RAIDER_WORLD),
    knockdown: binding(TEX.RAIDER_KNOCKDOWN, RAIDER_WORLD),
    attack: binding(TEX.RAIDER_ATTACK, RAIDER_WORLD),
    attack2: binding(TEX.RAIDER_ATTACK2, RAIDER_WORLD),
    block: binding(TEX.RAIDER_BLOCK, RAIDER_WORLD),
    hit: binding(TEX.RAIDER_HIT, RAIDER_WORLD),
    defeat: binding(TEX.RAIDER_DEFEAT, RAIDER_WORLD),
  },
  hurtbox: { x: -55, y: -300, w: 110, h: 300 },
  attacks: [
    {
      id: 'raider-attack-1',
      animation: 'attack',
      // 8 frames — overhead chop into thrust
      startupFrames: [0, 1, 2],
      activeFrames: [3, 4],
      recoveryFrames: [5, 6, 7],
      damage: BALANCE.raider.attackDamage,
      hitStunMs: BALANCE.raider.attackHitStunMs,
      hitStopMs: BALANCE.raider.attackHitStopMs,
      knockbackX: BALANCE.raider.attackKnockbackX,
      knockbackY: 0,
      hitboxByFrame: {
        3: { x: 25, y: -270, w: 200, h: 200 },
        4: { x: 45, y: -250, w: 220, h: 180 },
      },
      canHitOncePerTarget: true,
    },
    {
      id: 'raider-attack-2',
      animation: 'attack2',
      // 8 frames — wide low sweep with a spin recovery
      startupFrames: [0, 1],
      activeFrames: [2, 3, 4],
      recoveryFrames: [5, 6, 7],
      damage: 11,
      hitStunMs: 420,
      hitStopMs: 70,
      knockbackX: 140,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 20, y: -300, w: 210, h: 240 },
        3: { x: 40, y: -260, w: 230, h: 200 },
        4: { x: 40, y: -220, w: 240, h: 170 },
      },
      canHitOncePerTarget: true,
    },
  ],
};

export const GUARDIAN_CONFIG: FighterConfig = {
  id: 'guardian',
  displayName: 'GUARDIAN',
  maxHealth: 130,
  walkSpeed: 125,
  artFacing: -1,
  animations: {
    idle: binding(TEX.GUARDIAN_IDLE, GUARDIAN_WORLD),
    walk: binding(TEX.GUARDIAN_WALK, GUARDIAN_WORLD),
    attack: binding(TEX.GUARDIAN_ATTACK, GUARDIAN_WORLD),
    run: binding(TEX.GUARDIAN_RUN, GUARDIAN_WORLD),
    attack2: binding(TEX.GUARDIAN_ATTACK2, GUARDIAN_WORLD),
    block: binding(TEX.GUARDIAN_BLOCK, GUARDIAN_WORLD),
    hit: binding(TEX.GUARDIAN_HIT, GUARDIAN_WORLD),
    knockdown: binding(TEX.GUARDIAN_KNOCKDOWN, GUARDIAN_WORLD),
    defeat: binding(TEX.GUARDIAN_DEFEAT, GUARDIAN_WORLD),
  },
  hurtbox: { x: -65, y: -330, w: 130, h: 330 },
  attacks: [
    {
      id: 'guardian-hammer',
      animation: 'attack',
      // 8 frames @10fps — long telegraphed windup, brutal smash
      startupFrames: [0, 1, 2, 3],
      activeFrames: [4, 5, 6],
      recoveryFrames: [7],
      damage: 16,
      hitStunMs: 620,
      hitStopMs: 100,
      knockbackX: 300,
      knockbackY: 0,
      hitboxByFrame: {
        4: { x: 20, y: -300, w: 230, h: 240 },
        5: { x: 40, y: -260, w: 260, h: 210 },
        6: { x: 60, y: -240, w: 280, h: 190 },
      },
      canHitOncePerTarget: true,
    },
    {
      id: 'guardian-slam',
      animation: 'attack2',
      // 8 frames — overhead raise into a ground-shaking slam
      startupFrames: [0, 1, 2],
      activeFrames: [3, 4],
      recoveryFrames: [5, 6, 7],
      damage: 20,
      hitStunMs: 700,
      hitStopMs: 110,
      knockbackX: 360,
      knockbackY: 0,
      hitboxByFrame: {
        3: { x: 20, y: -280, w: 260, h: 230 },
        4: { x: 40, y: -230, w: 280, h: 190 },
      },
      canHitOncePerTarget: true,
    },
  ],
};

export const VAEL_CONFIG: FighterConfig = {
  id: 'vael',
  displayName: 'VAEL',
  maxHealth: 150,
  walkSpeed: 225,
  // HD batch is drawn facing right (legacy heavy/special strips are pre-flipped to match)
  artFacing: 1,
  animations: {
    idle: binding(TEX.VAEL_IDLE, VAEL_WORLD),
    walk: binding(TEX.VAEL_WALK, VAEL_WORLD),
    run: binding(TEX.VAEL_RUN, VAEL_WORLD),
    dodge: binding(TEX.VAEL_DODGE, VAEL_WORLD),
    knockdown: binding(TEX.VAEL_KNOCKDOWN, VAEL_WORLD),
    attack: binding(TEX.VAEL_ATTACK, VAEL_WORLD),
    attack2: binding(TEX.VAEL_ATTACK2, VAEL_WORLD),
    block: binding(TEX.VAEL_BLOCK, VAEL_WORLD),
    hit: binding(TEX.VAEL_HIT, VAEL_WORLD),
    defeat: binding(TEX.VAEL_DEFEAT, VAEL_WORLD),
  },
  hurtbox: { x: -58, y: -315, w: 116, h: 315 },
  attacks: [
    {
      id: 'vael-slash-1',
      animation: 'attack',
      // 8 frames — staff thrust with violet orb (long reach)
      startupFrames: [0, 1],
      activeFrames: [2, 3, 4],
      recoveryFrames: [5, 6, 7],
      damage: 10,
      hitStunMs: 350,
      hitStopMs: 60,
      knockbackX: 110,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 30, y: -280, w: 250, h: 200 },
        3: { x: 40, y: -270, w: 260, h: 190 },
        4: { x: 40, y: -260, w: 260, h: 180 },
      },
      canHitOncePerTarget: true,
    },
    {
      id: 'vael-slash-2',
      animation: 'attack2',
      // 7 frames — summons a violet rift pillar in front
      startupFrames: [0, 1],
      activeFrames: [2, 3],
      recoveryFrames: [4, 5, 6],
      damage: 12,
      hitStunMs: 400,
      hitStopMs: 70,
      knockbackX: 140,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 30, y: -340, w: 240, h: 300 },
        3: { x: 40, y: -320, w: 260, h: 280 },
      },
      canHitOncePerTarget: true,
    },
    {
      id: 'vael-special',
      animation: 'attack2',
      // Violet Rift Slash — the HD rift-pillar summon, amplified (VFX + damage);
      // the legacy 10-frame strip was a different villain design and is retired
      startupFrames: [0, 1],
      activeFrames: [2, 3],
      recoveryFrames: [4, 5, 6],
      damage: 24,
      hitStunMs: 750,
      hitStopMs: 140,
      knockbackX: 380,
      knockbackY: 0,
      hitboxByFrame: {
        2: { x: 20, y: -360, w: 280, h: 330 },
        3: { x: 40, y: -340, w: 300, h: 310 },
      },
      canHitOncePerTarget: true,
    },
  ],
};

/** Enemy roster for the three-fight run. */
export const ENEMY_CONFIGS: Record<'raider' | 'guardian' | 'vael', FighterConfig> = {
  raider: RAIDER_CONFIG,
  guardian: GUARDIAN_CONFIG,
  vael: VAEL_CONFIG,
};
