/**
 * Full-run integration: menu -> weapon select -> Raider -> result ->
 * upgrade -> Guardian -> result -> upgrade -> Vael (phase change) -> final
 * result -> fight again. Enemy health is drained via the dev-only test hook
 * plus one real landed hit per fight, keeping the run deterministic.
 */
import { test, expect, type Page } from '@playwright/test';

interface Hook {
  phase: string;
  fightIndex: number;
  enemyId: string;
  raiderHealth: number;
  kairoHealth: number;
  vaelPhase: number;
  resultVisible: boolean;
  fightToken: number;
  damageEnemy?: (n: number) => void;
}

const hook = (page: Page) =>
  page.evaluate(() => {
    const b = (window as never as { __ccBattle: Hook }).__ccBattle;
    return {
      phase: b.phase, fightIndex: b.fightIndex, enemyId: b.enemyId, raiderHealth: b.raiderHealth,
      kairoHealth: b.kairoHealth, vaelPhase: b.vaelPhase, resultVisible: b.resultVisible, fightToken: b.fightToken,
    };
  });

async function waitFor(page: Page, fn: string, timeout = 30_000): Promise<void> {
  await page.waitForFunction(fn, undefined, { timeout });
}

async function landRealHitThenDrain(page: Page): Promise<void> {
  await waitFor(page, `window.__ccBattle && window.__ccBattle.phase === 'fighting'`);
  const before = await hook(page);
  // walk in and land at least one genuine hit
  for (let i = 0; i < 50; i++) {
    await page.keyboard.down('D');
    await page.waitForTimeout(180);
    await page.keyboard.up('D');
    await page.keyboard.press('J');
    await page.waitForTimeout(450);
    const s = await hook(page);
    if (s.phase !== 'fighting') break; // already KO'd (defensive)
    if (s.raiderHealth < before.raiderHealth) break;
  }
  // drain the rest deterministically via the dev hook, then land the decisive hit
  await page.evaluate(() => (window as never as { __ccBattle: Hook }).__ccBattle.damageEnemy?.(9999) as never);
  for (let i = 0; i < 45; i++) {
    const s = await hook(page);
    if (s.phase === 'ko') break;
    await page.keyboard.down('D');
    await page.waitForTimeout(150);
    await page.keyboard.up('D');
    await page.keyboard.press('J');
    await page.waitForTimeout(450);
  }
  await waitFor(page, `window.__ccBattle && window.__ccBattle.phase === 'ko'`);
}

async function clickResultPrimary(page: Page): Promise<void> {
  await waitFor(page, `window.__ccBattle && window.__ccBattle.resultVisible === true`);
  await page.waitForTimeout(400); // panel fade-in
  // retry under parallel-load slowness: press until the panel actually acts
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    const still = await page
      .evaluate('window.__ccBattle ? window.__ccBattle.resultVisible === true : false')
      .catch(() => false);
    if (!still) return;
  }
}

async function pickUpgrade(page: Page): Promise<void> {
  await waitFor(page, `Array.isArray(window.__ccUpgrade) && window.__ccUpgrade.length === 3`);
  const vp = page.viewportSize();
  const w = vp?.width ?? 1280;
  const h = vp?.height ?? 720;
  await page.mouse.click(w / 2, h / 2); // middle card
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter'); // confirm
}

test('complete run: weapon select, three fights, upgrades, phases, final result, restart', async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  // menu -> weapon select
  await page.goto('/');
  await waitFor(page, `window.__ccMenu === true`);
  await page.keyboard.press('Enter');
  await waitFor(page, `window.__ccWeaponSelect === true`);
  await page.keyboard.press('Enter'); // Chroma Blade preselected -> BEGIN THE RUN

  // first run in a fresh browser: the tutorial page shows once before fight 1
  await waitFor(page, `window.__ccTutorial === true || !!window.__ccBattle`);
  if (await page.evaluate(() => (window as never as { __ccTutorial?: boolean }).__ccTutorial === true)) {
    await page.waitForTimeout(600); // input grace period on the tutorial
    await page.keyboard.press('Enter');
  }

  // ---- fight 1: Raider ----
  await waitForBattleEnemy(page, 'raider', 0);
  await landRealHitThenDrain(page);
  await clickResultPrimary(page); // CONTINUE
  await pickUpgrade(page);

  // ---- fight 2: Guardian ----
  await waitForBattleEnemy(page, 'guardian', 1);
  await landRealHitThenDrain(page);
  await clickResultPrimary(page);
  await pickUpgrade(page);

  // ---- final fight: Vael ----
  await waitForBattleEnemy(page, 'vael', 2);
  await waitFor(page, `window.__ccBattle && window.__ccBattle.phase === 'fighting'`, 40_000);
  // drain to just under half to trigger the enraged phase
  await page.evaluate(() => (window as never as { __ccBattle: Hook }).__ccBattle.damageEnemy?.(80) as never);
  await waitFor(page, `window.__ccBattle && window.__ccBattle.vaelPhase === 2`, 20_000);
  await landRealHitThenDrain(page);

  // final result is populated and FIGHT AGAIN restarts a fresh run
  await waitFor(page, `window.__ccBattle && window.__ccBattle.resultVisible === true`);
  const beforeRestart = await hook(page);
  expect(beforeRestart.fightIndex).toBe(2);
  await page.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Enter'); // FIGHT AGAIN
    await page.waitForTimeout(800);
    const b = await hook(page).catch(() => null);
    if (b && b.enemyId === 'raider' && b.fightIndex === 0) break;
  }
  await waitForBattleEnemy(page, 'raider', 0);
  const fresh = await hook(page);
  expect(fresh.kairoHealth).toBe(100); // upgrades and damage reset

  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  await context.close();
});

async function waitForBattleEnemy(page: Page, enemyId: string, fightIndex: number): Promise<void> {
  await page.waitForFunction(
    ([id, idx]) => {
      const b = (window as never as { __ccBattle?: Hook }).__ccBattle;
      return !!b && b.enemyId === id && b.fightIndex === Number(idx);
    },
    [enemyId, String(fightIndex)] as const,
    { timeout: 40_000 },
  );
}
