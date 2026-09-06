import { test, expect } from '@playwright/test';

interface BattleHook {
  phase: string;
  kairoX: number;
  raiderX: number;
  kairoHealth: number;
  raiderHealth: number;
  enemyAIState: string;
  enemyAttackId: string | null;
  enemyAttackInstanceId: number;
}

test('mobile Raider recovers after being hit, uses both attacks, and deals measured damage', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/?scene=battle');
  await page.waitForFunction('window.__ccBattle && window.__ccBattle.phase === "fighting"', undefined, { timeout: 30_000 });
  await page.evaluate(() => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      kairo: { sprite: Phaser.GameObjects.Sprite };
      enemy: { sprite: Phaser.GameObjects.Sprite };
    };
    scene.kairo.sprite.x = -520;
    scene.enemy.sprite.x = 520;
  });
  await page.waitForFunction(
    () => (window as never as { __ccBattle: BattleHook }).__ccBattle.enemyAIState === 'APPROACH',
    undefined,
    { timeout: 5_000 },
  );

  const points = await page.evaluate(() => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      touchControls: { buttons: Array<{ action: string; image: Phaser.GameObjects.Image }> };
    };
    const at = (action: string) => {
      const control = scene.touchControls.buttons.find((button) => button.action === action)?.image;
      if (!control) throw new Error(`Missing touch control: ${action}`);
      return { x: control.x, y: control.y };
    };
    return { moveRight: at('MOVE_RIGHT'), attack: at('ATTACK') };
  });

  // Close to combat distance with the real touch control, then land a real
  // mobile attack so the Raider enters the HIT state that used to trap its AI.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: points.moveRight.x, y: points.moveRight.y, id: 1 }],
  });
  await page.waitForFunction(
    () => {
      const battle = (window as never as { __ccBattle: BattleHook }).__ccBattle;
      return Math.abs(battle.raiderX - battle.kairoX) < 205;
    },
    undefined,
    { timeout: 8_000 },
  );
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const enemyHealthBefore = ((await page.evaluate('window.__ccBattle')) as BattleHook).raiderHealth;
  for (let attempt = 0; attempt < 12; attempt++) {
    await page.touchscreen.tap(points.attack.x, points.attack.y);
    await page.waitForTimeout(420);
    const current = ((await page.evaluate('window.__ccBattle')) as BattleHook).raiderHealth;
    if (current < enemyHealthBefore) break;
  }
  const afterPlayerHit = (await page.evaluate('window.__ccBattle')) as BattleHook;
  expect(afterPlayerHit.raiderHealth, 'mobile attack hit detection damages the Raider').toBeLessThan(enemyHealthBefore);

  await page.waitForFunction(
    () => (window as never as { __ccBattle: BattleHook }).__ccBattle.enemyAIState !== 'HIT',
    undefined,
    { timeout: 4_000 },
  );

  const start = (await page.evaluate('window.__ccBattle')) as BattleHook;
  const attackIds = new Set<string>();
  let last = start;
  for (let i = 0; i < 180; i++) {
    last = (await page.evaluate('window.__ccBattle')) as BattleHook;
    if (last.enemyAttackId) attackIds.add(last.enemyAttackId);
    if (attackIds.size >= 2 && last.kairoHealth < start.kairoHealth) break;
    await page.waitForTimeout(100);
  }

  const attacksUsed = last.enemyAttackInstanceId - start.enemyAttackInstanceId;
  expect([...attackIds].sort()).toEqual(['raider-attack-1', 'raider-attack-2']);
  expect(last.kairoHealth, 'Raider attacks deal real damage on mobile').toBeLessThan(start.kairoHealth);
  expect(attacksUsed, 'Raider resumes active combat').toBeGreaterThanOrEqual(2);
  expect(attacksUsed, 'cooldowns prevent attack spam').toBeLessThanOrEqual(9);

  const damage = await page.evaluate(() => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      enemy: { config: { attacks: Array<{ id: string; damage: number }> } };
    };
    return scene.enemy.config.attacks.map(({ id, damage }) => ({ id, damage }));
  });
  expect(damage).toEqual([
    { id: 'raider-attack-1', damage: 8 },
    { id: 'raider-attack-2', damage: 11 },
  ]);

  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  await context.close();
});
