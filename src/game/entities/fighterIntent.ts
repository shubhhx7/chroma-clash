/** Per-frame fighter intent — kept Phaser-free so AI logic is unit-testable. */

export interface FighterIntent {
  moveX: -1 | 0 | 1;
  /** light attack press (edge) */
  attack: boolean;
  /** explicit attack id override (used by AI) */
  attackId?: string;
  heavy: boolean;
  kick: boolean;
  special: boolean;
  jump: boolean;
  dash: boolean;
  /** held */
  block: boolean;
  /** hop backwards playing the dodge animation (enemies with dodge sheets) */
  dodge?: boolean;
  /** sprint using the run animation while moving (enemy charge) */
  run?: boolean;
}

export const EMPTY_INTENT: FighterIntent = {
  moveX: 0,
  attack: false,
  heavy: false,
  kick: false,
  special: false,
  jump: false,
  dash: false,
  block: false,
};
