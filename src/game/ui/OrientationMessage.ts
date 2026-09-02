/**
 * Compact-size warning for small DESKTOP windows (the touch-device portrait
 * case is handled by the DOM OrientationGate). Shows a subtle pill when the
 * usable play area drops below the minimum safe dimensions.
 */
import { MIN_PLAY_HEIGHT, MIN_PLAY_WIDTH } from '../config/constants';

export class OrientationMessage {
  private el: HTMLDivElement | null = null;

  private ensure(): HTMLDivElement {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'size-warning';
      this.el.textContent = 'Window is very small — enlarge for the best experience';
      this.el.hidden = true;
      document.body.appendChild(this.el);
    }
    return this.el;
  }

  update(cssWidth: number, cssHeight: number, isTouchDevice: boolean): void {
    const el = this.ensure();
    const tooSmall = cssWidth < MIN_PLAY_WIDTH || cssHeight < MIN_PLAY_HEIGHT;
    el.hidden = isTouchDevice || !tooSmall;
  }

  destroy(): void {
    this.el?.remove();
    this.el = null;
  }
}
