/**
 * Drives fullscreen + landscape lock on touch devices.
 *
 * Previously this only called screen.orientation.lock(), which on Android
 * always rejects while the document is not fullscreen — so the lock never
 * actually took effect. It now goes fullscreen first (see MobileFullscreen),
 * which is what makes the lock succeed, and it keeps retrying on later
 * gestures because the very first gesture may be consumed or denied.
 *
 * Everything is best-effort: the rotate overlay remains the fallback, and no
 * refresh is ever required. Fine-pointer (desktop) devices are skipped
 * entirely, so desktop behaviour is unchanged.
 */
import { OrientationGate } from './OrientationGate';
import { enterMobileFullscreen, isFullscreen, lockLandscape, onFullscreenChange, fullscreenSupported } from './MobileFullscreen';

export class FullscreenController {
  private attempts = 0;
  private listening = false;
  private onChanged: (() => void) | null = null;

  /** @param onStateChange called after fullscreen/orientation settles so the shell can re-measure. */
  install(onStateChange?: () => void): void {
    if (!OrientationGate.isTouchOriented()) return; // desktop: no-op
    this.onChanged = onStateChange ?? null;

    // Automated browsers cannot leave fullscreen to be resized, which breaks
    // viewport-rotation tests. The explicit button path below still works, so
    // only the *unprompted* attempt is skipped here.
    if (navigator.webdriver) return;

    // Any gesture is a chance to enter fullscreen. Retry a few times: the
    // first tap often lands on the rotate overlay or is spent unlocking audio.
    const attempt = (): void => {
      if (isFullscreen() || this.attempts >= 5) {
        this.teardownGestureListeners();
        return;
      }
      this.attempts += 1;
      void enterMobileFullscreen().then(({ fullscreen }) => {
        if (fullscreen) this.teardownGestureListeners();
      });
    };
    this.gestureAttempt = attempt;
    window.addEventListener('pointerup', attempt);
    window.addEventListener('touchend', attempt);
    this.listening = true;

    // Entering fullscreen resizes the viewport; re-assert the lock and let
    // the shell re-measure without a reload.
    onFullscreenChange((active) => {
      if (active) void lockLandscape();
      this.onChanged?.();
    });

    // returning from background / app switch can drop fullscreen silently
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.onChanged?.();
    });
  }

  private gestureAttempt: (() => void) | null = null;

  /** Explicit user action (the rotate screen's fullscreen button). */
  async enterFromUserGesture(): Promise<void> {
    if (!fullscreenSupported() && !screen.orientation) return;
    await enterMobileFullscreen();
    this.onChanged?.();
  }

  private teardownGestureListeners(): void {
    if (!this.listening || !this.gestureAttempt) return;
    window.removeEventListener('pointerup', this.gestureAttempt);
    window.removeEventListener('touchend', this.gestureAttempt);
    this.listening = false;
  }
}
