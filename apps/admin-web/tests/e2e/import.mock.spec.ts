import { expect, test } from '@playwright/test';

import { createImportFixture, loginMockBoss } from './import-fixtures';

test('mock import page persists imported products and queryable jobs', async ({ page }, testInfo) => {
  const productName = `Mock Import Product ${Date.now()}`;
  const fixture = await createImportFixture(testInfo, {
    productName,
    skuPrefix: `MOCK-${Date.now()}`,
    categoryId: 'apparel',
    withZip: true
  });

  await loginMockBoss(page);
  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('product-import-excel').setInputFiles(fixture.excelPath);
  await page.getByTestId('product-import-zip').setInputFiles(fixture.zipPath!);
  await page.getByTestId('product-import-submit').click();

  await expect(page.getByTestId('import-status-message')).toContainText('Mock 导入完成');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('SUCCEEDED');

  const jobId = ((await page.getByTestId('latest-import-job-id').textContent()) || '').trim();
  expect(jobId).toContain('mock-product-');

  await page.getByTestId('import-job-query').fill(jobId);
  await page.getByTestId('import-job-query-submit').click();
  await expect(page.getByTestId('import-status-message')).toContainText('已加载本地 mock 任务');
  const persisted = await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]');
    const jobs = JSON.parse(localStorage.getItem('admin-web-mock-import-jobs') || '[]');
    return { products, jobs };
  });
  expect(persisted.products.some((item: { name?: string }) => item?.name === productName)).toBeTruthy();
  expect(persisted.jobs.some((item: { id?: string }) => item?.id === jobId)).toBeTruthy();
});
