/**
 * Data-driven fighter base class shared by Kairo and every enemy.
 * Owns: sprite, animation controller, state machine, health, energy, facing,
 * hurtbox, active attack bookkeeping, chaining, jump physics, block state
 * and knockback. Driven each frame by an intent (player input or AI).
 */
import Phaser from 'phaser';
import type { FighterConfig } from '../data/fighterConfigs';
import type { AttackDefinition, WorldRect } from '../combat/combatTypes';
import { resolveRect } from '../combat/combatTypes';
import { AnimationController } from '../animation/AnimationController';
import { FighterStateMachine } from '../state/FighterStateMachine';
import { FighterStateId } from '../state/FighterState';
import {
  AttackState,
  BackwardDodgeState,
  BlockState,
  CounterState,
  DefeatState,
  HitState,
  IdleState,
  JumpState,
  VictoryState,
  WalkState,
} from '../state/states';
import { ENERGY_MAX, GRAVITY, GROUND_Y, JUMP_VELOCITY } from '../config/constants';
import { clamp } from '../utils/math';
import { EMPTY_INTENT, type FighterIntent } from './fighterIntent';
import { defaultModifiers, type RunModifiers } from '../data/runState';

export { EMPTY_INTENT, type FighterIntent } from './fighterIntent';

export class Fighter {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly anims: AnimationController;
  readonly stateMachine: FighterStateMachine<Fighter>;
  readonly config: FighterConfig;

  health: number;
  energy = 0;
  facing: 1 | -1 = 1;
  intent: FighterIntent = { ...EMPTY_INTENT };
  /** run upgrades / weapon profile (player only; enemies keep defaults) */
  modifiers: RunModifiers = defaultModifiers();
  /** rolling timestamps of hits absorbed while blocking (guard break) */
  blockedHitTimes: number[] = [];
  /** notified when SPECIAL is pressed without a full meter (UI feedback) */
  onSpecialDenied: (() => void) | null = null;
  /** per-attack-id cooldown expiry timestamps */
  private attackCooldowns = new Map<string, number>();

  /** currently executing attack, if any */
  activeAttack: AttackDefinition | null = null;
  /** the definition the AttackState should start with */
  pendingAttackDef: AttackDefinition | null = null;
  /** unique id per swing — enforces one-hit-per-swing */
  attackInstanceId = 0;
  /** targets already hit by the current swing */
  hitTargets = new Set<string>();
  /** combo chain input buffered inside the attack state */
  chainQueued = false;

  /** small vertical breathing offset applied by IdleState (never a scale change) */
  visualBob = 0;
  hitStunRemainingMs = 0;
  blockHeldMs = 0;

  /**
   * Fighting-game input buffer: an action press stays valid for a short
   * window so inputs landed during hit-stun / recovery still come out.
   */
  private pressBuffer = new Map<string, number>();
  private static readonly PRESS_BUFFER_MS = 220;

  bufferPress(kind: string): void {
    this.pressBuffer.set(kind, this.scene.time.now + Fighter.PRESS_BUFFER_MS);
  }

  hasPress(kind: string): boolean {
    const expiry = this.pressBuffer.get(kind);
    return expiry != null && expiry > this.scene.time.now;
  }

  clearPress(kind: string): void {
    this.pressBuffer.delete(kind);
  }

  private pendingKnockbackX = 0;
  private velocityX = 0;
  private altitude = 0;
  private verticalVel = 0;
  private stageMinX = -Infinity;
  private stageMaxX = Infinity;

  constructor(
    protected readonly scene: Phaser.Scene,
    config: FighterConfig,
    x: number,
    facing: 1 | -1,
  ) {
    this.config = config;
    this.health = config.maxHealth;
    this.facing = facing;

    this.sprite = scene.add.sprite(x, GROUND_Y, config.animations.idle.textureKey, 0);
    this.sprite.setOrigin(0.5, 1);
    this.anims = new AnimationController(this.sprite, config.animations);

    this.stateMachine = new FighterStateMachine<Fighter>(this)
      .register(new IdleState())
      .register(new WalkState())
      .register(new AttackState())
      .register(new BlockState())
      .register(new BackwardDodgeState())
      .register(new CounterState())
      .register(new JumpState())
      .register(new HitState())
      .register(new DefeatState())
      .register(new VictoryState());
    this.stateMachine.start(FighterStateId.IDLE);
    this.applyFacing();

    this.anims.onComplete((name) => {
      const state = this.stateMachine.current;
      if (state === FighterStateId.BASIC_ATTACK_1 && name === this.activeAttack?.animation) {
        this.stateMachine.transition(FighterStateId.IDLE);
      } else if (state === FighterStateId.PERFECT_BLOCK_COUNTER && name === 'parry') {
        this.stateMachine.transition(FighterStateId.IDLE);
      } else if (state === FighterStateId.BACKWARD_DODGE && name === 'dodge') {
        this.stateMachine.transition(FighterStateId.IDLE);
      }
    });
  }

  get id(): string {
    return this.config.id;
  }

  get x(): number {
    return this.sprite.x;
  }

  get isDefeated(): boolean {
    return this.stateMachine.current === FighterStateId.DEFEAT;
  }

  get isInHitStun(): boolean {
    return this.stateMachine.current === FighterStateId.HIT;
  }

  get isBlocking(): boolean {
    return this.stateMachine.current === FighterStateId.BLOCK;
  }

  get isAirborne(): boolean {
    return this.altitude > 0;
  }

  hasAnimation(name: string): boolean {
    return this.config.animations[name] != null;
  }

  canUseSpecial(): boolean {
    const def = this.findAttack('special');
    return def != null && this.energy >= (def.energyCost ?? ENERGY_MAX);
  }

  gainEnergy(amount: number): void {
    this.energy = clamp(this.energy + amount * this.modifiers.energyGainMult, 0, ENERGY_MAX);
  }

  setStageBounds(minX: number, maxX: number): void {
    this.stageMinX = minX;
    this.stageMaxX = maxX;
    this.sprite.x = clamp(this.sprite.x, minX, maxX);
  }

  setVelocityX(vx: number): void {
    this.velocityX = vx;
  }

  face(direction: 1 | -1): void {
    if (this.facing === direction) return;
    this.facing = direction;
    this.applyFacing();
  }

  private applyFacing(): void {
    // flip when desired facing differs from the art's drawn facing
    const flip = this.facing !== this.config.artFacing;
    const mag = Math.abs(this.sprite.scaleX) || 1;
    this.sprite.setScale(flip ? -mag : mag, this.sprite.scaleY || 1);
  }

  /**
   * Resolve an attack id or alias ('light' | 'heavy' | 'dash' | 'special')
   * against the config's attack list.
   */
  findAttack(idOrAlias: string): AttackDefinition | null {
    const exact = this.config.attacks.find((a) => a.id === idOrAlias);
    if (exact) return exact;
    const suffixed = this.config.attacks.find((a) => a.id.endsWith(`-${idOrAlias}`));
    if (suffixed) return suffixed;
    if (idOrAlias === 'light') return this.config.attacks[0] ?? null;
    return null;
  }

  /** Start an attack if the state machine allows it. Pays energy costs and cooldowns. */
  tryStartAttack(idOrAlias: string): boolean {
    const def = this.findAttack(idOrAlias);
    if (!def) return false;
    if (def.energyCost && this.energy < def.energyCost) {
      this.onSpecialDenied?.();
      return false;
    }
    if (def.cooldownMs) {
      const mult = def.id.endsWith('-dash') ? this.modifiers.dashCooldownMult : 1;
      const readyAt = this.attackCooldowns.get(def.id) ?? 0;
      if (this.scene.time.now < readyAt) return false;
      this.attackCooldowns.set(def.id, this.scene.time.now + def.cooldownMs * mult);
    }
    this.pendingAttackDef = def;
    const ok = this.stateMachine.transition(FighterStateId.BASIC_ATTACK_1);
    if (ok && def.energyCost) this.energy -= def.energyCost;
    if (!ok) this.pendingAttackDef = null;
    return ok;
  }

  /** Swap to the next combo attack without leaving the attack state. */
  startChainedAttack(id: string): boolean {
    const def = this.findAttack(id);
    if (!def) return false;
    this.activeAttack = def;
    this.attackInstanceId++;
    this.hitTargets.clear();
    this.lastCombatFrame = -1;
    this.anims.play(def.animation, true);
    return true;
  }

  beginAttackInstance(): void {
    this.activeAttack = this.pendingAttackDef ?? this.config.attacks[0] ?? null;
    this.pendingAttackDef = null;
    this.attackInstanceId++;
    this.hitTargets.clear();
    this.lastCombatFrame = -1;
    // Quick Hands & weapon speed profiles scale the swing animation
    this.sprite.anims.timeScale = this.modifiers.attackSpeedMult;
  }

  endAttackInstance(): void {
    this.activeAttack = null;
    this.hitTargets.clear();
    this.chainQueued = false;
    this.sprite.anims.timeScale = 1;
  }

  launchJump(): void {
    this.verticalVel = JUMP_VELOCITY;
    this.altitude = Math.max(this.altitude, 0.01);
  }

  /** last animation frame consumed by the combat poll (skip-proof windows) */
  private lastCombatFrame = -1;

  /**
   * World-space hitbox for the current animation frame, or null outside
   * active frames. A hitbox exists ONLY on active frames. (Pure — used by
   * the debug overlay; combat uses combatHitbox below.)
   */
  currentHitbox(): WorldRect | null {
    if (!this.activeAttack) return null;
    if (this.stateMachine.current !== FighterStateId.BASIC_ATTACK_1) return null;
    const frame = this.anims.frameIndex;
    if (!this.activeAttack.activeFrames.includes(frame)) return null;
    const def = this.activeAttack.hitboxByFrame[frame];
    if (!def) return null;
    return resolveRect(def, this.sprite.x, this.sprite.y, this.facing);
  }

  /**
   * Combat hitbox poll: scans EVERY animation frame traversed since the
   * previous poll, so short active windows are never skipped when the
   * renderer drops frames (low-end phones, heavy load). One-hit-per-swing
   * is still enforced by hitTargets.
   */
  combatHitbox(): WorldRect | null {
    if (!this.activeAttack || this.stateMachine.current !== FighterStateId.BASIC_ATTACK_1) {
      this.lastCombatFrame = -1;
      return null;
    }
    const cur = this.anims.frameIndex;
    const from = this.lastCombatFrame < 0 ? 0 : Math.min(this.lastCombatFrame + 1, cur);
    let found: WorldRect | null = null;
    for (let f = from; f <= cur; f++) {
      if (!this.activeAttack.activeFrames.includes(f)) continue;
      const def = this.activeAttack.hitboxByFrame[f];
      if (def) {
        found = resolveRect(def, this.sprite.x, this.sprite.y, this.facing);
        break;
      }
    }
    this.lastCombatFrame = cur;
    return found;
  }

  /** World-space hurtbox. Separate from any physics body. */
  hurtbox(): WorldRect {
    return resolveRect(this.config.hurtbox, this.sprite.x, this.sprite.y, this.facing);
  }

  /** Called by the damage system after health has been reduced. */
  onDamaged(attack: AttackDefinition, attackerFacing: 1 | -1): void {
    this.hitStunRemainingMs = attack.hitStunMs;
    this.pendingKnockbackX = attack.knockbackX * attackerFacing;
    if (this.health <= 0) {
      this.stateMachine.transition(FighterStateId.DEFEAT, true);
    } else {
      // re-entering HIT restarts the reaction (force allows HIT -> HIT re-stun)
      this.stateMachine.transition(FighterStateId.HIT, true);
    }
  }

  /** Brief self-stun without damage (punished by a parry). */
  applyStagger(ms: number, pushbackX: number): void {
    if (this.isDefeated) return;
    this.hitStunRemainingMs = ms;
    this.pendingKnockbackX = pushbackX;
    this.stateMachine.transition(FighterStateId.HIT, true);
  }

  /** Small pushback while blocking (no state change). */
  applyBlockPushback(direction: 1 | -1): void {
    this.sprite.x = clamp(this.sprite.x + direction * 26, this.stageMinX, this.stageMaxX);
  }

  applyPendingKnockback(): void {
    this.velocityX = this.pendingKnockbackX * 3;
    this.pendingKnockbackX = 0;
  }

  dampKnockback(dtMs: number): void {
    const decay = Math.exp(-dtMs / 90);
    this.velocityX *= decay;
  }

  tickHitStun(dtMs: number): void {
    this.hitStunRemainingMs = Math.max(0, this.hitStunRemainingMs - dtMs);
  }

  update(dtMs: number): void {
    this.stateMachine.update(dtMs);
    const dt = dtMs / 1000;
    this.sprite.x = clamp(this.sprite.x + this.velocityX * dt, this.stageMinX, this.stageMaxX);

    // vertical physics (jump / air attacks)
    if (this.altitude > 0 || this.verticalVel > 0) {
      this.altitude += this.verticalVel * dt;
      this.verticalVel -= GRAVITY * dt;
      if (this.altitude <= 0) {
        this.altitude = 0;
        this.verticalVel = 0;
        if (this.stateMachine.current === FighterStateId.JUMP) {
          this.stateMachine.transition(FighterStateId.IDLE);
        }
      }
    }
    this.sprite.y = GROUND_Y - this.altitude - this.visualBob;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
