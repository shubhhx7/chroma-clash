/** Player fighter. All behaviour is data-driven through KAIRO_CONFIG. */
import Phaser from 'phaser';
import { Fighter, type FighterIntent } from './Fighter';
import { KAIRO_CONFIG } from '../data/fighterConfigs';
import { InputAction } from '../input/InputAction';
import type { InputRouter } from '../input/InputRouter';

export class Kairo extends Fighter {
  constructor(scene: Phaser.Scene, x: number, facing: 1 | -1 = 1) {
    super(scene, KAIRO_CONFIG, x, facing);
  }

  /**
   * Pull the merged input intent for this frame. Edge presses go through the
   * fighter's press buffer so an input landed during hit-stun or recovery
   * still comes out (~220ms window); states clear the buffer entry once the
   * action actually starts.
   */
  applyInput(input: InputRouter): void {
    const bufferEdge = (action: InputAction, kind: string): void => {
      if (input.consumePress(action)) this.bufferPress(kind);
    };
    bufferEdge(InputAction.ATTACK, 'attack');
    bufferEdge(InputAction.HEAVY, 'heavy');
    bufferEdge(InputAction.KICK, 'kick');
    bufferEdge(InputAction.SPECIAL, 'special');
    bufferEdge(InputAction.JUMP, 'jump');
    bufferEdge(InputAction.DASH, 'dash');

    const intent: FighterIntent = {
      moveX: input.moveX,
      attack: this.hasPress('attack'),
      heavy: this.hasPress('heavy'),
      kick: this.hasPress('kick'),
      special: this.hasPress('special'),
      jump: this.hasPress('jump'),
      dash: this.hasPress('dash'),
      block: input.isDown(InputAction.BLOCK),
    };
    this.intent = intent;
  }
}
