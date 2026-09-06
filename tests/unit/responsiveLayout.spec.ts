import { describe, expect, it } from 'vitest';
import { computeTouchLayout } from '../../src/game/responsive/ResponsiveLayout';
import type { SafeAreaInsets } from '../../src/game/responsive/SafeAreaService';

const VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 915, height: 412 },
  { width: 740, height: 360 },
  { width: 812, height: 375 },
  { width: 932, height: 430 },
] as const;

const MULTIPLIERS = {
  left: 1,
  right: 1,
  attack: 1.14,
  heavy: 0.92,
  dash: 0.9,
  jump: 0.88,
  block: 0.88,
  special: 0.95,
} as const;

describe('mobile touch-control layout', () => {
  it.each(VIEWPORTS)('keeps every control inside and separated at $width x $height', ({ width, height }) => {
    const safe: SafeAreaInsets = { top: 0, right: 34, bottom: 21, left: 44 };
    const size = Math.min(96, Math.max(72, Math.min(width, height) * 0.2));
    const layout = computeTouchLayout(width, height, safe, size);
    const controls = [
      { name: 'left', x: layout.leftBtnX, y: layout.leftBtnY },
      { name: 'right', x: layout.rightBtnX, y: layout.rightBtnY },
      { name: 'attack', x: layout.attackX, y: layout.attackY },
      { name: 'heavy', x: layout.heavyX, y: layout.heavyY },
      { name: 'dash', x: layout.dashX, y: layout.dashY },
      { name: 'jump', x: layout.jumpX, y: layout.jumpY },
      { name: 'block', x: layout.blockX, y: layout.blockY },
      { name: 'special', x: layout.specialX, y: layout.specialY },
    ].map((control) => ({ ...control, diameter: size * MULTIPLIERS[control.name as keyof typeof MULTIPLIERS] }));

    for (const control of controls) {
      const radius = control.diameter / 2;
      expect(control.x - radius, `${control.name} left edge`).toBeGreaterThanOrEqual(safe.left + 11.9);
      expect(control.x + radius, `${control.name} right edge`).toBeLessThanOrEqual(width - safe.right - 11.9);
      expect(control.y - radius, `${control.name} top edge`).toBeGreaterThanOrEqual(0);
      expect(control.y + radius, `${control.name} bottom edge`).toBeLessThanOrEqual(height - safe.bottom - 11.9);
    }

    for (let a = 0; a < controls.length; a++) {
      for (let b = a + 1; b < controls.length; b++) {
        const first = controls[a];
        const second = controls[b];
        if (!first || !second) continue;
        const separated =
          Math.abs(first.x - second.x) >= (first.diameter + second.diameter) / 2 ||
          Math.abs(first.y - second.y) >= (first.diameter + second.diameter) / 2;
        expect(separated, `${first.name} overlaps ${second.name}`).toBe(true);
      }
    }
  });
});
