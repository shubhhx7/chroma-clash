import { describe, expect, it } from 'vitest';
import { computeLogicalViewport } from '../../src/game/responsive/ResponsiveViewport';
import { DEVICE_PROFILE_PRESETS } from '../../src/game/config/deviceProfiles';

describe('logical viewport computation', () => {
  it('16:9 desktop sees the standard 1280x720 view', () => {
    const v = computeLogicalViewport(1920, 1080);
    expect(v.viewHeight).toBeCloseTo(720, 5);
    expect(v.viewWidth).toBeCloseTo(1280, 5);
    expect(v.layoutWidth).toBeCloseTo(1280, 5);
  });

  it('4:3 tablet sees a narrower but complete view (>= min width)', () => {
    const v = computeLogicalViewport(1024, 768);
    expect(v.viewHeight).toBeCloseTo(720, 5);
    expect(v.viewWidth).toBeCloseTo(960, 5);
    expect(v.layoutWidth).toBeGreaterThanOrEqual(960);
  });

  it('19.5:9 phone sees extra decorative width', () => {
    const v = computeLogicalViewport(844, 390);
    expect(v.viewHeight).toBeCloseTo(720, 3);
    expect(v.viewWidth).toBeGreaterThan(1280);
  });

  it('ultrawide caps LAYOUT width but keeps full height (no distortion)', () => {
    const v = computeLogicalViewport(3440, 1440);
    expect(v.viewHeight).toBeCloseTo(720, 5);
    expect(v.layoutWidth).toBe(1600);
    expect(v.viewWidth).toBeGreaterThan(1600); // extra is decorative background
  });

  it('narrow desktop window keeps min width visible instead of cropping', () => {
    const v = computeLogicalViewport(600, 800);
    expect(v.viewWidth).toBeCloseTo(960, 5);
    expect(v.viewHeight).toBeGreaterThan(720);
  });

  it('handles all device presets without degenerate output', () => {
    for (const p of DEVICE_PROFILE_PRESETS) {
      const v = computeLogicalViewport(p.cssWidth, p.cssHeight);
      expect(v.zoom).toBeGreaterThan(0);
      expect(v.viewWidth).toBeGreaterThanOrEqual(959.99);
      expect(v.layoutWidth).toBeLessThanOrEqual(1600);
    }
  });
});
