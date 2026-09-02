/**
 * Central asset key registry. Every texture key used at runtime is declared
 * here; scenes never contain raw path strings. Keys map 1:1 to processed
 * assets (see processedAssets.ts, generated from the pipeline metadata).
 */
import { PROCESSED_ANIMATIONS, PROCESSED_STILLS } from './processedAssets';

export const TEX = {
  // Kairo animation strips
  KAIRO_IDLE: 'characters.kairo.idle',
  KAIRO_WALK: 'characters.kairo.walk',
  KAIRO_WALKBACK: 'characters.kairo.walkback',
  KAIRO_RUN: 'characters.kairo.run',
  KAIRO_ATTACK1: 'characters.kairo.attack1',
  KAIRO_HEAVY: 'characters.kairo.heavy',
  KAIRO_ATTACK2: 'characters.kairo.attack2',
  KAIRO_DASH: 'characters.kairo.dash',
  KAIRO_BLOCK: 'characters.kairo.block',
  KAIRO_GETUP: 'characters.kairo.getup',
  KAIRO_HIT: 'characters.kairo.hit',
  KAIRO_KNOCKDOWN: 'characters.kairo.knockdown',
  // Guardian animation strips
  GUARDIAN_IDLE: 'characters.guardian.idle',
  GUARDIAN_WALK: 'characters.guardian.walk',
  GUARDIAN_ATTACK: 'characters.guardian.attack',
  GUARDIAN_RUN: 'characters.guardian.run',
  GUARDIAN_ATTACK2: 'characters.guardian.attack2',
  GUARDIAN_KNOCKDOWN: 'characters.guardian.knockdown',
  GUARDIAN_BLOCK: 'characters.guardian.block',
  GUARDIAN_HIT: 'characters.guardian.hit',
  GUARDIAN_DEFEAT: 'characters.guardian.defeat',
  // Vael animation strips
  VAEL_IDLE: 'characters.vael.idle',
  VAEL_WALK: 'characters.vael.walk',
  VAEL_RUN: 'characters.vael.run',
  VAEL_DODGE: 'characters.vael.dodge',
  VAEL_KNOCKDOWN: 'characters.vael.knockdown',
  VAEL_ATTACK: 'characters.vael.attack',
  VAEL_ATTACK2: 'characters.vael.attack2',
  VAEL_BLOCK: 'characters.vael.block',
  VAEL_HIT: 'characters.vael.hit',
  VAEL_DEFEAT: 'characters.vael.defeat',
  // Raider animation strips
  RAIDER_IDLE: 'characters.raider.idle',
  RAIDER_WALK: 'characters.raider.walk',
  RAIDER_RUN: 'characters.raider.run',
  RAIDER_DODGE: 'characters.raider.dodge',
  RAIDER_KNOCKDOWN: 'characters.raider.knockdown',
  RAIDER_ATTACK: 'characters.raider.attack',
  RAIDER_ATTACK2: 'characters.raider.attack2',
  RAIDER_BLOCK: 'characters.raider.block',
  RAIDER_HIT: 'characters.raider.hit',
  RAIDER_DEFEAT: 'characters.raider.defeat',
  // Arena layers
  ARENA_SKY: 'arena.prismfall.far_sky',
  ARENA_ISLANDS: 'arena.prismfall.floating_islands',
  ARENA_MOUNTAINS: 'arena.prismfall.distant_mountains',
  ARENA_RUINS: 'arena.prismfall.far_ruins',
  ARENA_HAZE: 'arena.prismfall.depth_haze',
  ARENA_ARCH_BROKEN: 'arena.prismfall.arch_broken',
  ARENA_ARCH_FULL: 'arena.prismfall.arch_full',
  ARENA_COLUMN_A: 'arena.prismfall.column_a',
  ARENA_COLUMN_B: 'arena.prismfall.column_b',
  ARENA_WALL: 'arena.prismfall.wall_section',
  ARENA_FLOOR_A: 'arena.prismfall.floor_tile_a',
  ARENA_FLOOR_B: 'arena.prismfall.floor_tile_b',
  ARENA_FLOOR_STRIP: 'arena.prismfall.floor_strip',
  ARENA_MIST: 'arena.prismfall.ground_mist',
  MAIN_LOGO: 'branding.main_logo',
  LOGO_STACKED: 'branding.logo_stacked',
  LOGO_BADGE: 'branding.logo_badge',
  // HUD
  HEALTH_FRAME: 'ui.hud.health_bar.frame_empty',
  HEALTH_FILL: 'ui.hud.health_bar.fill_full',
  HEALTH_WARNING: 'ui.hud.health_bar.frame_warning',
  ENERGY_FRAME: 'ui.hud.energy_bar.frame_empty',
  ENERGY_FILL: 'ui.hud.energy_bar.fill_full',
  OVERLAY_READY: 'ui.hud.overlay_ready',
  OVERLAY_FIGHT: 'ui.hud.overlay_fight',
  OVERLAY_FINAL_FIGHT: 'ui.hud.overlay_final_fight',
  OVERLAY_KO: 'ui.hud.overlay_ko',
  VAEL_NAMEPLATE: 'ui.hud.vael_nameplate',
  // Weapon selection
  WPN_BLADE: 'ui.weapons.blade',
  WPN_BLADE_SEL: 'ui.weapons.blade_selected',
  WPN_AXE: 'ui.weapons.axe',
  WPN_AXE_SEL: 'ui.weapons.axe_selected',
  WPN_DUAL: 'ui.weapons.dual',
  WPN_DUAL_SEL: 'ui.weapons.dual_selected',
  WPN_LOCKED: 'ui.weapons.locked',
  // Upgrade UI
  UPG_CARD: 'ui.upgrades.card_default',
  UPG_CARD_SEL: 'ui.upgrades.card_selected',
  UPG_CARD_LOCKED: 'ui.upgrades.card_locked',
  // Touch controls
  BTN_ATTACK: 'ui.controls.attack_default',
  BTN_ATTACK_PRESSED: 'ui.controls.attack_pressed',
  BTN_HEAVY: 'ui.controls.heavy_default',
  BTN_HEAVY_PRESSED: 'ui.controls.heavy_pressed',
  BTN_SPECIAL_READY: 'ui.controls.special_ready',
  BTN_SPECIAL_DISABLED: 'ui.controls.special_disabled',
  BTN_BLOCK: 'ui.controls.block_default',
  BTN_BLOCK_PRESSED: 'ui.controls.block_pressed',
  BTN_PAUSE: 'ui.controls.pause_default',
  BTN_PAUSE_PRESSED: 'ui.controls.pause_pressed',
  BTN_LEFT: 'ui.controls.move_left_default',
  BTN_LEFT_PRESSED: 'ui.controls.move_left_pressed',
  BTN_RIGHT: 'ui.controls.move_right_default',
  BTN_RIGHT_PRESSED: 'ui.controls.move_right_pressed',
  // VFX
  VFX_HIT_BLUE: 'vfx.shared.hit_spark_blue',
  VFX_HIT_RED: 'vfx.shared.hit_spark_red',
  VFX_BLOCK_SHIELD: 'vfx.shared.block_shield',
  VFX_KO_BURST: 'vfx.shared.ko_burst',
  VFX_RAIDER_SLASH: 'vfx.raider.slash_arc',
  VFX_HAMMER_IMPACT: 'vfx.guardian.hammer_impact',
  VFX_RIFT_RING: 'vfx.vael.rift_ring',
  VFX_RIFT_BURST: 'vfx.vael.rift_burst',
  VFX_CHROMA_MAIN: 'vfx.kairo.chroma_burst_main',
  VFX_CHROMA_RING: 'vfx.kairo.chroma_ring',
  VFX_CHROMA_FLASH: 'vfx.kairo.chroma_flash',
  VFX_AURA_CREST: 'vfx.vael.aura_crest',
  VFX_AURA_RING: 'vfx.vael.aura_ring',
  VFX_VAEL_TRAIL: 'vfx.vael.slash_trail',
  VFX_BOSS_PILLAR: 'vfx.shared.boss_defeat_pillar',
  VFX_BOSS_GROUND: 'vfx.shared.boss_defeat_ground',
  VFX_HEAVY_ARC: 'vfx.kairo.heavy_arc',
  VFX_DASH_DUST: 'vfx.movement.dash_dust',
  VFX_LANDING_DUST: 'vfx.movement.landing_dust',
  TUTORIAL_PAGE: 'ui.tutorial_page',
  COMBO_X2: 'ui.hud.combo.combo_x2',
  COMBO_X3: 'ui.hud.combo.combo_x3',
  COMBO_X5: 'ui.hud.combo.combo_x5',
  COMBO_X10: 'ui.hud.combo.combo_x10',
  COMBO_X15: 'ui.hud.combo.combo_x15',
  COMBO_X30: 'ui.hud.combo.combo_x30',
} as const;

export type TextureKey = (typeof TEX)[keyof typeof TEX];

export function animationAsset(key: TextureKey) {
  const rec = (PROCESSED_ANIMATIONS as Record<string, (typeof PROCESSED_ANIMATIONS)[keyof typeof PROCESSED_ANIMATIONS]>)[key];
  if (!rec) throw new Error(`No processed animation for key '${key}'`);
  return rec;
}

export function stillAsset(key: TextureKey) {
  const rec = (PROCESSED_STILLS as Record<string, (typeof PROCESSED_STILLS)[keyof typeof PROCESSED_STILLS]>)[key];
  if (!rec) throw new Error(`No processed still for key '${key}'`);
  return rec;
}

export function isAnimationKey(key: string): boolean {
  return key in PROCESSED_ANIMATIONS;
}
