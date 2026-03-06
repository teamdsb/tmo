import { expect, test } from '@playwright/test';

import { createImportFixture, seedDevAuthState } from './import-fixtures';

test('real mode import page creates product import job and polls status', async ({ page }, testInfo) => {
  const productName = `Real Import Product ${Date.now()}`;
  const fixture = await createImportFixture(testInfo, {
    productName,
    skuPrefix: `REAL-${Date.now()}`,
    categoryId: '11111111-1111-1111-1111-111111111111',
    withZip: true
  });

  await seedDevAuthState(page);

  let createRequestBody = '';
  let pollCount = 0;

  await page.route('**/api/bff/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        me: {
          id: 'boss-user',
          displayName: 'Boss User',
          userType: 'admin',
          roles: ['BOSS']
        },
        permissions: {
          items: [
            { code: 'import:product', scope: 'SELF' }
          ]
        },
        featureFlags: {
          paymentEnabled: false,
          wechatPayEnabled: false,
          alipayPayEnabled: false
        }
      })
    });
  });

  await page.route('**/api/admin/products/import-jobs', async (route) => {
    const body = route.request().postDataBuffer();
    createRequestBody = body ? body.toString('latin1') : '';
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        type: 'PRODUCT_IMPORT',
        status: 'PENDING',
        progress: 0,
        createdAt: '2026-03-06T00:00:00Z'
      })
    });
  });

  await page.route('**/api/admin/import-jobs/*', async (route) => {
    pollCount += 1;
    const completed = pollCount > 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '11111111-1111-1111-1111-111111111111',
        type: 'PRODUCT_IMPORT',
        status: completed ? 'SUCCEEDED' : 'RUNNING',
        progress: completed ? 100 : 45,
        createdAt: '2026-03-06T00:00:00Z',
        resultFileUrl: completed ? 'http://localhost:8080/assets/media/import-jobs/11111111-1111-1111-1111-111111111111/reports/summary.json' : null,
        errorReportUrl: null
      })
    });
  });

  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('product-import-excel').setInputFiles(fixture.excelPath);
  await page.getByTestId('product-import-zip').setInputFiles(fixture.zipPath!);
  await page.getByTestId('product-import-image-base-url').fill('https://cdn.example.com/catalog');
  await page.getByTestId('product-import-submit').click();

  await expect(page.getByTestId('import-status-message')).toContainText('商品导入任务已创建');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('SUCCEEDED');
  await expect(page.getByRole('link', { name: '下载结果摘要' })).toBeVisible();
  await expect.poll(() => pollCount).toBeGreaterThan(1);

  expect(createRequestBody).toContain('name="excelFile"');
  expect(createRequestBody).toContain('name="imagesZip"');
  expect(createRequestBody).toContain('name="imageBaseUrl"');
  expect(createRequestBody).toContain('https://cdn.example.com/catalog');
});

test('real mode import page creates product-request export job and polls status', async ({ page }) => {
  await seedDevAuthState(page);

  let pollCount = 0;

  await page.route('**/api/bff/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        me: {
          id: 'boss-user',
          displayName: 'Boss User',
          userType: 'admin',
          roles: ['BOSS']
        },
        permissions: {
          items: [
            { code: 'product_request:export', scope: 'SELF' }
          ]
        },
        featureFlags: {
          paymentEnabled: false,
          wechatPayEnabled: false,
          alipayPayEnabled: false
        }
      })
    });
  });

  await page.route('**/api/admin/product-requests/export-jobs', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        type: 'PRODUCT_REQUEST_EXPORT',
        status: 'PENDING',
        progress: 0,
        createdAt: '2026-03-06T00:00:00Z'
      })
    });
  });

  await page.route('**/api/admin/import-jobs/*', async (route) => {
    pollCount += 1;
    const completed = pollCount > 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '22222222-2222-2222-2222-222222222222',
        type: 'PRODUCT_REQUEST_EXPORT',
        status: completed ? 'SUCCEEDED' : 'RUNNING',
        progress: completed ? 100 : 60,
        createdAt: '2026-03-06T00:00:00Z',
        resultFileUrl: completed ? 'http://localhost:8080/assets/media/import-jobs/22222222-2222-2222-2222-222222222222/exports/product-requests.xlsx' : null,
        errorReportUrl: null
      })
    });
  });

  await page.goto('/import.html');

  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('request-export-submit').click();

  await expect(page.getByTestId('import-status-message')).toContainText('需求导出任务已创建');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('PENDING');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('RUNNING');
  await expect(page.getByTestId('latest-import-job-status')).toContainText('SUCCEEDED');
  await expect(page.getByRole('link', { name: '下载导出文件' })).toBeVisible();
  await expect.poll(() => pollCount).toBeGreaterThan(1);
});
