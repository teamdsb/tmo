import { expect, test } from '@playwright/test';

import { createImportFixture, loginAsBoss } from './import-fixtures';

const isGet = (urlString: string, path: string) => {
  const url = new URL(urlString);
  return url.pathname === path;
};

test('hybrid import page creates product import job and polls status', async ({ page }, testInfo) => {
  const productName = `Real Import Product ${Date.now()}`;
  const fixture = await createImportFixture(testInfo, {
    productName,
    skuPrefix: `REAL-${Date.now()}`,
    categoryId: '11111111-1111-1111-1111-111111111111',
    withZip: true
  });

  await loginAsBoss(page);

  const createRequestPromise = page.waitForRequest((request) => {
    return request.method() === 'POST' && isGet(request.url(), '/api/admin/products/import-jobs');
  });
  const createResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && isGet(response.url(), '/api/admin/products/import-jobs');
  });
  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('product-import-excel').setInputFiles(fixture.excelPath);
  await page.getByTestId('product-import-zip').setInputFiles(fixture.zipPath!);
  await page.getByTestId('product-import-image-base-url').fill('https://cdn.example.com/catalog');
  await page.getByTestId('product-import-submit').click();

  const createRequest = await createRequestPromise;
  const createResponse = await createResponsePromise;

  expect(createResponse.status()).toBe(202);
  expect(createRequest.method()).toBe('POST');
  await expect(page.getByTestId('import-status-message')).toContainText('商品导入任务已创建');
  await expect(page.getByTestId('latest-import-job-id')).toContainText(/[0-9a-f-]{36}/i);
  await expect(page.getByTestId('latest-import-job-status')).toContainText(/PENDING|RUNNING|SUCCEEDED|FAILED/);

  const createdJobId = ((await page.getByTestId('latest-import-job-id').textContent()) || '').trim();
  const queryResponsePromise = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return url.pathname === `/api/admin/import-jobs/${createdJobId}`;
  });
  await page.getByTestId('import-job-query').fill(createdJobId);
  await page.getByTestId('import-job-query-submit').click();
  const queryResponse = await queryResponsePromise;

  expect(queryResponse.status()).toBe(200);
  await expect(page.getByTestId('import-status-message')).toContainText('已刷新导入任务状态');
});

test('real mode import page creates product-request export job and polls status', async ({ page }) => {
  await loginAsBoss(page);

  const createRequestPromise = page.waitForRequest((request) => {
    return request.method() === 'POST' && isGet(request.url(), '/api/admin/product-requests/export-jobs');
  });
  const createResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && isGet(response.url(), '/api/admin/product-requests/export-jobs');
  });
  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('request-export-submit').click();

  const createRequest = await createRequestPromise;
  const createResponse = await createResponsePromise;
  const createRequestBody = createRequest.postData() || '';

  expect(createResponse.status()).toBe(202);
  await expect(page.getByTestId('import-status-message')).toContainText('需求导出任务已创建');
  await expect(page.getByTestId('latest-import-job-id')).toContainText(/[0-9a-f-]{36}/i);
  await expect(page.getByTestId('latest-import-job-status')).toContainText(/PENDING|RUNNING|SUCCEEDED|FAILED/);

  const createdJobId = ((await page.getByTestId('latest-import-job-id').textContent()) || '').trim();
  const queryResponsePromise = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return url.pathname === `/api/admin/import-jobs/${createdJobId}`;
  });
  await page.getByTestId('import-job-query').fill(createdJobId);
  await page.getByTestId('import-job-query-submit').click();
  const queryResponse = await queryResponsePromise;

  expect(queryResponse.status()).toBe(200);
  await expect(page.getByTestId('import-status-message')).toContainText('已刷新导入任务状态');
  expect(createRequestBody).toBe('{}');
});
