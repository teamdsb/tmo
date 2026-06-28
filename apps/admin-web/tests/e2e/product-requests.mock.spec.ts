import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('product requests page lists, filters, pages, and opens complete details', async ({ page }) => {
  await loginMockBoss(page);
  await expect(page.getByRole('link', { name: '需求订单' })).toBeVisible();
  await page.getByRole('link', { name: '需求订单' }).click();

  await expect(page).toHaveURL(/product-requests\.html/);
  await expect(page.getByTestId('product-requests-page')).toBeVisible();
  await expect(page.locator('[data-request-id]')).toHaveCount(10);
  await expect(page.getByText('共 24 条')).toBeVisible();

  await page.getByTestId('request-next-page').click();
  await expect(page.getByText('2/3')).toBeVisible();
  await page.getByTestId('request-prev-page').click();

  await page.getByTestId('request-search').fill('耐高温密封圈');
  await expect(page.locator('[data-request-id]')).toHaveCount(6);
  await expect(page.locator('[data-request-id]').first()).toContainText('耐高温密封圈');

  await page.getByRole('button', { name: '清空筛选' }).click();
  await expect(page.locator('[data-request-id]')).toHaveCount(10);
  await page.locator('[data-testid^="view-product-request-"]').first().click();
  await expect(page.getByTestId('product-request-detail')).toContainText('非标不锈钢机箱');
  await expect(page.getByTestId('product-request-detail')).toContainText('304 不锈钢');
  await page.getByRole('button', { name: '需求参考图 1' }).click();
  await expect(page.getByAltText('需求参考图大图')).toBeVisible();
  await page.getByRole('button', { name: '关闭图片预览' }).click();

  await expect(page.getByRole('link', { name: '导出需求' })).toHaveAttribute('href', '/import.html#request-export');
});

test('product requests page shows an empty state for unmatched dates', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/product-requests.html');
  await page.getByTestId('request-created-after').fill('2027-01-01');
  await expect(page.getByText('当前筛选条件下暂无需求订单。')).toBeVisible();
});
