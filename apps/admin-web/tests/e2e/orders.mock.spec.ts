import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('mock orders page displays monetary values with RMB symbols', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/orders.html');

  await expect(page.locator('[data-role="orders-body"]')).toBeVisible();
  await expect(page.locator('[data-role="orders-body"]')).toContainText('¥');
  await expect(page.locator('[data-role="customer-ltv"]')).toContainText('¥');
  await expect(page.locator('body')).not.toContainText('$');
});
