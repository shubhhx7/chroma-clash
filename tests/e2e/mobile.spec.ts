/**
 * Mobile interaction tests: simultaneous move + attack via two touch points
 * (CDP multitouch), block hold/release, and no stuck input after rotation.
 */
import { test, expect, type Page } from '@playwright/test';

interface Hook {
  phase: string;
  kairoX: number;
  kairoHealth: number;
  raiderHealth: number;
  kairoState: string;
  kairoAttackId: string | null;
  enemyAIState: string;
  enemyAttackId: string | null;
  enemyAttackInstanceId: number;
  touchControlsVisible: boolean;
}

const hookOf = (page: Page) =>
  page.evaluate(() => {
    const b = (window as never as { __ccBattle: Hook }).__ccBattle;
    return {
      phase: b.phase,
      kairoX: b.kairoX,
      kairoHealth: b.kairoHealth,
      raiderHealth: b.raiderHealth,
      kairoState: b.kairoState,
      kairoAttackId: b.kairoAttackId,
      enemyAIState: b.enemyAIState,
      enemyAttackId: b.enemyAttackId,
      enemyAttackInstanceId: b.enemyAttackInstanceId,
      visible: b.touchControlsVisible,
    };
  });

/** Read the rendered control centres so interaction tests also follow relayouts. */
const controlPoints = (page: Page) =>
  page.evaluate(() => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      touchControls: { buttons: Array<{ action: string; image: Phaser.GameObjects.Image }> };
    };
    const point = (name: string): { x: number; y: number } => {
      const control = scene.touchControls.buttons.find((button) => button.action === name)?.image;
      if (!control) throw new Error(`Missing touch control: ${name}`);
      return { x: control.x, y: control.y };
    };
    return {
      moveRight: point('MOVE_RIGHT'),
      attack: point('ATTACK'),
      dash: point('DASH'),
      block: point('BLOCK'),
    };
  });

test('mobile: simultaneous movement + attack, block hold, rotation does not stick input', async ({ browser }) => {
  test.setTimeout(120_000);
  const width = 844;
  const height = 390;
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=battle');
  await page.waitForFunction(() => (window as never as { __ccBattle?: { phase: string } }).__ccBattle?.phase === 'fighting', undefined, {
    timeout: 30_000,
  });
  const pts = await controlPoints(page);
  const cdp = await context.newCDPSession(page);

  // ---- multitouch: hold move-right AND tap attack at the same time ----
  const startX = (await hookOf(page)).kairoX;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 1 }],
  });
  await page.waitForTimeout(350);

  // Attack should fire while movement is held. The raider is a live AI, so
  // Kairo can be in hit-stun when the second finger lands; the press buffer
  // (220ms) then expires before the attack can start. That is a fight
  // outcome, not an input failure, so the second finger is (re)pressed while
  // Kairo is actually able to act. Movement stays held the whole time, which
  // is what this test is really asserting.
  let attackSeen = false;
  for (let attempt = 0; attempt < 6 && !attackSeen; attempt++) {
    for (let i = 0; i < 20 && (await hookOf(page)).kairoState === 'HIT'; i++) {
      await page.waitForTimeout(50);
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: pts.moveRight.x, y: pts.moveRight.y, id: 1 },
        { x: pts.attack.x, y: pts.attack.y, id: 2 },
      ],
    });
    for (let i = 0; i < 8 && !attackSeen; i++) {
      const s = await hookOf(page);
      if (s.kairoAttackId !== null || s.kairoState === 'BASIC_ATTACK_1') attackSeen = true;
      else await page.waitForTimeout(50);
    }
    if (!attackSeen) {
      // lift only the attack finger so the next attempt is a fresh press edge
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 1 }],
      });
      await page.waitForTimeout(80);
    }
  }
  expect(attackSeen, 'attack fired while movement was held').toBe(true);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: pts.attack.x, y: pts.attack.y, id: 2 }],
  });
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 1 }] });
  const moved = await hookOf(page);
  expect(moved.kairoX, 'kairo moved right while attacking').toBeGreaterThan(startX + 20);

  // ---- multitouch: movement + the dedicated Dash action ----
  let dashSeen = false;
  for (let attempt = 0; attempt < 6 && !dashSeen; attempt++) {
    await page.waitForFunction(
      () => {
        const state = (window as never as { __ccBattle: Hook }).__ccBattle.kairoState;
        return state === 'IDLE' || state === 'WALK';
      },
      undefined,
      { timeout: 5_000 },
    );
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 5 }],
    });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: pts.moveRight.x, y: pts.moveRight.y, id: 5 },
        { x: pts.dash.x, y: pts.dash.y, id: 6 },
      ],
    });
    for (let i = 0; i < 20 && !dashSeen; i++) {
      const state = await hookOf(page);
      dashSeen = state.kairoAttackId === 'kairo-dash';
      if (!dashSeen) await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (!dashSeen) await page.waitForTimeout(220);
  }
  expect(dashSeen, 'dash fired through the shared dash action while movement was held').toBe(true);

  // ---- block hold / release ----
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: pts.block.x, y: pts.block.y, id: 3 }],
  });
  await page.waitForFunction(() => (window as never as { __ccBattle: Hook }).__ccBattle.kairoState === 'BLOCK', undefined, {
    timeout: 5_000,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pts.block.x, y: pts.block.y, id: 3 }] });
  await page.waitForFunction(() => (window as never as { __ccBattle: Hook }).__ccBattle.kairoState !== 'BLOCK', undefined, {
    timeout: 5_000,
  });

  // ---- cancellation: an interrupted pointer must not leave movement held ----
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 7 }],
  });
  await page.waitForTimeout(180);
  await page.evaluate(() => {
    const canvas = document.querySelector('#game-container canvas');
    canvas?.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, bubbles: true }));
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  const cancelA = (await hookOf(page)).kairoX;
  await page.waitForTimeout(450);
  const cancelB = (await hookOf(page)).kairoX;
  expect(Math.abs(cancelB - cancelA), 'pointercancel releases held movement').toBeLessThan(25);

  // ---- rotation: no stuck movement afterwards ----
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: pts.moveRight.x, y: pts.moveRight.y, id: 4 }],
  });
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: height, height: width }); // portrait: gate appears, inputs must clear
  await page.waitForTimeout(500);
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(700);
  const posA = (await hookOf(page)).kairoX;
  await page.waitForTimeout(600);
  const posB = (await hookOf(page)).kairoX;
  expect(Math.abs(posB - posA), 'no stuck movement after rotation').toBeLessThan(30);

  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
  await context.close();
});
