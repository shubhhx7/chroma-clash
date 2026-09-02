import { DESIGN_HEIGHT, MIN_LOGICAL_WIDTH, MAX_LOGICAL_WIDTH } from '../config/constants';

/**
 * Pure logical-viewport math (unit tested). The camera keeps the logical
 * height at DESIGN_HEIGHT world units whenever the aspect allows at least
 * MIN_LOGICAL_WIDTH of visible width; narrower viewports pin the visible
 * width to MIN_LOGICAL_WIDTH and reveal extra vertical background instead
 * of distorting. Ultra-wide viewports reveal extra decorative width beyond
 * MAX_LOGICAL_WIDTH; layout (HUD anchors, combat bounds) is computed against
 * the clamped layout width so gameplay stays in the safe central zone.
 */
export interface LogicalViewport {
  /** raw CSS pixel size of the canvas */
  cssWidth: number;
  cssHeight: number;
  /** camera zoom to apply */
  zoom: number;
  /** world units actually visible */
  viewWidth: number;
  viewHeight: number;
  /** layout-safe logical size (clamped) */
  layoutWidth: number;
  layoutHeight: number;
}

export function computeLogicalViewport(cssWidth: number, cssHeight: number): LogicalViewport {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const aspect = w / h;
  const naturalWidth = DESIGN_HEIGHT * aspect;

  let zoom: number;
  if (naturalWidth >= MIN_LOGICAL_WIDTH) {
    // height-fit: exactly DESIGN_HEIGHT world units tall
    zoom = h / DESIGN_HEIGHT;
  } else {
    // narrow window: keep at least MIN_LOGICAL_WIDTH visible, show extra height
    zoom = w / MIN_LOGICAL_WIDTH;
  }

  const viewWidth = w / zoom;
  const viewHeight = h / zoom;
  return {
    cssWidth: w,
    cssHeight: h,
    zoom,
    viewWidth,
    viewHeight,
    layoutWidth: Math.min(Math.max(viewWidth, MIN_LOGICAL_WIDTH), MAX_LOGICAL_WIDTH),
    layoutHeight: DESIGN_HEIGHT,
  };
}

/** Convert a CSS-pixel rectangle inset (safe area) into world units for a given zoom. */
export function cssInsetToWorld(insetPx: number, zoom: number): number {
  return insetPx / zoom;
}
