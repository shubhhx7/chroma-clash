/**
 * Final boss AI. Phase 1 uses the base config; at 50% health Vael pauses in
 * PHASE_CHANGE (aura moment, handled visually by the scene via
 * `onPhaseChange`), then fights enraged: faster reactions, shorter cooldowns,
 * more dodges and a faster Violet Rift Slash rotation.
 */
import { AIState, EnemyAI } from './EnemyAI';
import type { Fighter } from '../entities/Fighter';
import type { FighterIntent } from '../entities/fighterIntent';
import { VAEL_AI_CONFIG, VAEL_PHASE2_OVERRIDES } from '../data/enemyConfigs';

export class VaelAI extends EnemyAI {
  phase: 1 | 2 = 1;
  onPhaseChange: (() => void) | null = null;

  constructor(self: Fighter, target: Fighter) {
    super(self, target, VAEL_AI_CONFIG);
  }

  override decide(dtMs: number): FighterIntent {
    if (this.phase === 1 && !this.self.isDefeated && this.self.health <= this.self.config.maxHealth * 0.5) {
      this.phase = 2;
      Object.assign(this.config, VAEL_PHASE2_OVERRIDES);
      this.state = AIState.PHASE_CHANGE;
      this.stateTimerMs = 900;
      this.onPhaseChange?.();
    }
    return super.decide(dtMs);
  }
}
