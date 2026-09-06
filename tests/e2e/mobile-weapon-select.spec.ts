/**
 * Regression cover for the mobile "BEGIN THE RUN does nothing" blocker.
 *
 * Root cause: Phaser's object-level POINTER_UP only fires when the pointer is
 * released while still over the object. A mouse click never travels, but a
 * finger drifts while lifting, so releases outside the 46px-tall button were
 * dropped and the run could not start. onTap() now commits on release for
 * touch pointers (see src/game/ui/tapTarget.ts).
 *
 * Also asserts the compact landscape layout: the title, all three weapon
 * cards and the button stay inside the viewport, never overlap, and the
 * button is at least a 44px touch target.
 */
import { test, expect, type Page, type CDPSession } from '@playwright/test';

const VIEWPORTS = [
  { width: 844, height: 390 }, // iPhone 12/13/14 landscape
  { width: 915, height: 412 }, // Pixel 5/6 landscape
  { width: 740, height: 360 }, // small Android landscape
  { width: 812, height: 375 }, // iPhone X/11 Pro landscape
  { width: 932, height: 430 }, // iPhone 15 Pro Max landscape
];

/** Both common device pixel ratios: the stage buffer is CSS x min(dpr, 2). */
const DPRS = [2, 3];

const SIZES = VIEWPORTS.flatMap((v) => DPRS.map((dpr) => ({ ...v, dpr })));

interface Geometry {
  allInside: boolean;
  cardVsBtn: boolean;
  cardVsTitle: boolean;
  cardCount: number;
  btnH: number;
  btnX: number;
  btnY: number;
}

interface MenuGeometry {
  allInside: boolean;
  controlsOverlapLogo: boolean;
  controlsOverlapPrompt: boolean;
  title: string;
  controls: string;
  controlsInteractive: boolean;
  tutorialSceneRegistered: boolean;
  tutorialTextureLoaded: boolean;
}

const menuGeometry = (page: Page): Promise<MenuGeometry> =>
  page.evaluate(() => {
    const game = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = game.scene.getScene('MenuScene');
    const title = scene.children.getByName('controlsTitle') as Phaser.GameObjects.Text;
    const controls = scene.children.getByName('controls') as Phaser.GameObjects.Text;
    const logo = scene.children.list.find((object) => object.type === 'Image' && object !== scene.children.list[0]) as Phaser.GameObjects.Image;
    const prompt = scene.children.list.find(
      (object) => object.type === 'Text' && (object as Phaser.GameObjects.Text).text === 'TAP TO FIGHT',
    ) as Phaser.GameObjects.Text;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const inside = (box: Phaser.Geom.Rectangle): boolean =>
      box.x >= -0.5 && box.y >= -0.5 && box.right <= vw + 0.5 && box.bottom <= vh + 0.5;
    const controlsBox = Phaser.Geom.Rectangle.Union(title.getBounds(), controls.getBounds());
    return {
      allInside: inside(title.getBounds()) && inside(controls.getBounds()),
      controlsOverlapLogo: Phaser.Geom.Intersects.RectangleToRectangle(controlsBox, logo.getBounds()),
      controlsOverlapPrompt: Phaser.Geom.Intersects.RectangleToRectangle(controlsBox, prompt.getBounds()),
      title: title.text,
      controls: controls.text,
      controlsInteractive: controls.input !== null || title.input !== null,
      tutorialSceneRegistered: game.scene.keys.TutorialScene !== undefined,
      tutorialTextureLoaded: game.textures.exists('ui.tutorial_page'),
    };
  });

const geometry = (page: Page): Promise<Geometry> =>
  page.evaluate(() => {
    type Box = { x: number; y: number; w: number; h: number };
    const g = (window as never as { __chromaClash: { game: Phaser.Game } }).__chromaClash.game;
    const scene = g.scene.getScene('WeaponSelectScene');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = (o: Phaser.GameObjects.Components.GetBounds): Box => {
      const b = o.getBounds();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const inside = (b: Box): boolean => b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= vw + 0.5 && b.y + b.h <= vh + 0.5;
    const overlaps = (a: Box, b: Box): boolean =>
      !(a.y + a.h <= b.y || a.y >= b.y + b.h || a.x + a.w <= b.x || a.x >= b.x + b.w);
    const title = box(scene.children.getByName('title') as never);
    const btn = box(scene.children.getByName('confirm') as never);
    const cards = scene.children.list.filter((o) => o.type === 'Container').map((o) => box(o as never));
    return {
      allInside: inside(title) && inside(btn) && cards.every(inside),
      cardVsBtn: cards.some((c) => overlaps(c, btn)),
      cardVsTitle: cards.some((c) => overlaps(c, title)),
      cardCount: cards.length,
      btnH: btn.h,
      btnX: btn.x + btn.w / 2,
      btnY: btn.y + btn.h / 2,
    };
  });

/** A tap that drifts while lifting, the way a real thumb does. */
async function driftTap(cdp: CDPSession, page: Page, x: number, y: number, dy: number): Promise<void> {
  const points = (py: number) => [{ x, y: py, id: 1, radiusX: 14, radiusY: 14, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(y) });
  for (let i = 1; i <= 4; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(y + (dy * i) / 4) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
}

for (const { width, height, dpr } of SIZES) {
  test(`mobile weapon select ${width}x${height} @${dpr}: fits the viewport and BEGIN THE RUN starts the run`, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForFunction('window.__ccMenu === true', undefined, { timeout: 30_000 });

    // the document must not scroll or zoom under a finger
    expect(await page.evaluate('document.documentElement.scrollHeight - document.documentElement.clientHeight')).toBe(0);
    expect(await page.evaluate('getComputedStyle(document.body).touchAction')).toBe('none');

    const menu = await menuGeometry(page);
    expect(menu.title).toBe('HOW TO PLAY  /  CONTROLS');
    expect(menu.controls).toContain('LEFT SIDE  Move left / right');
    expect(menu.controls).toContain('RIGHT SIDE  Light · Heavy · Jump · Dash · Block · Special');
    expect(menu.allInside, 'home-screen controls must fit the landscape viewport').toBe(true);
    expect(menu.controlsOverlapLogo, 'home-screen controls must not cover the logo').toBe(false);
    expect(menu.controlsOverlapPrompt, 'home-screen controls must not cover the start prompt').toBe(false);
    expect(menu.controlsInteractive, 'controls copy must not capture taps').toBe(false);
    expect(menu.tutorialSceneRegistered).toBe(false);
    expect(menu.tutorialTextureLoaded).toBe(false);

    const cdp = await context.newCDPSession(page);
    await page.touchscreen.tap(width / 2, height * 0.45);
    await page.waitForFunction('window.__ccWeaponSelect === true', undefined, { timeout: 20_000 });
    await page.waitForTimeout(350);

    const g = await geometry(page);
    expect(g.cardCount).toBe(3);
    expect(g.allInside, 'title, cards and button must all be on screen').toBe(true);
    expect(g.cardVsBtn, 'cards must not overlap BEGIN THE RUN').toBe(false);
    expect(g.cardVsTitle, 'cards must not overlap the title').toBe(false);
    expect(g.btnH, 'button must be a 44px+ touch target').toBeGreaterThanOrEqual(44);

    // a finger that drifts well outside the button must still start the run
    await driftTap(cdp, page, g.btnX, g.btnY, -Math.round(g.btnH * 1.5));
    expect(await page.evaluate('window.__ccWeaponSelect !== true'), 'the run must start').toBe(true);

    // the rotate screen must offer a fullscreen CTA (browsers gate the API
    // behind a user gesture, so there has to be something to press)
    expect(await page.evaluate('!!document.getElementById("gate-fullscreen")')).toBe(true);
    expect(await page.evaluate('document.getElementById("gate-fullscreen").hidden')).toBe(false);
    expect(
      await page.evaluate('getComputedStyle(document.getElementById("orientation-gate")).pointerEvents'),
      'a hidden overlay must not swallow taps',
    ).toBe('none');

    await context.close();
  });
}

test('mobile fullscreen rejection never blocks weapon selection or starts twice', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value(): Promise<void> {
        const state = window as Window & { __fsAttempts?: number };
        state.__fsAttempts = (state.__fsAttempts ?? 0) + 1;
        return Promise.reject(new DOMException('Fullscreen denied', 'NotAllowedError'));
      },
    });
  });

  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction('window.__ccMenu === true', undefined, { timeout: 30_000 });

  // Chromium emits both Pointer Events and compatibility touch events for one
  // tap. The fullscreen controller must issue only one request and the failed
  // promise must not interfere with Menu -> Weapon Select -> Battle.
  await page.touchscreen.tap(422, 176);
  await page.waitForFunction('window.__ccWeaponSelect === true', undefined, { timeout: 20_000 });
  expect(await page.evaluate('(window.__fsAttempts ?? 0)')).toBe(1);

  const g = await geometry(page);
  await page.touchscreen.tap(g.btnX, g.btnY);
  await page.waitForFunction('window.__ccWeaponSelect !== true', undefined, { timeout: 20_000 });
  expect(await page.evaluate('(window.__fsAttempts ?? 0)')).toBeGreaterThanOrEqual(1);

  await context.close();
});
