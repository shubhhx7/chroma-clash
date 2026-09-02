/**
 * Run progression model: weapon choice, three-fight sequence, upgrades,
 * carried health/energy and cumulative statistics. Pure TypeScript (no
 * Phaser) so every rule is unit-testable.
 */

export type WeaponId = 'chroma-blade' | 'battle-axe' | 'dual-blades';
export type EnemyId = 'raider' | 'guardian' | 'vael';
export type Rank = 'C' | 'B' | 'A' | 'S';

export const FIGHT_SEQUENCE: readonly EnemyId[] = ['raider', 'guardian', 'vael'] as const;

/** Typed per-fight result — the result panel reads ONLY from this object. */
export interface FightResult {
  outcome: 'victory' | 'defeat';
  enemyId: EnemyId;
  elapsedMs: number;
  damageTaken: number;
  perfectBlocks: number;
  maxCombo: number;
  hitsLanded: number;
  attacksAttempted: number;
  score: number;
  rank: Rank;
}

// ---------------------------------------------------------------- weapons

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  description: string;
  iconKey: string;
  iconSelectedKey: string;
  /** false = animation set not yet produced; selectable UI shows a lock */
  available: boolean;
  damageMult: number;
  attackSpeedMult: number;
  energyGainMult: number;
}

export const WEAPONS: readonly WeaponDefinition[] = [
  {
    id: 'chroma-blade',
    name: 'CHROMA BLADE',
    description: 'Balanced speed and damage',
    iconKey: 'ui.weapons.blade',
    iconSelectedKey: 'ui.weapons.blade_selected',
    available: true,
    damageMult: 1,
    attackSpeedMult: 1,
    energyGainMult: 1,
  },
  {
    id: 'battle-axe',
    name: 'BATTLE AXE',
    description: 'Slow, brutal, guard-crushing',
    iconKey: 'ui.weapons.axe',
    iconSelectedKey: 'ui.weapons.axe_selected',
    available: false, // dedicated swing animation set not yet produced
    damageMult: 1.3,
    attackSpeedMult: 0.85,
    energyGainMult: 0.9,
  },
  {
    id: 'dual-blades',
    name: 'DUAL BLADES',
    description: 'Fast chains, lower damage',
    iconKey: 'ui.weapons.dual',
    iconSelectedKey: 'ui.weapons.dual_selected',
    available: false, // dedicated swing animation set not yet produced
    damageMult: 0.8,
    attackSpeedMult: 1.2,
    energyGainMult: 1.25,
  },
] as const;

// ---------------------------------------------------------------- upgrades

/** Multiplicative / additive gameplay modifiers accumulated over a run. */
export interface RunModifiers {
  damageMult: number;
  attackSpeedMult: number;
  energyGainMult: number;
  specialDamageMult: number;
  parryWindowBonusMs: number;
  dashCooldownMult: number;
  guardChipMult: number;
  comboScoreMult: number;
}

export function defaultModifiers(): RunModifiers {
  return {
    damageMult: 1,
    attackSpeedMult: 1,
    energyGainMult: 1,
    specialDamageMult: 1,
    parryWindowBonusMs: 0,
    dashCooldownMult: 1,
    guardChipMult: 1,
    comboScoreMult: 1,
  };
}

export interface UpgradeDefinition {
  id: string;
  title: string;
  description: string;
  iconKey: string;
  effect: Partial<RunModifiers> & { maxHealthBonus?: number; healAmount?: number; healPercent?: number };
}

export const UPGRADE_POOL: readonly UpgradeDefinition[] = [
  { id: 'sharpened-edge', title: 'SHARPENED EDGE', description: '+15% weapon damage', iconKey: 'ui.upgrades.icon_damage', effect: { damageMult: 1.15 } },
  { id: 'quick-hands', title: 'QUICK HANDS', description: '+10% attack speed', iconKey: 'ui.upgrades.icon_speed', effect: { attackSpeedMult: 1.1 } },
  { id: 'vital-core', title: 'VITAL CORE', description: '+20 max health, heal 20', iconKey: 'ui.upgrades.icon_health', effect: { maxHealthBonus: 20, healAmount: 20 } },
  { id: 'chroma-flow', title: 'CHROMA FLOW', description: '+20% energy gain', iconKey: 'ui.upgrades.icon_energy', effect: { energyGainMult: 1.2 } },
  { id: 'burst-amplifier', title: 'BURST AMPLIFIER', description: '+20% special damage', iconKey: 'ui.upgrades.icon_special', effect: { specialDamageMult: 1.2 } },
  { id: 'guard-discipline', title: 'GUARD DISCIPLINE', description: 'Wider perfect-block window', iconKey: 'ui.upgrades.icon_guard', effect: { parryWindowBonusMs: 50 } },
  { id: 'swift-step', title: 'SWIFT STEP', description: 'Faster dash recovery', iconKey: 'ui.upgrades.icon_speed', effect: { dashCooldownMult: 0.6 } },
  { id: 'impact-drive', title: 'IMPACT DRIVE', description: 'Heavy attacks crush guards', iconKey: 'ui.upgrades.icon_damage', effect: { guardChipMult: 1.7 } },
  { id: 'second-wind', title: 'SECOND WIND', description: 'Heal 25% immediately', iconKey: 'ui.upgrades.icon_health', effect: { healPercent: 0.25 } },
  { id: 'combo-engine', title: 'COMBO ENGINE', description: '+50% combo score bonus', iconKey: 'ui.upgrades.icon_combo', effect: { comboScoreMult: 1.5 } },
] as const;

// ---------------------------------------------------------------- run state

export interface RunTotals {
  timeMs: number;
  damageTaken: number;
  perfectBlocks: number;
  maxCombo: number;
  score: number;
}

export class RunState {
  weaponId: WeaponId;
  fightIndex = 0;
  health: number;
  maxHealth: number;
  energy = 0;
  upgrades: string[] = [];
  modifiers: RunModifiers = defaultModifiers();
  totals: RunTotals = { timeMs: 0, damageTaken: 0, perfectBlocks: 0, maxCombo: 0, score: 0 };

  constructor(weaponId: WeaponId, baseMaxHealth: number) {
    this.weaponId = weaponId;
    this.maxHealth = baseMaxHealth;
    this.health = baseMaxHealth;
    this.recomputeModifiers();
  }

  get weapon(): WeaponDefinition {
    const w = WEAPONS.find((x) => x.id === this.weaponId);
    if (!w) throw new Error(`unknown weapon ${this.weaponId}`);
    return w;
  }

  get enemyId(): EnemyId {
    return FIGHT_SEQUENCE[Math.min(this.fightIndex, FIGHT_SEQUENCE.length - 1)] ?? 'raider';
  }

  get isFinalFight(): boolean {
    return this.fightIndex >= FIGHT_SEQUENCE.length - 1;
  }

  /** Weapon profile + every taken upgrade folded into one modifier set. */
  recomputeModifiers(): void {
    const m = defaultModifiers();
    const w = this.weapon;
    m.damageMult *= w.damageMult;
    m.attackSpeedMult *= w.attackSpeedMult;
    m.energyGainMult *= w.energyGainMult;
    for (const id of this.upgrades) {
      const u = UPGRADE_POOL.find((x) => x.id === id);
      if (!u) continue;
      const e = u.effect;
      if (e.damageMult) m.damageMult *= e.damageMult;
      if (e.attackSpeedMult) m.attackSpeedMult *= e.attackSpeedMult;
      if (e.energyGainMult) m.energyGainMult *= e.energyGainMult;
      if (e.specialDamageMult) m.specialDamageMult *= e.specialDamageMult;
      if (e.parryWindowBonusMs) m.parryWindowBonusMs += e.parryWindowBonusMs;
      if (e.dashCooldownMult) m.dashCooldownMult *= e.dashCooldownMult;
      if (e.guardChipMult) m.guardChipMult *= e.guardChipMult;
      if (e.comboScoreMult) m.comboScoreMult *= e.comboScoreMult;
    }
    this.modifiers = m;
  }

  /** Draw three distinct, not-yet-taken upgrade choices. */
  drawUpgradeChoices(rand: () => number = Math.random): UpgradeDefinition[] {
    const available = UPGRADE_POOL.filter((u) => !this.upgrades.includes(u.id));
    const pool = [...available];
    const out: UpgradeDefinition[] = [];
    while (out.length < 3 && pool.length > 0) {
      const i = Math.floor(rand() * pool.length);
      out.push(...pool.splice(i, 1));
    }
    return out;
  }

  applyUpgrade(id: string): void {
    const u = UPGRADE_POOL.find((x) => x.id === id);
    if (!u || this.upgrades.includes(id)) return;
    this.upgrades.push(id);
    if (u.effect.maxHealthBonus) {
      this.maxHealth += u.effect.maxHealthBonus;
    }
    if (u.effect.healAmount) {
      this.health = Math.min(this.maxHealth, this.health + u.effect.healAmount);
    }
    if (u.effect.healPercent) {
      this.health = Math.min(this.maxHealth, this.health + Math.round(this.maxHealth * u.effect.healPercent));
    }
    this.recomputeModifiers();
  }

  /** Fold a finished fight into the run totals. */
  recordFightResult(result: FightResult): void {
    this.totals.timeMs += result.elapsedMs;
    this.totals.damageTaken += result.damageTaken;
    this.totals.perfectBlocks += result.perfectBlocks;
    this.totals.maxCombo = Math.max(this.totals.maxCombo, result.maxCombo);
    this.totals.score += result.score;
  }

  advance(): void {
    this.fightIndex = Math.min(this.fightIndex + 1, FIGHT_SEQUENCE.length - 1);
  }
}
