import { describe, expect, it } from 'vitest';
import { FIGHT_SEQUENCE, RunState, UPGRADE_POOL, WEAPONS } from '../../src/game/data/runState';

describe('RunState', () => {
  it('progresses Raider -> Guardian -> Vael', () => {
    const run = new RunState('chroma-blade', 100);
    expect(run.enemyId).toBe('raider');
    expect(run.isFinalFight).toBe(false);
    run.advance();
    expect(run.enemyId).toBe('guardian');
    run.advance();
    expect(run.enemyId).toBe('vael');
    expect(run.isFinalFight).toBe(true);
    run.advance(); // clamps
    expect(run.enemyId).toBe('vael');
  });

  it('draws exactly three distinct, not-yet-taken upgrades', () => {
    const run = new RunState('chroma-blade', 100);
    const choices = run.drawUpgradeChoices(() => 0.42);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map((c) => c.id)).size).toBe(3);
    run.applyUpgrade(choices[0]!.id);
    const next = run.drawUpgradeChoices(() => 0.42);
    expect(next.map((c) => c.id)).not.toContain(choices[0]!.id);
  });

  it('applies upgrade modifiers', () => {
    const run = new RunState('chroma-blade', 100);
    run.applyUpgrade('sharpened-edge');
    expect(run.modifiers.damageMult).toBeCloseTo(1.15);
    run.applyUpgrade('quick-hands');
    expect(run.modifiers.attackSpeedMult).toBeCloseTo(1.1);
    expect(run.upgrades).toHaveLength(2);
  });

  it('Vital Core raises max health and heals', () => {
    const run = new RunState('chroma-blade', 100);
    run.health = 50;
    run.applyUpgrade('vital-core');
    expect(run.maxHealth).toBe(120);
    expect(run.health).toBe(70);
  });

  it('Second Wind heals 25% of max', () => {
    const run = new RunState('chroma-blade', 100);
    run.health = 40;
    run.applyUpgrade('second-wind');
    expect(run.health).toBe(65);
  });

  it('duplicate upgrade application is a no-op', () => {
    const run = new RunState('chroma-blade', 100);
    run.applyUpgrade('vital-core');
    run.applyUpgrade('vital-core');
    expect(run.maxHealth).toBe(120);
    expect(run.upgrades).toHaveLength(1);
  });

  it('a new run resets upgrades and totals', () => {
    const run = new RunState('chroma-blade', 100);
    run.applyUpgrade('sharpened-edge');
    run.recordFightResult({
      outcome: 'victory', enemyId: 'raider', elapsedMs: 30_000, damageTaken: 10,
      perfectBlocks: 2, maxCombo: 5, hitsLanded: 12, attacksAttempted: 18, score: 1500, rank: 'B',
    });
    const fresh = new RunState(run.weaponId, 100);
    expect(fresh.upgrades).toHaveLength(0);
    expect(fresh.totals.score).toBe(0);
    expect(fresh.modifiers.damageMult).toBe(1);
  });

  it('weapon stat profiles fold into modifiers', () => {
    const axe = new RunState('battle-axe', 100);
    expect(axe.modifiers.damageMult).toBeCloseTo(1.3);
    expect(axe.modifiers.attackSpeedMult).toBeCloseTo(0.85);
  });

  it('totals accumulate across fights', () => {
    const run = new RunState('chroma-blade', 100);
    const result = {
      outcome: 'victory' as const, enemyId: 'raider' as const, elapsedMs: 20_000, damageTaken: 12,
      perfectBlocks: 1, maxCombo: 4, hitsLanded: 10, attacksAttempted: 15, score: 1000, rank: 'C' as const,
    };
    run.recordFightResult(result);
    run.recordFightResult({ ...result, enemyId: 'guardian', maxCombo: 7, score: 1400 });
    expect(run.totals.timeMs).toBe(40_000);
    expect(run.totals.maxCombo).toBe(7);
    expect(run.totals.score).toBe(2400);
    expect(run.totals.damageTaken).toBe(24);
  });

  it('pool and sequence sanity', () => {
    expect(FIGHT_SEQUENCE).toEqual(['raider', 'guardian', 'vael']);
    expect(UPGRADE_POOL.length).toBeGreaterThanOrEqual(10);
    expect(WEAPONS.filter((w) => w.available).length).toBeGreaterThanOrEqual(1);
  });
});
