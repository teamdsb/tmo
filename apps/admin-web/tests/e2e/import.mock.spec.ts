import { expect, test } from '@playwright/test';

import { createImportFixture, loginMockBoss } from './import-fixtures';

test('mock import page persists imported products and queryable jobs', async ({ page }, testInfo) => {
  const productName = `Mock Import Product ${Date.now()}`;
  const skuPrefix = `型号-长460*宽240+(a)-${Date.now()}`;
  const fixture = await createImportFixture(testInfo, {
    productName,
    skuPrefix,
    categoryId: 'apparel',
    withZip: true
  });

  await loginMockBoss(page);
  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await expect(page.getByTestId('product-import-template-guide')).toContainText('必填表头');
  await expect(page.getByTestId('product-import-template-guide')).toContainText('Group Key');
  await expect(page.getByTestId('product-import-template-guide')).toContainText('Price Tiers (Fen)');
  await page.getByTestId('product-import-excel').setInputFiles(fixture.excelPath);
  await page.getByTestId('product-import-zip').setInputFiles(fixture.zipPath!);
  await page.getByTestId('product-import-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待确认');
  await page.getByTestId('product-import-confirm').click();

  await expect(page.getByTestId('import-status-message')).toContainText('已确认导入');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');

  const jobId = ((await page.getByTestId('latest-import-job-id').textContent()) || '').trim();
  expect(jobId).toContain('mock-product-');

  await page.getByText('其他批量任务与设置', { exact: true }).click();
  await page.getByTestId('import-job-query').fill(jobId);
  await page.getByTestId('import-job-query-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');
  const persisted = await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]');
    const jobs = JSON.parse(localStorage.getItem('admin-web-mock-import-jobs') || '[]');
    return { products, jobs };
  });
  expect(persisted.products.some((item: { name?: string }) => item?.name === productName)).toBeTruthy();
  expect(persisted.products.some((item: { models?: Array<{ code?: string }> }) => (
    Array.isArray(item?.models) && item.models.some((model) => model?.code === `${skuPrefix}-A`)
  ))).toBeTruthy();
  expect(persisted.jobs.some((item: { id?: string }) => item?.id === jobId)).toBeTruthy();
});

test('mock import page advances product-request export jobs to downloadable success', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByText('其他批量任务与设置', { exact: true }).click();
  await page.getByTestId('request-export-submit').click();

  await expect(page.getByTestId('latest-import-job-status')).toContainText('等待处理');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('处理中');
  await expect(page.getByTestId('import-status-message')).toContainText('需求导出任务已创建');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');
  await expect(page.getByRole('link', { name: '下载导出文件' })).toBeVisible();

  const jobId = ((await page.getByTestId('latest-import-job-id').textContent()) || '').trim();
  await page.getByTestId('import-job-query').fill(jobId);
  await page.getByTestId('import-job-query-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');

  const persisted = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('admin-web-mock-import-jobs') || '[]');
  });
  expect(persisted.some((item: { type?: string; status?: string; resultFileUrl?: string }) => (
    item?.type === 'PRODUCT_REQUEST_EXPORT' &&
    item?.status === 'SUCCEEDED' &&
    typeof item?.resultFileUrl === 'string' &&
    item.resultFileUrl.startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  ))).toBeTruthy();
});
