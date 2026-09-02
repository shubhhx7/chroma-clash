/** Dev helper (not a test): captures screenshots for visual review. */
import { chromium } from 'playwright';

async function main(): Promise<void> {
  const browser = await chromium.launch();
  for (const [name, w, h, touch] of [
    ['desktop', 1280, 720, false],
    ['phone', 844, 390, true],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForFunction(() => (window as never as { __ccMenu?: boolean }).__ccMenu === true, undefined, { timeout: 30000 });
    await page.mouse.click(w / 2, h / 2);
    await page.waitForFunction(() => (window as never as { __ccBattle?: { phase: string } }).__ccBattle?.phase === 'fighting', undefined, { timeout: 30000 });
    await page.waitForTimeout(600);
    // move right + attack for an action shot
    await page.keyboard.down('D');
    await page.waitForTimeout(500);
    await page.keyboard.up('D');
    await page.keyboard.press('J');
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${process.env.TEMP}/cc_shot_${name}.png` });
    await ctx.close();
  }
  await browser.close();
}
main();
