/**
 * Responsive smoke tests for the Kairo vs Raider vertical slice.
 * Emulates desktop, laptop, tablet and phone profiles (landscape and
 * portrait) and validates the acceptance criteria from the build spec.
 */
import { test, expect, type Browser, type Page, type ConsoleMessage } from '@playwright/test';

interface Profile {
  name: string;
  width: number;
  height: number;
  touch: boolean;
}

const LANDSCAPE: Profile[] = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080, touch: false },
  { name: 'laptop-1366x768', width: 1366, height: 768, touch: false },
  { name: 'tablet-1024x768', width: 1024, height: 768, touch: true },
  { name: 'phone-844x390', width: 844, height: 390, touch: true },
  { name: 'phone-915x412', width: 915, height: 412, touch: true },
];

const PORTRAIT: Profile[] = [
  { name: 'phone-390x844', width: 390, height: 844, touch: true },
  { name: 'phone-412x915', width: 412, height: 915, touch: true },
];

interface BattleHook {
  fightToken: number;
  phase: string;
  viewport: { cssWidth: number; cssHeight: number; viewWidth: number; zoom: number };
  stageBounds: { minX: number; maxX: number };
  touchControlsVisible: boolean;
  kairoX: number;
  raiderX: number;
  kairoHealth: number;
  raiderHealth: number;
}

async function openGame(
  browser: Browser,
  profile: Profile,
  path = '/?scene=battle', // direct battle entry; the full menu flow is covered in run.spec
): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.touch,
    isMobile: profile.touch,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(path);
  return { page, errors };
}

async function waitForBattle(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as never as { __ccBattle?: unknown }).__ccBattle !== undefined, undefined, {
    timeout: 30_000,
  });
}

function battleHook(page: Page): Promise<BattleHook> {
  return page.evaluate(() => (window as never as { __ccBattle: BattleHook }).__ccBattle);
}

for (const profile of LANDSCAPE) {
  test(`landscape ${profile.name}: canvas fills viewport, no scroll, fighters in bounds`, async ({ browser }) => {
    const { page, errors } = await openGame(browser, profile);
    await waitForBattle(page);

    // no page scrolling
    const scroll = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(scroll.w, 'no horizontal scroll').toBeLessThanOrEqual(1);
    expect(scroll.h, 'no vertical scroll').toBeLessThanOrEqual(1);

    // canvas fills the viewport
    const canvasBox = await page.locator('#game-container canvas').boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(Math.abs(canvasBox?.x ?? 99), 'canvas anchored at left edge').toBeLessThanOrEqual(1);
    expect(Math.abs(canvasBox?.y ?? 99), 'canvas anchored at top edge').toBeLessThanOrEqual(1);
    expect(Math.abs((canvasBox?.width ?? 0) - profile.width)).toBeLessThanOrEqual(2);
    expect(Math.abs((canvasBox?.height ?? 0) - profile.height)).toBeLessThanOrEqual(2);

    // orientation gate must NOT be visible in landscape
    await expect(page.locator('#orientation-gate')).toBeHidden();

    const hook = await battleHook(page);
    // fighters inside stage bounds; stage inside the visible logical width
    expect(hook.kairoX).toBeGreaterThanOrEqual(hook.stageBounds.minX - 1);
    expect(hook.kairoX).toBeLessThanOrEqual(hook.stageBounds.maxX + 1);
    expect(hook.raiderX).toBeGreaterThanOrEqual(hook.stageBounds.minX - 1);
    expect(hook.raiderX).toBeLessThanOrEqual(hook.stageBounds.maxX + 1);
    expect(hook.stageBounds.maxX).toBeLessThanOrEqual(hook.viewport.viewWidth / 2);
    // no fighter cropping: hurtbox width margin inside visible area
    expect(hook.stageBounds.maxX + 70).toBeLessThanOrEqual(hook.viewport.viewWidth / 2 + 1);

    // touch controls only on coarse-pointer devices
    expect(hook.touchControlsVisible).toBe(profile.touch);

    // resize must not restart the fight
    const tokenBefore = hook.fightToken;
    await page.setViewportSize({ width: profile.width - 120, height: profile.height - 60 });
    await page.waitForTimeout(400);
    const after = await battleHook(page);
    expect(after.fightToken, 'resize must not restart the fight').toBe(tokenBefore);

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
    await page.context().close();
  });
}

for (const profile of PORTRAIT) {
  test(`portrait ${profile.name}: rotate overlay shows and game pauses`, async ({ browser }) => {
    const { page, errors } = await openGame(browser, profile);

    // rotate overlay visible with the required copy
    const gate = page.locator('#orientation-gate');
    await expect(gate).toBeVisible();
    await expect(gate).toContainText('Rotate your device to play');
    await expect(gate).toContainText('landscape');

    // game loop is asleep => game is paused
    await page.waitForFunction(
      () =>
        (window as never as { __chromaClash?: { game: { loop: { running: boolean } } } }).__chromaClash?.game.loop
          .running === false,
      undefined,
      { timeout: 20_000 },
    );

    // rotate to landscape: overlay disappears and the game resumes
    await page.setViewportSize({ width: profile.height, height: profile.width });
    await expect(gate).toBeHidden({ timeout: 10_000 });
    await page.waitForFunction(
      () =>
        (window as never as { __chromaClash?: { game: { loop: { running: boolean } } } }).__chromaClash?.game.loop
          .running === true,
      undefined,
      { timeout: 20_000 },
    );
    await waitForBattle(page);

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
    await page.context().close();
  });
}

test('raider AI approaches and damages an idle Kairo', async ({ browser }) => {
  const { page, errors } = await openGame(browser, { name: 'ai', width: 1280, height: 720, touch: false });
  await waitForBattle(page);
  await page.waitForFunction(
    () => (window as never as { __ccBattle: { phase: string } }).__ccBattle.phase === 'fighting',
    undefined,
    { timeout: 20_000 },
  );
  // stand still; the Raider should close distance and land a hit
  await page.waitForFunction(
    () => (window as never as { __ccBattle: { kairoHealth: number } }).__ccBattle.kairoHealth < 100,
    undefined,
    { timeout: 30_000 },
  );
  const s = await battleHook(page);
  expect(s.kairoHealth).toBeLessThan(100);
  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  await page.context().close();
});

test('desktop: keyboard attack damages the raider and KO/restart work', async ({ browser }) => {
  const { page, errors } = await openGame(browser, { name: 'kbd', width: 1280, height: 720, touch: false });
  await waitForBattle(page);

  // wait for the READY/FIGHT intro to finish
  await page.waitForFunction(
    () => (window as never as { __ccBattle: { phase: string } }).__ccBattle.phase === 'fighting',
    undefined,
    { timeout: 20_000 },
  );

  const before = await battleHook(page);
  expect(before.raiderHealth).toBeGreaterThan(0);

  // walk toward the raider and attack until his health drops
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down('D');
    await page.waitForTimeout(220);
    await page.keyboard.up('D');
    await page.keyboard.press('J');
    await page.waitForTimeout(420);
    const s = await battleHook(page);
    if (s.raiderHealth < before.raiderHealth) break;
  }
  const afterHit = await battleHook(page);
  expect(afterHit.raiderHealth, 'raider must take damage from Basic Attack 1').toBeLessThan(before.raiderHealth);

  // finish the fight to KO
  for (let i = 0; i < 80; i++) {
    const s = await battleHook(page);
    if (s.phase === 'ko') break;
    await page.keyboard.down('D');
    await page.waitForTimeout(160);
    await page.keyboard.up('D');
    await page.keyboard.press('J');
    await page.waitForTimeout(380);
  }
  const koState = await battleHook(page);
  expect(koState.phase, 'fight should reach KO').toBe('ko');

  // restart with R begins a fresh fight
  const tokenBefore = koState.fightToken;
  // Hold through at least one game frame. A synthetic down+up in the same
  // task can be missed by Phaser's frame-polled JustDown state under CI load.
  await page.keyboard.down('R');
  await page.waitForTimeout(100);
  await page.keyboard.up('R');
  await page.waitForFunction(
    (t) => (window as never as { __ccBattle: { fightToken: number } }).__ccBattle.fightToken !== t,
    tokenBefore,
    { timeout: 15_000 },
  );
  const fresh = await battleHook(page);
  expect(fresh.raiderHealth).toBeGreaterThan(0);
  expect(fresh.kairoHealth).toBeGreaterThan(0);

  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  await page.context().close();
});
