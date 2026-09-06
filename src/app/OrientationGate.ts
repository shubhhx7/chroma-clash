/**
 * Orientation gate: on touch-oriented devices in portrait, a full-screen DOM
 * overlay covers the canvas, gameplay scenes pause, input is disabled and
 * audio is muted. Rotating to landscape hides the overlay and resumes.
 * Detection uses pointer coarseness + touch points + viewport shape — never
 * user-agent strings.
 */
import Phaser from 'phaser';

export class OrientationGate {
  private overlay: HTMLElement;
  private gateActive = false;
  private game: Phaser.Game | null = null;
  private onChangeCallbacks: Array<(active: boolean) => void> = [];

  constructor() {
    const el = document.getElementById('orientation-gate');
    if (!el) throw new Error('#orientation-gate missing from index.html');
    this.overlay = el;
  }

  attach(game: Phaser.Game): void {
    this.game = game;
    window.addEventListener('resize', this.evaluate);
    window.addEventListener('orientationchange', this.evaluate);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.matchMedia('(orientation: portrait)').addEventListener?.('change', this.evaluate);
    this.evaluate();
    // Game.start() begins the loop right AFTER the READY event, which would
    // override an initial-portrait sleep — re-assert the gate on first step.
    game.events.once(Phaser.Core.Events.POST_STEP, () => {
      if (this.gateActive) this.applyPause();
    });
  }

  onChange(cb: (active: boolean) => void): void {
    this.onChangeCallbacks.push(cb);
  }

  get isActive(): boolean {
    return this.gateActive;
  }

  static isTouchOriented(): boolean {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const touchPoints = navigator.maxTouchPoints ?? 0;
    return coarse || touchPoints > 1;
  }

  static isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  private evaluate = (): void => {
    const shouldGate = OrientationGate.isTouchOriented() && OrientationGate.isPortrait();
    if (shouldGate === this.gateActive) {
      this.overlay.hidden = !shouldGate;
      // Mobile browsers can suspend the Phaser loop while backgrounded or
      // while fullscreen/orientation settles without changing our gate
      // state. Reconcile it when visible so AI and combat cannot stay asleep.
      if (!shouldGate && document.visibilityState === 'visible') this.restorePlay();
      return;
    }
    this.gateActive = shouldGate;
    this.overlay.hidden = !shouldGate;
    if (!this.game) return;

    if (shouldGate) {
      this.applyPause();
    } else {
      this.restorePlay();
    }
    for (const cb of this.onChangeCallbacks) cb(shouldGate);
    // let input layers clear held pointers (stuck-input protection)
    window.dispatchEvent(new CustomEvent('cc-gate-change', { detail: shouldGate }));
  };

  /** Pause every running scene, stop the loop, mute audio. */
  private applyPause(): void {
    if (!this.game) return;
    for (const scene of this.game.scene.getScenes(true)) {
      if (scene.scene.settings.status === Phaser.Scenes.RUNNING) scene.scene.pause();
    }
    this.game.sound.mute = true;
    this.game.loop.sleep();
  }

  private restorePlay(): void {
    if (!this.game) return;
    this.game.loop.wake();
    this.game.sound.mute = false;
    for (const scene of this.game.scene.getScenes(false)) {
      if (scene.scene.isPaused()) scene.scene.resume();
    }
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') this.evaluate();
  };

  destroy(): void {
    window.removeEventListener('resize', this.evaluate);
    window.removeEventListener('orientationchange', this.evaluate);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
