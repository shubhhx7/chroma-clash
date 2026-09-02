/**
 * Reads env(safe-area-inset-*) values from CSS custom properties and converts
 * them into both CSS pixels and world units.
 */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Pure conversion helper (unit tested). */
export function insetsToWorld(insets: SafeAreaInsets, zoom: number): SafeAreaInsets {
  const z = zoom > 0 ? zoom : 1;
  return {
    top: insets.top / z,
    right: insets.right / z,
    bottom: insets.bottom / z,
    left: insets.left / z,
  };
}

export class SafeAreaService {
  private probe: HTMLDivElement | null = null;

  /** Current insets in CSS pixels. */
  read(): SafeAreaInsets {
    if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
    if (!this.probe) {
      this.probe = document.createElement('div');
      this.probe.style.cssText =
        'position:fixed;visibility:hidden;pointer-events:none;' +
        'top:env(safe-area-inset-top,0px);right:env(safe-area-inset-right,0px);' +
        'bottom:env(safe-area-inset-bottom,0px);left:env(safe-area-inset-left,0px);';
      document.body.appendChild(this.probe);
    }
    const cs = getComputedStyle(this.probe);
    return {
      top: parseFloat(cs.top) || 0,
      right: parseFloat(cs.right) || 0,
      bottom: parseFloat(cs.bottom) || 0,
      left: parseFloat(cs.left) || 0,
    };
  }

  destroy(): void {
    this.probe?.remove();
    this.probe = null;
  }
}
