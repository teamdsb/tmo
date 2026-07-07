import { expect, test } from '@playwright/test';

import { loginAsCs, loginMockBoss } from './import-fixtures';

test('mock orders page displays monetary values with RMB symbols', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/orders.html');

  await expect(page.locator('[data-role="orders-body"]')).toBeVisible();
  await expect(page.locator('[data-role="orders-body"]')).toContainText('¥');
  await expect(page.locator('[data-role="customer-ltv"]')).toContainText('¥');
  await expect(page.locator('body')).not.toContainText('$');
});

test('boss confirms offline payment and sees an audit event', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/orders.html');
  await page.locator('[data-role="order-tab"][data-tab="submitted"]').click();
  await expect(page.locator('[data-role="order-fulfillment-panel"]')).toBeVisible();
  await page.locator('[data-role="submit-fulfillment"]').click();
  await expect(page.locator('[data-role="fulfillment-error"]')).toContainText('请选择业务员并填写备注');
  await page.locator('[data-role="fulfillment-sales"]').selectOption({ index: 1 });
  await page.locator('[data-role="fulfillment-note"]').fill('门店现金收款，已核验');
  await page.locator('[data-role="submit-fulfillment"]').click();
  await expect(page.locator('[data-role="order-admin-events"]')).toContainText('门店现金收款，已核验');
  await expect(page.locator('[data-role="order-fulfillment-panel"]')).toContainText('已支付');
});

test('CS can read orders but cannot see fulfillment controls', async ({ page }) => {
  await loginAsCs(page);
  await page.goto('/orders.html');
  await expect(page.locator('[data-role="orders-body"]')).toBeVisible();
  await expect(page.locator('[data-role="order-fulfillment-panel"]')).toHaveCount(0);
});

test('order detail drawer is read only', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/orders.html');
  await page.locator('[data-role="view-order"]').first().click();
  await expect(page.getByText('订单详情（只读）')).toBeVisible();
  await expect(page.locator('[data-role="detail-buyer-name"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: '保存修改' })).toHaveCount(0);
});
