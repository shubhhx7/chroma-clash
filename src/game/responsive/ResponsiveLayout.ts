/**
 * Screen-space (CSS px) layout anchors for HUD and touch controls, respecting
 * safe-area insets. Pure math — unit testable.
 */
import type { SafeAreaInsets } from './SafeAreaService';
import { MIN_TOUCH_PX } from '../config/constants';

export interface HudLayout {
  barWidth: number;
  barHeight: number;
  playerBarX: number;
  playerBarY: number;
  enemyBarX: number;
  enemyBarY: number;
  pauseX: number;
  pauseY: number;
  pauseSize: number;
  centerX: number;
  centerY: number;
}

export interface TouchLayout {
  size: number;
  leftBtnX: number;
  leftBtnY: number;
  rightBtnX: number;
  rightBtnY: number;
  attackX: number;
  attackY: number;
  heavyX: number;
  heavyY: number;
  dashX: number;
  dashY: number;
  jumpX: number;
  jumpY: number;
  blockX: number;
  blockY: number;
  specialX: number;
  specialY: number;
}

export function computeHudLayout(cssWidth: number, cssHeight: number, safe: SafeAreaInsets): HudLayout {
  const margin = 12;
  const left = safe.left + margin;
  const right = cssWidth - safe.right - margin;
  const top = safe.top + margin;
  const barWidth = Math.min(cssWidth * 0.36, 480);
  const barHeight = barWidth * (109 / 1140); // health bar art aspect
  // floor is the 44px minimum touch target: h * 0.09 is only 35px on a
  // 390px-tall landscape phone. Desktop (720px+) is unaffected, still 56.
  const pauseSize = Math.max(MIN_TOUCH_PX, Math.min(56, cssHeight * 0.09));
  return {
    barWidth,
    barHeight,
    playerBarX: left,
    playerBarY: top,
    enemyBarX: right - barWidth,
    enemyBarY: top,
    pauseX: right - pauseSize / 2,
    pauseY: top + barHeight + pauseSize * 0.75,
    pauseSize,
    centerX: cssWidth / 2,
    centerY: cssHeight / 2,
  };
}

export function computeTouchLayout(
  cssWidth: number,
  cssHeight: number,
  safe: SafeAreaInsets,
  controlSizePx: number,
): TouchLayout {
  const size = controlSizePx;
  // The primary attack art renders slightly larger than the nominal control
  // diameter. Budget for that actual radius so its pixels and hit area stay
  // inside the safe viewport instead of clipping at the right/bottom edge.
  const edge = Math.max(12, size * 0.18);
  const largestRadius = size * 0.58;
  const bottom = cssHeight - safe.bottom - edge - largestRadius;
  const left = safe.left + edge + size / 2;
  const right = cssWidth - safe.right - edge - largestRadius;
  const columnGap = size * 1.18;
  const rowGap = size * 1.16;
  return {
    size,
    // bottom-left: movement
    leftBtnX: left,
    leftBtnY: bottom,
    rightBtnX: left + size * 1.25,
    rightBtnY: bottom,
    // bottom-right action cluster: a spacious 3 x 2 grid fits all six
    // actions, including Dash, without edge clipping or button overlap.
    attackX: right,
    attackY: bottom,
    heavyX: right - columnGap,
    heavyY: bottom,
    dashX: right - columnGap * 2,
    dashY: bottom,
    jumpX: right,
    jumpY: bottom - rowGap,
    blockX: right - columnGap,
    blockY: bottom - rowGap,
    specialX: right - columnGap * 2,
    specialY: bottom - rowGap,
  };
}
