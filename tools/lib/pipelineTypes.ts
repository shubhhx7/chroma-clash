/**
 * tools/lib/pipelineTypes.ts
 * Shared types for assets.config.json — the manually-authored slicing config.
 */

export interface PickDef {
  /** explicit normalized [x, y, w, h] source rect (shrink-wrapped); overrides band/index */
  rect?: [number, number, number, number];
  /** band index (top to bottom) after segmentation */
  band: number;
  /** segment index within band (left to right). Ignored when widest=true. */
  index?: number;
  /** pick the widest segment in the band (used for bar rows / strips) */
  widest?: boolean;
  /** output name for stills */
  name: string;
  /** per-pick fade overrides (default: entry-level values) */
  fadeTop?: number;
  fadeSides?: number;
  /** drop this fraction from the left of the tight bbox, then re-shrink */
  trimLeftFrac?: number;
  /** drop this fraction from the top of the tight bbox (caption text), then re-shrink */
  trimTopFrac?: number;
  /** drop this fraction from the bottom of the tight bbox, then re-shrink */
  trimBottomFrac?: number;
  /** crop the tight bbox to a square-ish top area (drops label plates under buttons) */
  squareTop?: boolean;
}

export interface BandAnimationDef {
  band: number;
  name: string;
  fps: number;
  loop: boolean;
  /** expected frame count; mismatch is recorded as a processing failure */
  expect?: number;
}

export interface EntryConfig {
  id: string;
  /** exact raw source path, forward slashes, relative to repo root */
  source: string;
  /**
   * 'passthrough' copies the source file byte-for-byte into the runtime dir —
   * no keying, no recolour, no derivative. Used for artwork that must render
   * exactly as authored.
   */
  type: 'green-sheet' | 'alpha-sheet' | 'passthrough';
  /** greenness threshold for isGreen during segmentation (green-sheet only) */
  greenTolerance?: number;
  /** dechroma soft band */
  chromaLo?: number;
  chromaHi?: number;
  /** normalized [x, y, w, h] region override; else auto-detected green region */
  region?: [number, number, number, number];
  gapRows?: number;
  gapCols?: number;
  minW?: number;
  minH?: number;
  /** force-split segments wider than this many px (touching frames) */
  maxSegW?: number;
  /** repaint full-width near-black separator-line rows as green before segmentation */
  ignoreDarkLines?: boolean;
  /** explicit normalized [y0, y1] band ranges, overriding auto row detection */
  bandsY?: Array<[number, number]>;
  /** minimum alpha treated as content on alpha-sheets (raise for glowy sheets) */
  minAlpha?: number;
  /** split over-wide runs into exactly n equal cells */
  splitEven?: number;
  /** remove disconnected digit/shadow debris from cropped animation frames */
  cleanFrames?: boolean;
  /** strip faint white haze from VFX crops (ADD-blend box artifact) */
  stripWhiteHaze?: boolean;
  /** neutralize all green cast (mist/particles extracted from green) */
  despillStrong?: boolean;
  /** Lanczos pre-upscale factor for packed animation strips (anti-blur) */
  upscale?: number;
  /** key out border-connected solid black background (glow art on black) */
  blackKey?: boolean;
  /** blackKey: keep artwork fully opaque (no brightness ramp) — preserves authored colors */
  blackKeyHard?: boolean;
  /** blackKey: erode N px of the dark anti-aliasing fringe left behind */
  blackKeyErode?: number;
  /** key out border-connected near-white background (glow art on paper) */
  whiteKey?: boolean;
  /** stills: keep only the dominant blob (drops effect slivers clipped by the crop rect) */
  keepMainBlob?: boolean;
  /** strict debris removal: drop components farther than N px from the main body */
  cleanIsolated?: number;
  /** cellGrid frames via connected components (recovers blades crossing cell borders) */
  cellConnect?: boolean;
  /** strip semi-transparent dark painted glow (alpha sheets) */
  stripDarkHaze?: boolean;
  /** defringe: shave low-alpha matte halo (alpha sheets), value = alpha threshold */
  alphaShave?: number;
  /** dechroma dark-pixel guard override (default 80); lower for noisy dark-green vignettes */
  chromaDarkFloor?: number;
  /** remove these frame indices after slicing (frames with no character etc.) */
  dropFrames?: number[];
  /** mirror these frame indices horizontally (wrong-facing AI frames) */
  flipFrames?: number[];
  /** mirror every frame (whole sheet drawn facing the wrong way) */
  flipAllFrames?: boolean;
  /** standing character height in SOURCE px — normalizes every sheet to the canonical character height (see CANON_CHAR_PX) so all animations share one texel density and one runtime scale */
  charHeightPx?: number;
  /** canonical target override (bigger fighters), default 380 */
  charTargetPx?: number;
  /** soft alpha fade on still crops: top edge fraction */
  fadeTop?: number;
  /** soft alpha fade on still crops: left/right edge fraction */
  fadeSides?: number;
  /** trim small floating content (digits/captions) above segments */
  trimFloatingTop?: boolean;
  /** drop segments whose left edge is left of this normalized x (label columns) */
  minSegX?: number;
  /** uniform cell grid override for alpha button sheets */
  cellGrid?: { cols: number; rows: number; squareTop?: boolean };
  /**
   * Stills picks address grid cells directly (band = row, index = col): the
   * padded cell is cropped and only its largest solid component is kept.
   * Used for button sheets whose cells carry caption plaques and cross-cell
   * glow that band segmentation cannot separate cleanly.
   */
  cellButton?: boolean;
  output:
    | {
        kind: 'animation';
        /** path base under assets_processed, e.g. characters/kairo/idle */
        name: string;
        fps: number;
        loop: boolean;
        expect?: number;
      }
    | {
        kind: 'stills';
        /** directory under assets_processed */
        dir: string;
        pick: PickDef[];
      }
    | {
        kind: 'multi-animation';
        dir: string;
        animations: BandAnimationDef[];
      };
  pivot?: { x: number; y: number };
  baseline?: number;
}

export interface AssetsConfig {
  entries: EntryConfig[];
}
