import { expect, test, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';

// Identity/bootstrap are fixtures; every catalog, job, preview, confirmation and export request is real.
async function enterWorkbench(page: Page) {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  // Catalog integration is independent of third-party font and CSS availability.
  await page.route('https://cdn.tailwindcss.com**', route => route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind = {config:{}};' }));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  const session = {
    mode: 'dev', accessToken: 'local-browser-test', currentRole: 'BOSS',
    user: { id: '11111111-2222-3333-4444-555555555555', displayName: '导入验收', roles: ['BOSS'], currentRole: 'BOSS' },
    permissions: { items: ['import:product', 'product:manage', 'import:shipment', 'product_request:export'].map(code => ({ code, scope: 'ALL' })) }
  };
  await page.addInitScript(value => localStorage.setItem('tmo:admin:web:auth', JSON.stringify(value)), session);
  await page.route('**/api/bff/bootstrap', route => route.fulfill({ json: { me: session.user, permissions: session.permissions, featureFlags: {} } }));
  await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('import-page')).toBeVisible();
}

test('real catalog preview, confirmation, history and export round trip', async ({ page }) => {
  test.skip(!process.env.TMO_IMPORT_WORKBENCH_REAL, 'Requires an isolated commerce test server');
  await enterWorkbench(page);
  const suffix = Date.now().toString();
  const name = '三级实测-' + suffix;
  const categoryResponse = await page.request.post('/api/catalog/categories', { data: { name: '浏览器测试-' + suffix } });
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
  let products = await (await page.request.get('/api/admin/products', { params: { q: name } })).json();
  expect(products.total).toBe(0);
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成', { timeout: 30000 });
  products = await (await page.request.get('/api/admin/products', { params: { q: name } })).json();
  expect(products.total).toBe(1);
  const productId = products.items[0].id;
  const detail = await (await page.request.get('/api/catalog/products/' + productId)).json();
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
  const href = await page.getByRole('link', { name: '下载导出文件' }).getAttribute('href');
  expect(href).toBeTruthy();
  const exported = await page.request.get(href!);
  expect(exported.status()).toBe(200);
  const exportBody = await exported.body();
  const parsed = XLSX.read(exportBody, { type: 'buffer' });
  expect(XLSX.utils.sheet_to_json(parsed.Sheets[parsed.SheetNames[0]])).toHaveLength(2);
  await page.getByRole('button', { name: '商品导入', exact: true }).click();
  await page.getByTestId('product-import-excel').setInputFiles({ name: 'roundtrip.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: exportBody });
  await page.getByTestId('product-import-submit').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待确认', { timeout: 30000 });
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成', { timeout: 30000 });
  const after = await (await page.request.get('/api/catalog/products/' + productId)).json();
  expect(after.skus.map((item: any) => item.id).sort()).toEqual(detail.skus.map((item: any) => item.id).sort());
  expect(after.skus.map((item: any) => item.priceTiers)).toEqual(detail.skus.map((item: any) => item.priceTiers));
});

test('real legacy recognition creates independent drafts and persistent review', async ({ page }) => {
  test.skip(!process.env.TMO_IMPORT_WORKBENCH_REAL, 'Requires an isolated commerce test server');
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
  const preview = await (await page.request.get('/api/admin/products/import-jobs/' + jobId + '/preview')).json();
  expect(preview.summary.splitProducts).toBe(2);
  expect(preview.summary.failedRows).toBe(0);
  await page.getByTestId('product-import-confirm').click();
  await expect(page.getByTestId('latest-import-job-status')).toContainText('待复核', { timeout: 30000 });
  const reviews = await (await page.request.get('/api/admin/products/import-reviews?pageSize=100')).json();
  const own = reviews.items.filter((item: any) => item.jobId === jobId);
  expect(new Set(own.map((item: any) => item.productId)).size).toBe(2);
  for (const id of new Set<string>(own.map((item: any) => item.productId))) {
    const detail = await (await page.request.get('/api/catalog/products/' + id)).json();
    expect(detail.product.status).toBe('DRAFT');
    expect(detail.skus).toHaveLength(1);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^任务历史/ }).click();
  await expect(page.getByRole('heading', { name: '商品复核' })).toBeVisible();
  await expect(page.getByText('采购清单 · 第 2 行').first()).toBeVisible();
});
