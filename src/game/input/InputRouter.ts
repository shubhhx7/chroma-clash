/**
 * Merges all input sources (keyboard + touch) into per-frame intents consumed
 * by the player fighter. Movement plus any action work simultaneously
 * (multi-touch / key rollover). Action presses are edge-triggered, buffered
 * for one frame and consumed once.
 */
import { InputAction, type InputSource } from './InputAction';

const BUFFERED_ACTIONS = [
  InputAction.ATTACK,
  InputAction.HEAVY,
  InputAction.KICK,
  InputAction.SPECIAL,
  InputAction.JUMP,
  InputAction.DASH,
] as const;

export class InputRouter {
  private queued = new Set<InputAction>();

  constructor(private readonly sources: InputSource[]) {}

  /** Call once per frame BEFORE reading intents. */
  update(): void {
    for (const s of this.sources) {
      for (const action of BUFFERED_ACTIONS) {
        if (s.justPressed(action)) this.queued.add(action);
      }
    }
  }

  /** Call once per frame AFTER reading intents. */
  postUpdate(): void {
    for (const s of this.sources) s.update();
    this.queued.clear();
  }

  get moveX(): -1 | 0 | 1 {
    const left = this.sources.some((s) => s.isDown(InputAction.MOVE_LEFT));
    const right = this.sources.some((s) => s.isDown(InputAction.MOVE_RIGHT));
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  /** Edge-triggered action press, consumed once. */
  consumePress(action: InputAction): boolean {
    if (this.queued.has(action)) {
      this.queued.delete(action);
      return true;
    }
    return false;
  }

  isDown(action: InputAction): boolean {
    return this.sources.some((s) => s.isDown(action));
  }

  justPressed(action: InputAction): boolean {
    return this.sources.some((s) => s.justPressed(action));
  }

  reset(): void {
    for (const s of this.sources) s.reset();
    this.queued.clear();
  }
}
