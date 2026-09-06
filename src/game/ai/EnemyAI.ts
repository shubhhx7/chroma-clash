/**
 * Enemy combat AI: a readable state machine that creates real pressure.
 * Deterministic (seeded randomness) so fights are debuggable.
 *
 * IDLE -> APPROACH (close distance) / SPACING (back off when crowded)
 *      -> WAIT (idle with intent) -> ATTACK (pick a move) -> RECOVER
 * Reactions: BLOCK or DODGE when the player starts an attack in range,
 * PUNISH (immediate counter) when the player whiffs nearby, HIT / DEFEAT
 * mirror the fighter's condition.
 */
import type { Fighter } from '../entities/Fighter';
import { EMPTY_INTENT, type FighterIntent } from '../entities/fighterIntent';
import type { EnemyAIConfig } from '../data/enemyConfigs';
import { seededRandom } from '../utils/math';

export enum AIState {
  IDLE = 'IDLE',
  APPROACH = 'APPROACH',
  SPACING = 'SPACING',
  WAIT = 'WAIT',
  ATTACK = 'ATTACK',
  BLOCK = 'BLOCK',
  DODGE = 'DODGE',
  RECOVER = 'RECOVER',
  PHASE_CHANGE = 'PHASE_CHANGE',
  HIT = 'HIT',
  DEFEAT = 'DEFEAT',
}

export class EnemyAI {
  state: AIState = AIState.IDLE;
  protected waitTimerMs = 0;
  protected stateTimerMs = 0;
  protected cooldownMs = 0;
  protected specialTimerMs = 0;
  private targetWasAttacking = false;
  protected readonly rand: () => number;
  /** live config reference — subclasses may swap values (boss phases) */
  protected config: EnemyAIConfig;

  constructor(
    protected readonly self: Fighter,
    protected readonly target: Fighter,
    config: EnemyAIConfig,
  ) {
    this.config = { ...config, attackChoices: [...config.attackChoices] };
    this.rand = seededRandom(config.seed);
    this.specialTimerMs = config.specialCooldownMs ?? 0; // special never opens a fight
  }

  /** Weighted attack pick; the special is additionally gated by its own cooldown. */
  protected pickAttack(): string {
    const usable = this.config.attackChoices.filter((c) => {
      if (this.self.findAttack(c.id) == null) return false;
      if (c.id === this.config.specialId && this.specialTimerMs > 0) return false;
      return true;
    });
    if (usable.length === 0) return this.config.attackChoices[0]?.id ?? '';
    const total = usable.reduce((s, c) => s + c.weight, 0);
    let roll = this.rand() * total;
    for (const c of usable) {
      roll -= c.weight;
      if (roll <= 0) {
        if (c.id === this.config.specialId) this.specialTimerMs = this.config.specialCooldownMs ?? 8000;
        return c.id;
      }
    }
    return usable[usable.length - 1]?.id ?? '';
  }

  decide(dtMs: number): FighterIntent {
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    this.stateTimerMs = Math.max(0, this.stateTimerMs - dtMs);
    this.specialTimerMs = Math.max(0, this.specialTimerMs - dtMs);
    const none: FighterIntent = { ...EMPTY_INTENT };

    // boss phase pause (set by subclasses)
    if (this.state === AIState.PHASE_CHANGE) {
      if (this.stateTimerMs > 0) return none;
      this.state = AIState.WAIT;
      this.waitTimerMs = this.config.reactionDelayMs;
    }

    // mirror hard fighter conditions first
    if (this.self.isDefeated) {
      this.state = AIState.DEFEAT;
      return none;
    }
    if (this.self.isInHitStun) {
      this.state = AIState.HIT;
      return none;
    }
    if (this.self.activeAttack) {
      this.state = AIState.RECOVER;
      return none;
    }
    if (this.target.isDefeated) {
      this.state = AIState.IDLE;
      return none;
    }

    const dx = this.target.x - this.self.x;
    const distance = Math.abs(dx);
    const dir: -1 | 0 | 1 = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const range = this.config.preferredRange;

    // threat reaction: the player is swinging within reach — block or hop back
    const targetAttacking = this.target.activeAttack != null;
    const threatened = targetAttacking && distance < range * 1.5;
    if (threatened && this.state !== AIState.BLOCK && this.state !== AIState.DODGE && !this.self.isBlocking) {
      const r = this.rand();
      if (r < this.config.blockChance) {
        this.state = AIState.BLOCK;
        this.stateTimerMs = 450 + this.rand() * 350;
      } else if (r < this.config.blockChance + this.config.dodgeChance) {
        this.state = AIState.DODGE;
        this.stateTimerMs = 240 + this.rand() * 140;
      }
    }

    // whiff punish: the player's swing just ended right in front of us
    const whiffed = this.targetWasAttacking && !targetAttacking;
    this.targetWasAttacking = targetAttacking;

    switch (this.state) {
      case AIState.DEFEAT:
        return none;

      case AIState.HIT:
        // Fighter hit-stun has ended (the early return above handles the
        // frames where it is still active). Re-enter the normal decision
        // graph instead of leaving the AI permanently passive in HIT.
        this.state = AIState.IDLE;
        return none;

      case AIState.BLOCK:
        if (this.stateTimerMs <= 0 && !targetAttacking) {
          this.state = AIState.WAIT;
          this.waitTimerMs = this.config.reactionDelayMs * 0.6;
          return none;
        }
        return { ...none, block: true };

      case AIState.DODGE:
        if (this.stateTimerMs <= 0) {
          this.state = AIState.WAIT;
          this.waitTimerMs = this.config.reactionDelayMs * 0.5;
          return none;
        }
        // dedicated dodge animation when the fighter has one, else a backstep
        return { ...none, dodge: true, moveX: (-dir || -1) as -1 | 0 | 1 };

      case AIState.RECOVER:
      case AIState.IDLE:
        this.state =
          distance > range * 1.15
            ? AIState.APPROACH
            : distance < range * 0.55
              ? AIState.SPACING
              : AIState.WAIT;
        if (this.state === AIState.WAIT) this.waitTimerMs = this.config.reactionDelayMs;
        if (this.state === AIState.SPACING) this.stateTimerMs = 320 + this.rand() * 200;
        return none;

      case AIState.APPROACH:
        if (distance <= range) {
          this.state = AIState.WAIT;
          this.waitTimerMs = this.config.reactionDelayMs;
          return none;
        }
        // sprint with the run animation when closing from far away
        return { ...none, moveX: dir, run: distance > range * 2 };

      case AIState.SPACING:
        if (this.stateTimerMs <= 0 || distance >= range * 0.85) {
          this.state = AIState.WAIT;
          this.waitTimerMs = this.config.reactionDelayMs * 0.7;
          return none;
        }
        return { ...none, moveX: (-dir || 1) as -1 | 0 | 1 };

      case AIState.WAIT: {
        this.waitTimerMs -= dtMs;
        if (distance > range * 1.35) {
          this.state = AIState.APPROACH;
          return none;
        }
        // punish a whiffed player attack immediately
        if (whiffed && distance < range * 1.2 && this.cooldownMs <= 0 && this.rand() < this.config.punishChance) {
          this.state = AIState.ATTACK;
          return none;
        }
        if (this.waitTimerMs <= 0 && this.cooldownMs <= 0) {
          const r = this.rand();
          if (r < this.config.aggression) {
            this.state = AIState.ATTACK;
          } else if (r < this.config.aggression + 0.15) {
            // feint: adjust spacing instead of attacking
            this.state = AIState.SPACING;
            this.stateTimerMs = 260 + this.rand() * 180;
          } else {
            this.waitTimerMs = this.config.reactionDelayMs;
          }
        }
        return none;
      }

      case AIState.ATTACK: {
        this.state = AIState.RECOVER;
        this.cooldownMs = this.config.attackCooldownMs * (0.85 + this.rand() * 0.3);
        return { ...none, attack: true, attackId: this.pickAttack() };
      }

      default:
        return none;
    }
  }
}
