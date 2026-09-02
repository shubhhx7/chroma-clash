/**
 * On-canvas touch controls built from the real control art.
 * Bottom-left: movement arrows. Bottom-right: a thumb arc of action buttons
 * (attack / heavy / jump / block / special). Multi-touch aware with
 * pressed-state texture swaps; hidden on desktop pointer devices unless the
 * debug toggle forces them on. The special button swaps art depending on
 * whether the meter is full.
 */
import Phaser from 'phaser';
import { TEX } from '../data/assetKeys';
import { InputAction } from '../input/InputAction';
import type { TouchInput } from '../input/TouchInput';
import { computeTouchLayout } from '../responsive/ResponsiveLayout';
import type { SafeAreaInsets } from '../responsive/SafeAreaService';

interface ControlButton {
  image: Phaser.GameObjects.Image;
  defaultTex: string;
  pressedTex: string;
  action: InputAction;
  pointerId: number | null;
}

const IDLE_ALPHA = 0.62;
const ACTIVE_ALPHA = 0.95;

export class TouchControls {
  readonly root: Phaser.GameObjects.Container;
  private buttons: ControlButton[] = [];
  private byAction = new Map<InputAction, ControlButton>();
  private specialReady = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly touch: TouchInput,
  ) {
    // enough pointers for both thumbs + extras
    scene.input.addPointer(4);

    this.root = scene.add.container(0, 0);
    this.addButton(TEX.BTN_LEFT, TEX.BTN_LEFT_PRESSED, InputAction.MOVE_LEFT);
    this.addButton(TEX.BTN_RIGHT, TEX.BTN_RIGHT_PRESSED, InputAction.MOVE_RIGHT);
    this.addButton(TEX.BTN_ATTACK, TEX.BTN_ATTACK_PRESSED, InputAction.ATTACK);
    this.addButton(TEX.BTN_HEAVY, TEX.BTN_HEAVY_PRESSED, InputAction.HEAVY);
    // jump reuses the right-arrow art rotated upward (no dedicated art on the sheets)
    this.addButton(TEX.BTN_RIGHT, TEX.BTN_RIGHT_PRESSED, InputAction.JUMP, -90);
    this.addButton(TEX.BTN_BLOCK, TEX.BTN_BLOCK_PRESSED, InputAction.BLOCK);
    this.addButton(TEX.BTN_SPECIAL_DISABLED, TEX.BTN_SPECIAL_READY, InputAction.SPECIAL);
  }

  private addButton(defaultTex: string, pressedTex: string, action: InputAction, angle = 0): void {
    const image = this.scene.add.image(0, 0, defaultTex).setAlpha(IDLE_ALPHA).setAngle(angle);
    image.setInteractive();
    const btn: ControlButton = { image, defaultTex, pressedTex, action, pointerId: null };

    image.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      btn.pointerId = pointer.id;
      this.touch.press(action);
      image.setTexture(this.textureFor(btn, true)).setAlpha(ACTIVE_ALPHA);
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (btn.pointerId !== null && pointer.id !== btn.pointerId) return;
      btn.pointerId = null;
      this.touch.release(action);
      image.setTexture(this.textureFor(btn, false)).setAlpha(IDLE_ALPHA);
    };
    image.on(Phaser.Input.Events.POINTER_UP, release);
    image.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    // Deliberately NOT POINTER_OUT: a thumb holding a movement button drifts
    // a few px and that released the button, stopping the fighter mid-move.
    // POINTER_UP_OUTSIDE does not fire reliably for a finger lifted after
    // dragging off the image (verified: movement stayed latched on), so the
    // scene-level lift is the release signal. It only ever acts on the
    // pointer that pressed THIS button, so a second finger on another
    // control cannot cancel a held one.

    this.scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (btn.pointerId === null || pointer.id !== btn.pointerId) return;
      release(pointer);
    });

    this.buttons.push(btn);
    this.byAction.set(action, btn);
    this.root.add(image);
  }

  private textureFor(btn: ControlButton, pressed: boolean): string {
    if (btn.action === InputAction.SPECIAL) {
      // ready state shows the charged crystal; disabled state the grey one
      return this.specialReady ? TEX.BTN_SPECIAL_READY : TEX.BTN_SPECIAL_DISABLED;
    }
    return pressed ? btn.pressedTex : btn.defaultTex;
  }

  /** Swap the special button art when the meter fills/empties. */
  setSpecialReady(ready: boolean): void {
    if (this.specialReady === ready) return;
    this.specialReady = ready;
    const btn = this.byAction.get(InputAction.SPECIAL);
    btn?.image.setTexture(this.textureFor(btn, false));
    btn?.image.setAlpha(ready ? 0.9 : IDLE_ALPHA);
  }

  layout(cssWidth: number, cssHeight: number, safe: SafeAreaInsets, controlSizePx: number): void {
    const l = computeTouchLayout(cssWidth, cssHeight, safe, controlSizePx);
    const place = (action: InputAction, x: number, y: number, size: number): void => {
      this.byAction.get(action)?.image.setPosition(x, y).setDisplaySize(size, size);
    };
    place(InputAction.MOVE_LEFT, l.leftBtnX, l.leftBtnY, l.size);
    place(InputAction.MOVE_RIGHT, l.rightBtnX, l.rightBtnY, l.size);
    place(InputAction.ATTACK, l.attackX, l.attackY, l.size * 1.14);
    place(InputAction.HEAVY, l.heavyX, l.heavyY, l.size * 0.92);
    place(InputAction.JUMP, l.jumpX, l.jumpY, l.size * 0.88);
    place(InputAction.BLOCK, l.blockX, l.blockY, l.size * 0.88);
    place(InputAction.SPECIAL, l.specialX, l.specialY, l.size * 0.95);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
    if (!visible) {
      for (const btn of this.buttons) {
        btn.pointerId = null;
        this.touch.release(btn.action);
        btn.image.setTexture(this.textureFor(btn, false)).setAlpha(IDLE_ALPHA);
      }
    }
  }

  destroy(): void {
    this.root.destroy(true);
    this.buttons = [];
    this.byAction.clear();
  }
}
