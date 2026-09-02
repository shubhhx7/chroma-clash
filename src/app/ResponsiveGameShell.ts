/**
 * ResponsiveGameShell owns the canvas <-> viewport relationship:
 *
 * - Renders the game at min(devicePixelRatio, 2) for crisp output while the
 *   canvas is CSS-sized to fill the visible viewport (100dvh with a
 *   visualViewport-driven --app-vh fallback).
 * - Listens to ResizeObserver, window.resize, orientationchange and
 *   visualViewport resize/scroll, debounces them, and notifies the game.
 * - Resize never restarts gameplay; scenes re-lay themselves out.
 *
 * Note: Phaser 3 has no built-in devicePixelRatio support in Scale.RESIZE,
 * so the shell implements the resize-based strategy manually: the drawing
 * buffer is CSS size x DPR and cameras compensate (see BattleScene).
 */
import Phaser from 'phaser';
import { MAX_DPR } from '../game/config/constants';

export interface ShellMetrics {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
}

type ResizeListener = (metrics: ShellMetrics) => void;

export class ResponsiveGameShell {
  private game: Phaser.Game | null = null;
  private listeners: ResizeListener[] = [];
  private debounceHandle: number | null = null;
  private observer: ResizeObserver | null = null;
  private lastMetrics: ShellMetrics | null = null;

  constructor(private readonly container: HTMLElement) {}

  get dpr(): number {
    return Math.min(window.devicePixelRatio || 1, MAX_DPR);
  }

  metrics(): ShellMetrics {
    const rect = this.container.getBoundingClientRect();
    return {
      cssWidth: Math.max(1, Math.round(rect.width)),
      cssHeight: Math.max(1, Math.round(rect.height)),
      dpr: this.dpr,
    };
  }

  attach(game: Phaser.Game): void {
    this.game = game;

    this.updateVhVar();
    this.observer = new ResizeObserver(() => this.scheduleResize());
    this.observer.observe(this.container);
    window.addEventListener('resize', this.scheduleResize);
    window.addEventListener('orientationchange', this.scheduleResize);
    window.visualViewport?.addEventListener('resize', this.onVisualViewport);
    window.visualViewport?.addEventListener('scroll', this.onVisualViewport);

    this.applyResize();
  }

  onResize(listener: ResizeListener): void {
    this.listeners.push(listener);
    if (this.lastMetrics) listener(this.lastMetrics);
  }

  /** Force a re-layout (e.g. after the orientation gate closes). */
  refresh(): void {
    this.applyResize();
  }

  private onVisualViewport = (): void => {
    this.updateVhVar();
    this.scheduleResize();
  };

  private scheduleResize = (): void => {
    if (this.debounceHandle !== null) window.clearTimeout(this.debounceHandle);
    this.debounceHandle = window.setTimeout(() => {
      this.debounceHandle = null;
      this.applyResize();
    }, 80);
  };

  /** dvh fallback for browsers with partial support (mobile chrome bars). */
  private updateVhVar(): void {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-vh', `${Math.round(h)}px`);
  }

  private applyResize(): void {
    if (!this.game || !this.game.isRunning) return;
    this.updateVhVar();
    const m = this.metrics();
    const bufferW = Math.round(m.cssWidth * m.dpr);
    const bufferH = Math.round(m.cssHeight * m.dpr);
    if (this.game.scale.width !== bufferW || this.game.scale.height !== bufferH) {
      this.game.scale.resize(bufferW, bufferH);
    }
    const canvas = this.game.canvas;
    canvas.style.width = `${m.cssWidth}px`;
    canvas.style.height = `${m.cssHeight}px`;
    // guard against any leftover ScaleManager centering margins
    canvas.style.margin = '0';
    this.lastMetrics = m;
    for (const l of this.listeners) l(m);
  }

  destroy(): void {
    this.observer?.disconnect();
    window.removeEventListener('resize', this.scheduleResize);
    window.removeEventListener('orientationchange', this.scheduleResize);
    window.visualViewport?.removeEventListener('resize', this.onVisualViewport);
    window.visualViewport?.removeEventListener('scroll', this.onVisualViewport);
    this.listeners = [];
  }
}
