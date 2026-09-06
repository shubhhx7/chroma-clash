import { test, expect, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 915, height: 412 },
  { width: 740, height: 360 },
  { width: 812, height: 375 },
  { width: 932, height: 430 },
] as const;

const ACTIONS = ['MOVE_LEFT', 'MOVE_RIGHT', 'ATTACK', 'HEAVY', 'JUMP', 'DASH', 'BLOCK', 'SPECIAL'] as const;

interface ControlGeometry {
  action: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const readGeometry = (page: Page): Promise<{ controls: ControlGeometry[]; dashLabelVisible: boolean }> =>
  page.evaluate((actions) => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('BattleScene') as Phaser.Scene & {
      touchControls: {
        buttons: Array<{ action: string; image: Phaser.GameObjects.Image }>;
        dashLabel: Phaser.GameObjects.Text;
      };
    };
    const controls = actions.map((action) => {
      const image = scene.touchControls.buttons.find((button) => button.action === action)?.image;
      if (!image) throw new Error(`Missing touch control: ${action}`);
      const bounds = image.getBounds();
      return { action, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    });
    const dashLabel = scene.touchControls.dashLabel;
    return { controls, dashLabelVisible: dashLabel.visible && dashLabel.text === 'DASH' };
  }, ACTIONS);

for (const { width, height } of VIEWPORTS) {
  test(`mobile controls ${width}x${height}: all actions fit without overlap`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/?scene=battle');
    await page.waitForFunction('window.__ccBattle && window.__ccBattle.touchControlsVisible === true', undefined, {
      timeout: 30_000,
    });

    const { controls, dashLabelVisible } = await readGeometry(page);
    expect(controls.map(({ action }) => action)).toEqual(ACTIONS);
    expect(dashLabelVisible, 'the dedicated Dash button is labelled and visible').toBe(true);

    for (const control of controls) {
      expect(control.width, `${control.action} remains a large touch target`).toBeGreaterThanOrEqual(63);
      expect(control.x, `${control.action} left edge`).toBeGreaterThanOrEqual(0);
      expect(control.y, `${control.action} top edge`).toBeGreaterThanOrEqual(0);
      expect(control.x + control.width, `${control.action} right edge`).toBeLessThanOrEqual(width);
      expect(control.y + control.height, `${control.action} bottom edge`).toBeLessThanOrEqual(height);
    }

    for (let a = 0; a < controls.length; a++) {
      for (let b = a + 1; b < controls.length; b++) {
        const first = controls[a];
        const second = controls[b];
        if (!first || !second) continue;
        const overlaps = !(
          first.x + first.width <= second.x ||
          second.x + second.width <= first.x ||
          first.y + first.height <= second.y ||
          second.y + second.height <= first.y
        );
        expect(overlaps, `${first.action} overlaps ${second.action}`).toBe(false);
      }
    }

    expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
    await context.close();
  });
}
