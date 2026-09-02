/**
 * Reusable mobile fullscreen + landscape helper.
 *
 * Both APIs involved are gesture-gated and partially unsupported:
 *   - Element.requestFullscreen() must be called from a user gesture, and is
 *     absent on iPhone Safari.
 *   - ScreenOrientation.lock() rejects unless the document is *already*
 *     fullscreen (Android/Chrome), and is absent on iOS entirely.
 *
 * So the order matters: fullscreen first, then lock. Every step is optional
 * and every failure is swallowed — the rotate overlay stays the fallback, and
 * the game never depends on either succeeding. Nothing here runs for a
 * mouse/fine-pointer device, so desktop is untouched.
 */

export interface FullscreenResult {
  fullscreen: boolean;
  locked: boolean;
}

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function isFullscreen(): boolean {
  const d = document as FsDocument;
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

export function fullscreenSupported(): boolean {
  const el = document.documentElement as FsElement;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

/** Request fullscreen on the document element. Resolves to the achieved state. */
export async function requestFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  const el = document.documentElement as FsElement;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
    } else {
      return false; // iOS Safari: no fullscreen API for arbitrary elements
    }
  } catch {
    return false; // user denied, or not in a gesture
  }
  return isFullscreen();
}

/** Lock to landscape. Only works while fullscreen on most Android browsers. */
export async function lockLandscape(): Promise<boolean> {
  const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
  if (!orientation?.lock) return false;
  try {
    await orientation.lock('landscape');
    return true;
  } catch {
    return false; // not permitted (iOS, or not fullscreen) — gate handles it
  }
}

/**
 * Go fullscreen and lock landscape, best effort. MUST be called from inside a
 * user-gesture handler (pointerdown/touchend/click) or the browser rejects it.
 */
export async function enterMobileFullscreen(): Promise<FullscreenResult> {
  const fullscreen = await requestFullscreen();
  const locked = await lockLandscape();
  return { fullscreen, locked };
}

export async function exitMobileFullscreen(): Promise<void> {
  const d = document as FsDocument;
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* never locked */
  }
  if (!isFullscreen()) return;
  try {
    if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
    else if (typeof d.webkitExitFullscreen === 'function') await d.webkitExitFullscreen();
  } catch {
    /* already exited */
  }
}

/** Notified whenever the fullscreen state changes (both vendor spellings). */
export function onFullscreenChange(cb: (active: boolean) => void): () => void {
  const handler = (): void => cb(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
