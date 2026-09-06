/**
 * Phaser game configuration. The drawing buffer is managed by
 * ResponsiveGameShell (CSS size x capped DPR); scenes compensate via camera
 * zoom, so nothing is ever stretched or distorted.
 */
import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { SplashScene } from '../scenes/SplashScene';
import { MenuScene } from '../scenes/MenuScene';
import { WeaponSelectScene } from '../scenes/WeaponSelectScene';
import { BattleScene } from '../scenes/BattleScene';
import { UpgradeScene } from '../scenes/UpgradeScene';
import { ResultScene } from '../scenes/ResultScene';
import { AssetGalleryScene } from '../scenes/AssetGalleryScene';
import { CycleScene } from '../scenes/CycleScene';

export function createGameConfig(
  parent: HTMLElement,
  initialWidth: number,
  initialHeight: number,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: initialWidth,
    height: initialHeight,
    backgroundColor: '#060912',
    // The shell resizes the buffer explicitly (CSS x DPR); NONE + NO_CENTER
    // keeps Phaser from fighting the manual high-DPI management (CENTER_BOTH
    // applies stale margins after orientation changes, shoving the canvas
    // off-screen).
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    // real-time delta (no smoothing): on weak GPUs the game drops frames but
    // never slips into slow motion — timers, tweens and combat stay real-time
    fps: {
      smoothStep: false,
    },
    render: {
      antialias: true,
      // integer device-pixel positions kill sub-pixel shimmer on sprites
      roundPixels: true,
      pixelArt: false,
      powerPreference: 'high-performance',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      activePointers: 4,
    },
    scene: [
      BootScene,
      PreloadScene,
      SplashScene,
      MenuScene,
      WeaponSelectScene,
      BattleScene,
      UpgradeScene,
      ResultScene,
      AssetGalleryScene,
      CycleScene,
    ],
  };
}
