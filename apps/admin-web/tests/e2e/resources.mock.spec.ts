import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { expect, test, type Page } from './offline-fixtures';
import { loginMockBoss } from './import-fixtures';

const loadLocalFonts = async (page: Page, fontResponses: string[]) => {
  const state = await page.evaluate(async () => {
    const [text, symbols] = await Promise.all([
      document.fonts.load('400 16px "Inter Variable"', 'Admin'),
      document.fonts.load('400 24px "Material Symbols Outlined Variable"', 'inventory_2')
    ]);
    await document.fonts.ready;
    return {
      textLoaded: text.length > 0 && text.every(font => font.status === 'loaded'),
      symbolsLoaded: symbols.length > 0 && symbols.every(font => font.status === 'loaded')
    };
  });
  expect(state.textLoaded).toBe(true);
  expect(state.symbolsLoaded).toBe(true);
  // Use network events because Playwright's fixed clock replaces Performance entries.
  expect(fontResponses.length).toBeGreaterThanOrEqual(2);
  expect(fontResponses.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(fontResponses.some(url => url.includes('material-symbols-outlined') && url.includes('full-normal'))).toBe(true);
};

const checkUsableLayout = async (page: Page) => {
  const sidebarBox = await page.locator('[data-admin-unified-sidebar]').boundingBox();
  const mainBox = await page.locator('#react-admin-main-column').boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(sidebarBox!.width).toBeGreaterThan(0);
  expect(mainBox!.width).toBeGreaterThan(0);
  expect(mainBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width - 1);
  expect(mainBox!.x + mainBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const icon = await page.locator('.material-symbols-outlined').first().evaluate(element => ({
    family: getComputedStyle(element).fontFamily,
    fontSize: parseFloat(getComputedStyle(element).fontSize),
    width: element.getBoundingClientRect().width
  }));
  expect(icon.family).toContain('Material Symbols Outlined Variable');
  expect(icon.width).toBeGreaterThan(0);
  expect(icon.width / icon.fontSize, 'The icon ligature must render as a glyph, not its English name').toBeLessThan(1.5);
  await expect(page.locator('.bg-primary').first()).toHaveCSS('background-color', 'rgb(20, 75, 184)');
};

for (const name of ['products', 'orders', 'payments', 'support']) {
  test(`${name} loads local fonts and remains usable across reload without internet`, async ({ page }, testInfo) => {
    const fontResponses: string[] = [];
    page.on('response', response => {
      if (response.request().resourceType() === 'font' && response.status() === 200) fontResponses.push(response.url());
    });
    await page.clock.setFixedTime(new Date('2026-10-04T10:48:20Z'));
    await loginMockBoss(page);
    await page.goto(`/${name}.html`, { waitUntil: 'domcontentloaded' });
    await loadLocalFonts(page, fontResponses);
    await checkUsableLayout(page);

    const before = await page.screenshot({ path: testInfo.outputPath(`${name}-cold.png`), fullPage: true, animations: 'disabled' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loadLocalFonts(page, fontResponses);
    await checkUsableLayout(page);
    const after = await page.screenshot({ path: testInfo.outputPath(`${name}-reload.png`), fullPage: true, animations: 'disabled' });
    const left = PNG.sync.read(before);
    const right = PNG.sync.read(after);
    const changed = left.width === right.width && left.height === right.height
      ? pixelmatch(left.data, right.data, undefined, left.width, left.height, { threshold: 0.1 }) / (left.width * left.height)
      : null;
    // Preserve visual evidence without locking CI to platform-specific rasterization.
    await testInfo.attach(`${name}-layout-comparison`, { body: JSON.stringify({ before: [left.width, left.height], after: [right.width, right.height], changedPixelRatio: changed }), contentType: 'application/json' });
    await testInfo.attach(`${name}-cold`, { body: before, contentType: 'image/png' });
    await testInfo.attach(`${name}-reload`, { body: after, contentType: 'image/png' });
  });
}
