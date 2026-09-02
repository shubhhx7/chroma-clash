/**
 * Fighter state behaviours. Each state is a small, explicit class; the
 * transition table lives in the state (allowlist) plus the global guard in
 * FighterState.ts.
 *
 * BASIC_ATTACK_1 is the single generic ATTACK state: the concrete move
 * (light chain, heavy, dash, special) is the fighter's pending
 * AttackDefinition; combo chains swap the definition without leaving the
 * state.
 */
import { FighterStateId, type FighterStateHandler } from '../FighterState';
import type { Fighter } from '../../entities/Fighter';

abstract class BaseState implements FighterStateHandler<Fighter> {
  abstract readonly id: FighterStateId;
  protected abstract allowed: readonly FighterStateId[];

  enter(_ctx: Fighter): void {}
  update(_ctx: Fighter, _dtMs: number): void {}
  exit(_ctx: Fighter): void {}

  canTransitionTo(next: FighterStateId): boolean {
    return this.allowed.includes(next);
  }
}

/** Shared grounded-intent handling for IDLE and WALK. Returns true if a transition happened. */
function handleGroundIntents(ctx: Fighter): boolean {
  const i = ctx.intent;
  const start = (kind: string, action: () => boolean): boolean => {
    if (!action()) return false;
    ctx.clearPress(kind); // buffered press has been spent
    return true;
  };
  if (i.special) {
    // tryStartAttack gates on the meter and fires onSpecialDenied feedback;
    // consume the press either way so a denied press doesn't spam
    const ok = ctx.tryStartAttack('special');
    ctx.clearPress('special');
    if (ok) return true;
  }
  if (i.heavy) return start('heavy', () => ctx.tryStartAttack('heavy'));
  if (i.kick) return start('kick', () => ctx.tryStartAttack('kick'));
  if (i.dash) return start('dash', () => ctx.tryStartAttack('dash'));
  if (i.attack) return start('attack', () => ctx.tryStartAttack(i.attackId ?? 'light'));
  if (i.jump) return start('jump', () => ctx.stateMachine.transition(FighterStateId.JUMP));
  if (i.dodge && ctx.hasAnimation('dodge')) return ctx.stateMachine.transition(FighterStateId.BACKWARD_DODGE);
  if (i.block && ctx.hasAnimation('block')) return ctx.stateMachine.transition(FighterStateId.BLOCK);
  return false;
}

export class IdleState extends BaseState {
  readonly id = FighterStateId.IDLE;
  protected allowed = [
    FighterStateId.WALK,
    FighterStateId.BASIC_ATTACK_1,
    FighterStateId.JUMP,
    FighterStateId.BLOCK,
    FighterStateId.BACKWARD_DODGE,
    FighterStateId.HIT,
    FighterStateId.DEFEAT,
    FighterStateId.VICTORY,
  ] as const;

  override enter(ctx: Fighter): void {
    ctx.anims.play('idle');
    ctx.setVelocityX(0);
  }

  override update(ctx: Fighter): void {
    // the replaced idle sheet animates on its own (8 frames), so no
    // synthetic bob is applied
    if (handleGroundIntents(ctx)) return;
    if (ctx.intent.moveX !== 0) ctx.stateMachine.transition(FighterStateId.WALK);
  }

  override exit(ctx: Fighter): void {
    ctx.visualBob = 0;
  }
}

export class WalkState extends BaseState {
  readonly id = FighterStateId.WALK;
  protected allowed = [
    FighterStateId.IDLE,
    FighterStateId.BASIC_ATTACK_1,
    FighterStateId.JUMP,
    FighterStateId.BLOCK,
    FighterStateId.BACKWARD_DODGE,
    FighterStateId.HIT,
    FighterStateId.DEFEAT,
    FighterStateId.VICTORY,
  ] as const;

  private running = false;
  private currentAnim = 'walk';
  private forwardHeldMs = 0;

  override enter(ctx: Fighter): void {
    this.running = false;
    this.forwardHeldMs = 0;
    this.currentAnim = 'walk';
    ctx.anims.play('walk');
  }

  override update(ctx: Fighter, dtMs: number): void {
    if (handleGroundIntents(ctx)) return;
    if (ctx.intent.moveX === 0) {
      ctx.stateMachine.transition(FighterStateId.IDLE);
      return;
    }
    const movingForward = ctx.intent.moveX === ctx.facing;
    this.forwardHeldMs = movingForward ? this.forwardHeldMs + dtMs : 0;
    // sprint: AI charge intent, or a sustained forward hold (player)
    const wantRun = ctx.hasAnimation('run') && (ctx.intent.run === true || this.forwardHeldMs > 600);
    this.running = wantRun;
    // cautious back-walk animation when retreating (dedicated HD sheet)
    const anim = wantRun && movingForward ? 'run' : !movingForward && ctx.hasAnimation('walkback') ? 'walkback' : 'walk';
    if (anim !== this.currentAnim) {
      this.currentAnim = anim;
      ctx.anims.play(anim);
    }
    const speedMult = anim === 'run' ? 1.45 : anim === 'walkback' ? 0.85 : 1;
    ctx.setVelocityX(ctx.intent.moveX * ctx.config.walkSpeed * speedMult);
  }

  override exit(ctx: Fighter): void {
    this.running = false;
    this.currentAnim = 'walk';
    ctx.setVelocityX(0);
  }
}

/** Backward hop using the dedicated dodge sheet (Raider slide, Vael mist-step). */
export class BackwardDodgeState extends BaseState {
  readonly id = FighterStateId.BACKWARD_DODGE;
  protected allowed = [FighterStateId.IDLE, FighterStateId.HIT, FighterStateId.DEFEAT] as const;

  override enter(ctx: Fighter): void {
    ctx.anims.play('dodge', true);
    ctx.setVelocityX(-ctx.facing * ctx.config.walkSpeed * 1.7);
  }

  // ANIMATION_COMPLETE (wired in Fighter) transitions back to IDLE.

  override exit(ctx: Fighter): void {
    ctx.setVelocityX(0);
  }
}

export class AttackState extends BaseState {
  readonly id = FighterStateId.BASIC_ATTACK_1;
  protected allowed = [FighterStateId.IDLE, FighterStateId.HIT, FighterStateId.DEFEAT] as const;

  override enter(ctx: Fighter): void {
    if (!ctx.isAirborne) ctx.setVelocityX(0);
    ctx.beginAttackInstance();
    ctx.chainQueued = false;
    const def = ctx.activeAttack;
    if (def) ctx.anims.play(def.animation, true);
  }

  override update(ctx: Fighter): void {
    const def = ctx.activeAttack;
    if (!def) return;
    const frame = ctx.anims.frameIndex;

    // data-driven forward lunge (dash attack)
    if (def.lungeSpeed && def.lungeFrames?.includes(frame)) {
      ctx.setVelocityX(ctx.facing * def.lungeSpeed);
    } else if (!ctx.isAirborne) {
      ctx.setVelocityX(0);
    }

    // combo chaining: accept the light input during the chain window and
    // swap to the next attack definition without leaving the state
    if (def.chainInto && def.chainFrames) {
      if (ctx.intent.attack && def.chainFrames.includes(frame)) {
        ctx.chainQueued = true;
        ctx.clearPress('attack');
      }
      if (ctx.chainQueued && frame >= (def.chainFrames[0] ?? 0)) {
        ctx.chainQueued = false;
        if (ctx.startChainedAttack(def.chainInto)) return;
      }
    }
  }

  // ANIMATION_COMPLETE (wired in Fighter) transitions back to IDLE.

  override exit(ctx: Fighter): void {
    ctx.endAttackInstance();
  }
}

export class BlockState extends BaseState {
  readonly id = FighterStateId.BLOCK;
  protected allowed = [
    FighterStateId.IDLE,
    FighterStateId.HIT,
    FighterStateId.DEFEAT,
    FighterStateId.PERFECT_BLOCK_COUNTER,
  ] as const;

  override enter(ctx: Fighter): void {
    ctx.setVelocityX(0);
    ctx.blockHeldMs = 0;
    ctx.anims.play('block', true);
  }

  override update(ctx: Fighter, dtMs: number): void {
    ctx.blockHeldMs += dtMs;
    if (!ctx.intent.block) ctx.stateMachine.transition(FighterStateId.IDLE);
  }
}

/** Parry flourish after a perfect block — brief counter-slash animation. */
export class CounterState extends BaseState {
  readonly id = FighterStateId.PERFECT_BLOCK_COUNTER;
  protected allowed = [FighterStateId.IDLE, FighterStateId.HIT, FighterStateId.DEFEAT] as const;

  override enter(ctx: Fighter): void {
    ctx.setVelocityX(0);
    ctx.anims.play('parry', true);
  }
  // ANIMATION_COMPLETE (wired in Fighter) transitions back to IDLE.
}

export class JumpState extends BaseState {
  readonly id = FighterStateId.JUMP;
  protected allowed = [
    FighterStateId.IDLE,
    FighterStateId.BASIC_ATTACK_1,
    FighterStateId.HIT,
    FighterStateId.DEFEAT,
  ] as const;

  override enter(ctx: Fighter): void {
    ctx.launchJump();
    ctx.anims.play('jump', true);
  }

  override update(ctx: Fighter): void {
    // steering in the air + air light attack
    ctx.setVelocityX(ctx.intent.moveX * ctx.config.walkSpeed * 0.9);
    if (ctx.intent.attack) {
      const def = ctx.findAttack(ctx.intent.attackId ?? 'light');
      if (def?.airOk && ctx.tryStartAttack(def.id)) ctx.clearPress('attack');
    }
    // landing is detected by Fighter.update (altitude returns to 0)
  }
}

export class HitState extends BaseState {
  readonly id = FighterStateId.HIT;
  protected allowed = [FighterStateId.IDLE, FighterStateId.HIT, FighterStateId.DEFEAT] as const;

  override enter(ctx: Fighter): void {
    ctx.anims.play('hit', true);
    ctx.applyPendingKnockback();
  }

  override update(ctx: Fighter, dtMs: number): void {
    ctx.tickHitStun(dtMs);
    ctx.dampKnockback(dtMs);
    if (ctx.hitStunRemainingMs <= 0) {
      ctx.setVelocityX(0);
      ctx.stateMachine.transition(FighterStateId.IDLE);
    }
  }
}

export class DefeatState extends BaseState {
  readonly id = FighterStateId.DEFEAT;
  protected allowed = [] as const; // terminal

  override enter(ctx: Fighter): void {
    ctx.setVelocityX(0);
    ctx.anims.play('defeat', true);
  }
}

export class VictoryState extends BaseState {
  readonly id = FighterStateId.VICTORY;
  protected allowed = [] as const; // terminal for the round

  override enter(ctx: Fighter): void {
    ctx.setVelocityX(0);
    ctx.anims.play('idle');
  }
}
