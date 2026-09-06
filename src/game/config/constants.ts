/** Central gameplay + layout constants. No magic numbers in scene code. */

/** Logical design height in world units; camera always shows exactly this much vertically (when wide enough). */
export const DESIGN_HEIGHT = 720;

/** Visible logical width is clamped to this range for LAYOUT purposes. */
export const MIN_LOGICAL_WIDTH = 960;
export const MAX_LOGICAL_WIDTH = 1600;

/** Renderer resolution cap (device pixel ratio). */
export const MAX_DPR = 2;

/** Minimum comfortable touch target, in CSS px (Apple/Material guidance). */
export const MIN_TOUCH_PX = 44;

/** World-space ground line (feet baseline), measured from the top of the 720-unit view. */
export const GROUND_Y = 620;

/** Half-width of the combat area fighters may move within (world units from center). */
export const STAGE_HALF_WIDTH = 640;

/** Fighters cannot approach each other closer than this (soft body separation). */
export const FIGHTER_MIN_GAP = 90;

/** Minimum usable play area before the desktop compact-size warning appears (CSS px). */
export const MIN_PLAY_WIDTH = 480;
export const MIN_PLAY_HEIGHT = 270;

/** Scene keys. */
export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  SPLASH: 'SplashScene',
  MENU: 'MenuScene',
  WEAPON_SELECT: 'WeaponSelectScene',
  BATTLE: 'BattleScene',
  UPGRADE: 'UpgradeScene',
  RESULT: 'ResultScene',
  ASSET_GALLERY: 'AssetGalleryScene',
  CYCLE: 'CycleScene',
} as const;

/** Registry keys for cross-scene services. */
export const REGISTRY = {
  VIEWPORT: 'viewport-service',
  SAFE_AREA: 'safe-area-service',
  DEVICE_PROFILE: 'device-profile',
  LOAD_ERRORS: 'asset-load-errors',
  RUN_STATE: 'run-state',
  LAST_RESULT: 'last-fight-result',
} as const;

/** Combat event names (scene-level event bus). */
export const COMBAT_EVENTS = {
  HIT_CONFIRMED: 'combat:hit-confirmed',
  HIT_BLOCKED: 'combat:hit-blocked',
  GUARD_BREAK: 'combat:guard-break',
  PARRY: 'combat:parry',
  HEALTH_CHANGED: 'combat:health-changed',
  KO: 'combat:ko',
  COMBO_CHANGED: 'combat:combo-changed',
} as const;

/** Jump physics (world units). */
export const JUMP_VELOCITY = 1050;
export const GRAVITY = 2900;

/** Special meter. */
export const ENERGY_MAX = 100;
