import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';

import { loginAsBoss } from './import-fixtures';
import { requestAsSignedInUser } from './real-fixtures';

async function enterWorkbench(page: Page) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  await loginAsBoss(page);
  await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('import-page')).toBeVisible();
}

test('real catalog preview, confirmation, history and export round trip', async ({ page }) => {
  await enterWorkbench(page);
  const suffix = Date.now().toString();
  const name = '三级实测-' + suffix;
  const categoryResponse = await requestAsSignedInUser(page, '/api/catalog/categories', { method: 'POST', data: { name: '浏览器测试-' + suffix } });
  expect(categoryResponse.status()).toBe(201);
  const category = await categoryResponse.json();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['商品分组', '商品名称', 'SKU编码', 'SKU名称', '分类ID', '一级规格名称', '一级规格值', '二级规格名称', '二级规格值', '三级规格名称', '三级规格值', '单位', '阶梯价格（分）'],
    [suffix, name, suffix + '-A', '钢20-M6', category.id, '材质', '钢', '长度', '20mm', '直径', 'M6', '个', '1-9:1200|10-:1000'],
    [suffix, name, suffix + '-B', '钢30-M8', category.id, '材质', '钢', '长度', '30mm', '直径', 'M8', '个', '1-:1800']
  ]), '商品维护');
  await page.getByTestId('product-import-excel').setInputFiles({
    name: name + '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  });
  await page.getByTestId('product-import-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待确认', { timeout: 30000 });
  const previewJob = (await page.getByTestId('latest-import-job-id').textContent())!.trim();
  let products = await (await requestAsSignedInUser(page, '/api/admin/products', { params: { q: name } })).json();
  expect(products.total).toBe(0);
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成', { timeout: 30000 });
  products = await (await requestAsSignedInUser(page, '/api/admin/products', { params: { q: name } })).json();
  expect(products.total).toBe(1);
  const productId = products.items[0].id;
  const detail = await (await requestAsSignedInUser(page, '/api/catalog/products/' + productId)).json();
  expect(detail.product.filterDimensions).toEqual(['材质', '长度', '直径']);
  expect(detail.skus).toHaveLength(2);
  expect(detail.skus.map((item: any) => item.spec).sort()).toEqual(['钢 / 20mm / M6', '钢 / 30mm / M8']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^任务历史/ }).click();
  await expect(page.getByText(name + '.xlsx', { exact: true })).toBeVisible();
  await page.goto('/import.html?jobId=' + previewJob, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');
  await page.getByRole('button', { name: '商品导出', exact: true }).click();
  await page.getByLabel('导出搜索').fill(name);
  await page.getByRole('button', { name: '创建导出任务', exact: true }).click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成', { timeout: 30000 });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载导出文件' }).click();
  const download = await downloadEvent;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exportBody = await readFile(downloadPath!);
  expect(exportBody.subarray(0, 2).toString()).toBe('PK');
  const parsed = XLSX.read(exportBody, { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]])).toHaveLength(2);
  await page.getByRole('button', { name: '商品导入', exact: true }).click();
  await page.getByTestId('product-import-excel').setInputFiles({ name: 'roundtrip.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: exportBody });
  await page.getByTestId('product-import-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待确认', { timeout: 30000 });
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成', { timeout: 30000 });
  const after = await (await requestAsSignedInUser(page, '/api/catalog/products/' + productId)).json();
  expect(after.skus.map((item: any) => item.id).sort()).toEqual(detail.skus.map((item: any) => item.id).sort());
  expect(after.skus.map((item: any) => item.priceTiers)).toEqual(detail.skus.map((item: any) => item.priceTiers));
});

test('real legacy recognition creates independent drafts and persistent review', async ({ page }) => {
  await enterWorkbench(page);
  const suffix = Date.now().toString();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['序号', '物资', '规格型号', '单位', '分类'],
    [1, '纸箱', '620*600*' + suffix.slice(-3), '只', '测试未知-' + suffix],
    [2, '辅料', 'PP粉1000目-' + suffix, 'kg', '测试未知-' + suffix]
  ]), '采购清单');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  await page.getByTestId('product-import-excel').setInputFiles({ name: 'legacy-' + suffix + '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await page.getByTestId('product-import-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待确认', { timeout: 30000 });
  const jobId = (await page.getByTestId('latest-import-job-id').textContent())!.trim();
  const preview = await (await requestAsSignedInUser(page, '/api/admin/products/import-jobs/' + jobId + '/preview')).json();
  expect(preview.summary.splitProducts).toBe(2);
  expect(preview.summary.failedRows).toBe(0);
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待复核', { timeout: 30000 });
  const reviews = await (await requestAsSignedInUser(page, '/api/admin/products/import-reviews?pageSize=100')).json();
  const own = reviews.items.filter((item: any) => item.jobId === jobId);
  expect(new Set(own.map((item: any) => item.productId)).size).toBe(2);
  for (const id of new Set<string>(own.map((item: any) => item.productId))) {
    const detail = await (await requestAsSignedInUser(page, '/api/catalog/products/' + id)).json();
    expect(detail.product.status).toBe('DRAFT');
    expect(detail.skus).toHaveLength(1);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^任务历史/ }).click();
  await expect(page.getByRole('heading', { name: '商品复核' })).toBeVisible();
  await expect(page.getByText('采购清单 · 第 2 行').first()).toBeVisible();
});
