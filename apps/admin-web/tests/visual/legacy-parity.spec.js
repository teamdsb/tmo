import { expect, test } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const pages = [
  'index',
  'dashboard',
  'products',
  'orders',
  'import',
  'inquiries',
  'suppliers',
  'quote-workflow',
  'payments',
  'exports',
  'rbac',
  'settings',
  'transfer'
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const toPng = (buffer) => PNG.sync.read(buffer);

const diffRatio = (beforeBuffer, afterBuffer) => {
  const before = toPng(beforeBuffer);
  const after = toPng(afterBuffer);

  if (before.width !== after.width || before.height !== after.height) {
    return {
      ratio: 1,
      mismatchCount: Math.max(before.width * before.height, after.width * after.height),
      totalPixels: Math.max(before.width * before.height, after.width * after.height)
    };
  }

  const totalPixels = before.width * before.height;
  const diff = new PNG({ width: before.width, height: before.height });
  const mismatchCount = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
    threshold: 0.12
  });

  return {
    ratio: mismatchCount / totalPixels,
    mismatchCount,
    totalPixels
  };
};

for (const pageName of pages) {
  for (const viewport of viewports) {
    test(`${pageName} (${viewport.name}) should match legacy rendering`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await page.goto(`/legacy/pages/${pageName}.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const legacyShot = await page.screenshot({ fullPage: true });

      await page.goto(`/${pageName}.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      const migratedShot = await page.screenshot({ fullPage: true });

      const { ratio, mismatchCount, totalPixels } = diffRatio(legacyShot, migratedShot);

      expect(
        ratio,
        `Mismatch ratio too high for ${pageName} (${viewport.name}): ${(
          ratio * 100
        ).toFixed(2)}% (${mismatchCount}/${totalPixels})`
      ).toBeLessThanOrEqual(0.01);
    });
  }
}
