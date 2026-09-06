/**
 * Touch-safe tap binding for interactive game objects.
 *
 * WHY THIS EXISTS (measured, not guessed):
 * Phaser's GAMEOBJECT_POINTER_UP only fires when the pointer is released
 * while still hit-testing the object. A mouse click has zero travel, so on
 * desktop this is invisible. A real finger drifts while lifting. Probing the
 * weapon-select screen on a 844x390 / DPR 3 phone profile:
 *
 *   drift  0px -> pointerdown 1, pointerup 1  -> run starts
 *   drift 12px -> pointerdown 1, pointerup 1  -> run starts
 *   drift 25px -> pointerdown 1, pointerup 0  -> NOTHING HAPPENS
 *
 * BEGIN THE RUN is 46px tall, so ~23px of drift leaves its hit area and the
 * release is dropped: the button looked alive (it highlighted on press) but
 * the run could never start. That is the real cause of the mobile block —
 * enlarging the button would only widen the tolerance, not fix the contract.
 *
 * onTap implements the standard button contract for touch: arm on press,
 * commit on release even if the finger has drifted off the target. Mouse
 * pointers keep Phaser's exact existing behaviour, so desktop is unchanged.
 */
import Phaser from 'phaser';
import { MIN_TOUCH_PX } from '../config/constants';

type Interactive = Phaser.GameObjects.GameObject & { active: boolean };

export { MIN_TOUCH_PX };

/**
 * Bind `handler` to a tap on `obj`.
 *
 * - mouse: fires on POINTER_UP over the object (identical to before)
 * - touch: fires on release anywhere after a press that started on the object
 */
export function onTap(scene: Phaser.Scene, obj: Interactive, handler: () => void): void {
  let armed = false;

  const fire = (): void => {
    // the object may have been destroyed between press and release
    if (!obj.active || !obj.scene) return;
    handler();
  };

  obj.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) armed = true;
  });

  obj.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
    // desktop mouse path: unchanged
    if (!pointer.wasTouch) fire();
  });

  // Scene-level release always fires regardless of where the finger ended up,
  // so it is the reliable completion signal for a drifted touch.
  const onSceneUp = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.wasTouch || !armed) return;
    armed = false;
    fire();
  };
  scene.input.on(Phaser.Input.Events.POINTER_UP, onSceneUp);

  // a cancelled touch (call, notification, gesture takeover) must not commit
  const disarm = (): void => {
    armed = false;
  };
  scene.input.on(Phaser.Input.Events.GAME_OUT, disarm);
  scene.game.canvas.addEventListener('pointercancel', disarm);

  const cleanup = (): void => {
    scene.input.off(Phaser.Input.Events.POINTER_UP, onSceneUp);
    scene.input.off(Phaser.Input.Events.GAME_OUT, disarm);
    scene.game.canvas.removeEventListener('pointercancel', disarm);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  obj.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
}
