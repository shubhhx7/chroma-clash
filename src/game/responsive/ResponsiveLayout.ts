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
  const pad = Math.max(10, size * 0.18);
  const bottom = cssHeight - safe.bottom - pad - size / 2;
  const left = safe.left + pad + size / 2;
  const right = cssWidth - safe.right - pad - size / 2;
  return {
    size,
    // bottom-left: movement
    leftBtnX: left,
    leftBtnY: bottom,
    rightBtnX: left + size * 1.25,
    rightBtnY: bottom,
    // bottom-right action cluster (thumb arc):
    //   attack   = corner (primary)   heavy = left of attack
    //   jump     = above attack       block = diagonal
    //   special  = top of the arc
    attackX: right,
    attackY: bottom,
    heavyX: right - size * 1.22,
    heavyY: bottom + size * 0.06,
    jumpX: right,
    jumpY: bottom - size * 1.22,
    blockX: right - size * 1.22,
    blockY: bottom - size * 1.1,
    specialX: right - size * 2.28,
    specialY: bottom - size * 0.5,
  };
}
