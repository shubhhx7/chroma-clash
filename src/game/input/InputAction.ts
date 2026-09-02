/** Logical input actions shared by keyboard and touch sources. */
export enum InputAction {
  MOVE_LEFT = 'MOVE_LEFT',
  MOVE_RIGHT = 'MOVE_RIGHT',
  ATTACK = 'ATTACK',
  HEAVY = 'HEAVY',
  KICK = 'KICK',
  DASH = 'DASH',
  BLOCK = 'BLOCK',
  SPECIAL = 'SPECIAL',
  JUMP = 'JUMP',
  PAUSE = 'PAUSE',
  RESTART = 'RESTART',
  DEBUG_TOGGLE = 'DEBUG_TOGGLE',
  ASSET_GALLERY = 'ASSET_GALLERY',
}

/** A source of held/pressed action states (keyboard, touch). */
export interface InputSource {
  isDown(action: InputAction): boolean;
  /** true exactly once per press */
  justPressed(action: InputAction): boolean;
  update(): void;
  reset(): void;
}
