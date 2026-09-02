/**
 * Combat orchestrator: each update, checks every attacker's frame-timed
 * hitbox against every opponent's hurtbox, resolves blocks and perfect
 * parries, enforces the one-hit-per-swing rule, applies damage/energy and
 * emits events for feedback systems (VFX, hit stop, camera shake, HUD).
 */
import Phaser from 'phaser';
import type { Fighter } from '../entities/Fighter';
import { rectsOverlap, type HitEvent } from './combatTypes';
import { HitboxSystem } from './HitboxSystem';
import { HurtboxSystem } from './HurtboxSystem';
import { applyDamage, shouldRegisterHit } from './DamageSystem';
import { isGuardBroken, PERFECT_BLOCK_WINDOW_MS, resolveBlockedDamage } from './BlockSystem';
import { evaluateKnockout, type KOOutcome } from './KnockoutSystem';
import { COMBAT_EVENTS } from '../config/constants';
import { FighterStateId } from '../state/FighterState';

export class CombatSystem {
  private readonly hitboxes = new HitboxSystem();
  private readonly hurtboxes = new HurtboxSystem();
  private koFired = false;

  constructor(
    private readonly events: Phaser.Events.EventEmitter,
    private readonly player: Fighter,
    private readonly enemy: Fighter,
    /** monotonic clock (scene time) for guard-break windows */
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Effective damage of an attack, including the attacker's run modifiers. */
  private effectiveDamage(attacker: Fighter, base: number, isSpecial: boolean): number {
    const mult = attacker.modifiers.damageMult * (isSpecial ? attacker.modifiers.specialDamageMult : 1);
    return Math.max(1, Math.round(base * mult));
  }

  reset(): void {
    this.koFired = false;
  }

  update(): void {
    this.checkPair(this.player, this.enemy);
    this.checkPair(this.enemy, this.player);

    if (!this.koFired) {
      const outcome: KOOutcome = evaluateKnockout(this.player.health, this.enemy.health);
      if (outcome !== 'none') {
        this.koFired = true;
        this.events.emit(COMBAT_EVENTS.KO, outcome);
      }
    }
  }

  private checkPair(attacker: Fighter, target: Fighter): void {
    const attack = attacker.activeAttack;
    if (!attack) return;
    const hitbox = this.hitboxes.activeHitbox(attacker);
    if (!hitbox) return;
    const hurtbox = this.hurtboxes.hurtbox(target);
    if (!hurtbox) return;
    if (!rectsOverlap(hitbox, hurtbox)) return;
    if (!shouldRegisterHit(attack.canHitOncePerTarget, attacker.hitTargets, target.id)) return;

    // contact point: horizontal middle of the hitbox/hurtbox overlap, upper torso height
    const overlapL = Math.max(hitbox.x, hurtbox.x);
    const overlapR = Math.min(hitbox.x + hitbox.w, hurtbox.x + hurtbox.w);
    const contactX = (overlapL + overlapR) / 2;
    const contactY = hurtbox.y + hurtbox.h * 0.35;

    const isSpecial = attack.energyCost != null;
    const damage = this.effectiveDamage(attacker, attack.damage, isSpecial);

    // ---- block / perfect parry ----
    const facingAttacker = Math.sign(attacker.x - target.x) === target.facing;
    if (target.isBlocking && facingAttacker) {
      attacker.hitTargets.add(target.id); // the swing is spent either way
      const parryWindow = PERFECT_BLOCK_WINDOW_MS + target.modifiers.parryWindowBonusMs;
      const res = resolveBlockedDamage(damage, target.blockHeldMs, parryWindow);
      if (res.wasPerfect && target.hasAnimation('parry')) {
        // perfect parry: no damage, attacker staggered, defender counters
        attacker.applyStagger(700, -attacker.facing * 60);
        target.gainEnergy(25);
        target.stateMachine.transition(FighterStateId.PERFECT_BLOCK_COUNTER, true);
        this.events.emit(COMBAT_EVENTS.PARRY, { targetId: target.id, contactX, contactY });
        return;
      }
      // chip damage; heavy attacks with Impact Drive crush guards harder
      const chipMult = attack.id.endsWith('-heavy') ? attacker.modifiers.guardChipMult : 1;
      const chip = Math.round(res.damage * chipMult);
      target.health = applyDamage(target.health, chip, target.config.maxHealth);
      target.gainEnergy(5);
      target.applyBlockPushback(attacker.facing);

      // guard break: sustained pressure staggers the blocker
      target.blockedHitTimes.push(this.now());
      if (isGuardBroken(target.blockedHitTimes, this.now())) {
        target.blockedHitTimes.length = 0;
        target.applyStagger(900, attacker.facing * 90);
        this.events.emit(COMBAT_EVENTS.GUARD_BREAK, { targetId: target.id, contactX, contactY });
      } else {
        this.events.emit(COMBAT_EVENTS.HIT_BLOCKED, { targetId: target.id, contactX, contactY });
      }
      this.events.emit(COMBAT_EVENTS.HEALTH_CHANGED, {
        fighterId: target.id,
        health: target.health,
        maxHealth: target.config.maxHealth,
      });
      if (target.health <= 0) target.onDamaged(attack, attacker.facing);
      return;
    }

    // ---- clean hit ----
    attacker.hitTargets.add(target.id);
    target.health = applyDamage(target.health, damage, target.config.maxHealth);
    target.onDamaged(attack, attacker.facing);
    attacker.gainEnergy(attack.energyGain ?? 6);
    target.gainEnergy(8);

    const hit: HitEvent = {
      attackerId: attacker.id,
      targetId: target.id,
      attack,
      damage,
      contactX,
      contactY,
    };
    this.events.emit(COMBAT_EVENTS.HIT_CONFIRMED, hit);
    this.events.emit(COMBAT_EVENTS.HEALTH_CHANGED, {
      fighterId: target.id,
      health: target.health,
      maxHealth: target.config.maxHealth,
    });
  }
}
