/**
 * Desktop keyboard input.
 *   A / Left    : move left        D / Right : move right
 *   Space / W / Up : jump          J : light attack (chain J-J-J)
 *   K : heavy attack               E : dash attack     I : kick
 *   S / Down (hold) : block/parry  L : special (full meter)
 *   Escape : pause                 R : restart (KO / debug)
 *   F3 : debug HUD                 F4 : Asset Gallery (dev)
 */
import Phaser from 'phaser';
import { InputAction, type InputSource } from './InputAction';

const KEYS = Phaser.Input.Keyboard.KeyCodes;

export class KeyboardInput implements InputSource {
  private keys = new Map<InputAction, Phaser.Input.Keyboard.Key[]>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const add = (action: InputAction, ...codes: number[]): void => {
      this.keys.set(
        action,
        codes.map((c) => kb.addKey(c, false)),
      );
    };
    add(InputAction.MOVE_LEFT, KEYS.A, KEYS.LEFT);
    add(InputAction.MOVE_RIGHT, KEYS.D, KEYS.RIGHT);
    add(InputAction.JUMP, KEYS.SPACE, KEYS.W, KEYS.UP);
    add(InputAction.ATTACK, KEYS.J);
    add(InputAction.HEAVY, KEYS.K);
    add(InputAction.KICK, KEYS.I);
    add(InputAction.DASH, KEYS.E);
    add(InputAction.BLOCK, KEYS.S, KEYS.DOWN);
    add(InputAction.SPECIAL, KEYS.L);
    add(InputAction.PAUSE, KEYS.ESC);
    add(InputAction.RESTART, KEYS.R);
    add(InputAction.DEBUG_TOGGLE, KEYS.F3);
    add(InputAction.ASSET_GALLERY, KEYS.F4);
  }

  isDown(action: InputAction): boolean {
    return (this.keys.get(action) ?? []).some((k) => k.isDown);
  }

  justPressed(action: InputAction): boolean {
    return (this.keys.get(action) ?? []).some((k) => Phaser.Input.Keyboard.JustDown(k));
  }

  update(): void {
    /* Phaser keys update themselves */
  }

  reset(): void {
    for (const list of this.keys.values()) for (const k of list) k.reset();
  }
}
