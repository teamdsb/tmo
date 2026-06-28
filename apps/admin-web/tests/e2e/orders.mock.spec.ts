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

test('order detail selects line item products from the existing catalog', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/orders.html');

  await page.locator('[data-role="view-order"]').first().click();
  await expect(page.getByText('订单详情（可编辑）')).toBeVisible();
  await expect(page.locator('[data-role="detail-item-name"]')).toHaveCount(0);

  await page.locator('[data-role="detail-add-item"]').click();
  const newItem = page.locator('[data-role="detail-line-item-row"]').last();
  const productSearch = newItem.locator('[data-role="detail-item-product-search"]');
  await productSearch.fill('跑步');
  const option = newItem.locator('[data-role="detail-product-option"]').filter({ hasText: '跑步水壶' }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(productSearch).toHaveValue('跑步水壶');

  await productSearch.fill('不存在的自定义商品');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.locator('[data-role="detail-form-error"]')).toContainText('请选择现有商品');
});
