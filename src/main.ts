/** Chroma Clash entry point: shell, orientation gate, then the game. */
import Phaser from 'phaser';
import './styles/base.css';
import './app/app.css';
import { ResponsiveGameShell } from './app/ResponsiveGameShell';
import { OrientationGate } from './app/OrientationGate';
import { FullscreenController } from './app/FullscreenController';
import { fullscreenSupported } from './app/MobileFullscreen';
import { createGameConfig } from './game/config/gameConfig';
import { AudioManager } from './game/audio/AudioManager';

function boot(): void {
  const container = document.getElementById('game-container');
  if (!container) throw new Error('#game-container missing from index.html');

  const shell = new ResponsiveGameShell(container);
  const metrics = shell.metrics();
  const game = new Phaser.Game(
    createGameConfig(container, Math.round(metrics.cssWidth * metrics.dpr), Math.round(metrics.cssHeight * metrics.dpr)),
  );

  game.events.once(Phaser.Core.Events.READY, () => {
    shell.attach(game);

    const gate = new OrientationGate();
    gate.attach(game);
    gate.onChange((active) => {
      if (!active) shell.refresh();
    });

    const fullscreen = new FullscreenController();
    // fullscreen/orientation changes resize the viewport: re-measure, no reload
    fullscreen.install(() => shell.refresh());

    // the rotate screen's button is the reliable user gesture for fullscreen
    const gateButton = document.getElementById('gate-fullscreen');
    if (gateButton && OrientationGate.isTouchOriented() && fullscreenSupported()) {
      gateButton.hidden = false;
      gateButton.addEventListener('click', () => {
        void fullscreen.enterFromUserGesture();
      });
    }
  });

  // mobile autoplay policy: unlock the audio context on the first gesture
  const unlockAudio = (): void => {
    AudioManager.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchend', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('touchend', unlockAudio);

  // expose for Playwright smoke tests (dev/test only usage)
  (window as Window & { __chromaClash?: { game: Phaser.Game } }).__chromaClash = { game };
}

boot();
