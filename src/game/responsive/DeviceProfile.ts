/**
 * Device profile detection. Uses pointer coarseness + touch points + viewport
 * size — never user-agent strings.
 */
export type DeviceKind = 'desktop' | 'tablet' | 'phone';

export interface DeviceProfile {
  kind: DeviceKind;
  isTouch: boolean;
  /** show on-canvas touch controls */
  wantsTouchControls: boolean;
  /** touch control diameter in CSS px */
  controlSizePx: number;
}

export function detectDeviceProfile(win: Window = window): DeviceProfile {
  const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = win.navigator?.maxTouchPoints ?? 0;
  const isTouch = coarse || touchPoints > 1;
  const shortSide = Math.min(win.innerWidth, win.innerHeight);

  let kind: DeviceKind = 'desktop';
  if (isTouch) {
    kind = shortSide >= 600 ? 'tablet' : 'phone';
  }

  // clamp() equivalents from the spec: phone ~72-96px, tablet ~80-112px
  const controlSizePx =
    kind === 'phone'
      ? Math.min(96, Math.max(72, shortSide * 0.2))
      : kind === 'tablet'
        ? Math.min(112, Math.max(80, shortSide * 0.13))
        : 88;

  return { kind, isTouch, wantsTouchControls: isTouch, controlSizePx };
}
