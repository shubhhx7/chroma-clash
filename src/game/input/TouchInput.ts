/**
 * Touch input source backed by the on-canvas TouchControls UI. The UI pushes
 * press/release edges here; this class tracks held state and just-pressed
 * edges, and clears everything when the browser loses focus (stuck-input
 * protection).
 */
import { InputAction, type InputSource } from './InputAction';

export class TouchInput implements InputSource {
  private down = new Set<InputAction>();
  private pressedThisFrame = new Set<InputAction>();
  private consumed = new Set<InputAction>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => this.reset());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.reset();
      });
      window.addEventListener('cc-gate-change', () => this.reset());
      window.addEventListener('resize', () => this.reset());
    }
  }

  /** Called by TouchControls on pointer down. */
  press(action: InputAction): void {
    if (!this.down.has(action)) this.pressedThisFrame.add(action);
    this.down.add(action);
  }

  /** Called by TouchControls on pointer up/cancel/out. */
  release(action: InputAction): void {
    this.down.delete(action);
  }

  isDown(action: InputAction): boolean {
    return this.down.has(action);
  }

  justPressed(action: InputAction): boolean {
    if (this.pressedThisFrame.has(action) && !this.consumed.has(action)) {
      this.consumed.add(action);
      return true;
    }
    return false;
  }

  update(): void {
    this.pressedThisFrame.clear();
    this.consumed.clear();
  }

  reset(): void {
    this.down.clear();
    this.pressedThisFrame.clear();
    this.consumed.clear();
  }
}
