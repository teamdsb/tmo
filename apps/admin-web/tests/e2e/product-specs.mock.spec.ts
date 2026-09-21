import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { loginMockBoss } from './import-fixtures';

const fixture = {
  id: 'spec-product', name: '三级规格商品', categoryId: '', status: 'DRAFT', description: '保留说明',
  images: ['https://example.com/original.jpg'], coverImageUrl: 'https://example.com/original.jpg', inventory: 0,
  filterDimensions: ['材质'], tags: ['标签|特殊'], tierPricing: [],
  models: [{ id: 'sku-one', name: '自定义名称', code: '', spec: '钢', attributes: { 材质: '钢', 备注: 'a:b|c' }, unit: '件', isActive: true,
    basePrice: 12, priceTiers: [{ minQty: 1, maxQty: 9, unitPriceFen: 1200 }, { minQty: 10, maxQty: null, unitPriceFen: 987 }] }]
};

const seed = async (page) => {
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 204 }));
  await loginMockBoss(page);
  await page.evaluate((product) => localStorage.setItem('admin-web-mock-products', JSON.stringify([product])), fixture);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
};

test('three named levels preserve SKU data across renaming and reject duplicate combinations', async ({ page }) => {
  await seed(page);
  await page.locator('[data-role="open-product-drawer"]').click();
  const drawer = page.locator('#product-edit-drawer');
  await drawer.getByLabel('第 1 级名称', { exact: true }).fill('材料');
  await drawer.getByRole('button', { name: '新增层级' }).click();
  await drawer.getByLabel('第 2 级名称', { exact: true }).fill('长度');
  await drawer.getByRole('button', { name: '新增层级' }).click();
  await drawer.getByLabel('第 3 级名称', { exact: true }).fill('直径');
  await expect(drawer.getByRole('button', { name: '新增层级' })).toBeDisabled();
  await drawer.getByLabel('第 1 行第 2 级规格值').fill('20mm');
  await drawer.getByLabel('第 1 行第 3 级规格值').fill('M6');
  await drawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-products') || '[]')[0]);
  expect(saved.filterDimensions).toEqual(['材料', '长度', '直径']);
  expect(saved.models[0]).toMatchObject({ id: 'sku-one', code: '', unit: '件', spec: '钢 / 20mm / M6', attributes: { 材料: '钢', 长度: '20mm', 直径: 'M6', 备注: 'a:b|c' }, priceTiers: fixture.models[0].priceTiers });
  expect(saved.models[0].attributes).not.toHaveProperty('材质');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-role="open-product-drawer"]').click();
  await expect(drawer.getByLabel('第 3 级名称', { exact: true })).toHaveValue('直径');
  await drawer.getByRole('button', { name: '新增型号' }).click();
  await drawer.getByLabel('第 2 行第 1 级规格值').fill('钢');
  await drawer.getByLabel('第 2 行第 2 级规格值').fill('20mm');
  await drawer.getByLabel('第 2 行第 3 级规格值').fill('M8');
  await drawer.getByRole('button', { name: '删除末级' }).click();
  await drawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(drawer).toContainText('第 1 行与第 2 行的启用规格组合重复');
  await drawer.locator('[data-field="model-active"]').nth(1).uncheck();
  await drawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(drawer).toHaveCount(0);
});

test('template and filtered export roundtrip preserve status, no-code SKU, exact tiers and no-SKU products', async ({ page }, testInfo) => {
  await seed(page);
  await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('admin-web-mock-products') || '[]');
    products.push({ ...products[0], id: 'empty-product', name: '无 SKU 商品', status: 'INACTIVE', models: [] });
    products.push({ ...products[0], id: 'unpriced-product', name: '询价商品', status: 'ACTIVE', filterDimensions: ['材质', '尺寸'], models: [
      { ...products[0].models[0], id: 'unpriced-sku', spec: '钢 / M6', attributes: { 材质: '钢', 尺寸: 'M6' }, basePrice: 0, priceTiers: undefined },
      { ...products[0].models[0], id: 'historical-sku', name: '历史 SKU', spec: '旧路径', attributes: { 旧材质: '铜' }, isActive: false }
    ] });
    localStorage.setItem('admin-web-mock-products', JSON.stringify(products));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '导出当前筛选结果' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载商品 Excel' }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath('roundtrip.xlsx');
  await download.saveAs(path);
  const workbook = XLSX.read(await readFile(path));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
  expect(rows).toHaveLength(4);
  expect(rows.find((row) => row['Product ID'] === fixture.id)['Spec 1 Name']).toBe('材质');
  expect(rows.find((row) => row['Product ID'] === fixture.id)['Price Tiers (Fen)']).toBe('1-9:1200|10-:987');
  await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
  const templateDownloadPromise = page.waitForEvent('download');
  await page.getByTestId('download-product-template').click();
  expect((await templateDownloadPromise).suggestedFilename()).toContain('模板');
  for (let repeat = 0; repeat < 2; repeat += 1) {
    await page.getByTestId('product-import-excel').setInputFiles(path);
    await page.getByTestId('product-import-submit').click();
    await expect(page.getByTestId('import-status-message')).toContainText('成功 4 行，失败 0 行');
  }
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
  expect(imported).toHaveLength(3);
  const product = imported.find((item) => item.id === fixture.id);
  expect(product.status).toBe('DRAFT');
  expect(product.tags).toEqual(['标签|特殊']);
  expect(product.images).toEqual(fixture.images);
  expect(product.models).toHaveLength(1);
  expect(product.models[0]).toMatchObject({ id: 'sku-one', code: '', unit: '件', attributes: fixture.models[0].attributes, priceTiers: fixture.models[0].priceTiers });
  expect(imported.find((item) => item.id === 'empty-product')).toMatchObject({ status: 'INACTIVE', models: [] });
  const unpriced = imported.find((item) => item.id === 'unpriced-product');
  expect(unpriced.models.find((sku) => sku.id === 'unpriced-sku').priceTiers).toEqual([]);
  expect(unpriced.models.find((sku) => sku.id === 'historical-sku')).toMatchObject({ isActive: false, spec: '旧路径', attributes: { 旧材质: '铜' } });
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#products-status-filter').selectOption('INACTIVE');
  await page.getByRole('button', { name: '导出当前筛选结果' }).click();
  const filtered = await page.getByRole('link', { name: '下载商品 Excel' }).getAttribute('href');
  const filteredWorkbook = XLSX.read(filtered!.split(',')[1], { type: 'base64' });
  expect(XLSX.utils.sheet_to_json(filteredWorkbook.Sheets[filteredWorkbook.SheetNames[0]])).toHaveLength(1);
  await page.locator('#products-status-filter').selectOption('DRAFT');
  await page.locator('[data-role="open-product-drawer"]').click();
  const importedDrawer = page.locator('#product-edit-drawer');
  await importedDrawer.getByLabel('第 1 级名称', { exact: true }).fill('材料');
  await importedDrawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(importedDrawer).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('tr[data-product-id="spec-product"] [data-role="open-product-drawer"]').click();
  await expect(page.locator('#product-edit-drawer').getByLabel('第 1 级名称', { exact: true })).toHaveValue('材料');

});


test('dimension names cannot overwrite unrelated attributes', async ({ page }) => {
  await seed(page);
  await page.locator('[data-role="open-product-drawer"]').click();
  const drawer = page.locator('#product-edit-drawer');
  await drawer.getByLabel('第 1 级名称', { exact: true }).fill('备注');
  await drawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(drawer).toContainText('与已有扩展属性冲突');
  const product = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-products') || '[]')[0]);
  expect(product.models[0].attributes).toEqual(fixture.models[0].attributes);
});


test('mock importer rejects duplicate ID/code aliases and rolls back the product group', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const products = JSON.parse(localStorage.getItem('admin-web-mock-products') || '[]');
    products[0].models[0].code = 'EXISTING';
    localStorage.setItem('admin-web-mock-products', JSON.stringify(products));
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Group Key', 'Product ID', 'SKU ID', 'SKU Code', 'Product Name', 'Category ID', 'Spec 1 Name', 'Spec 1 Value'],
    ['alias', 'spec-product', 'sku-one', '', fixture.name, '', '材质', '钢'],
    ['alias', 'spec-product', '', 'EXISTING', fixture.name, '', '材质', '铜']
  ]), 'Products');
  const bytes = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const result = await page.evaluate(async (base64) => {
    const importer = await import('/src/lib/product-import.js');
    const file = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'alias.xlsx');
    return importer.parseMockProductImport({ excelFile: file });
  }, bytes);
  expect(result.failedCount).toBe(2);
  expect(result.products).toHaveLength(0);
  expect(result.failedRows[0].error).toContain('same SKU');
});


test('sequential partial imports retain SKUs omitted from later workbooks', async ({ page }) => {
  await seed(page);
  const makeWorkbook = (skuId, skuCode, value) => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Group Key', 'Product ID', 'SKU ID', 'SKU Code', 'Product Name', 'Category ID', 'Spec 1 Name', 'Spec 1 Value'],
      ['partial', fixture.id, skuId, skuCode, fixture.name, '', '材质', value]
    ]), 'Products');
    return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  };
  const imported = await page.evaluate(async (workbooks) => {
    const importer = await import('/src/lib/product-import.js');
    for (const base64 of workbooks) {
      const file = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'partial.xlsx');
      const result = await importer.parseMockProductImport({ excelFile: file });
      if (result.failedCount) throw new Error(JSON.stringify(result.failedRows));
      importer.upsertImportedMockProducts(result.products);
    }
    return importer.loadImportedMockProducts();
  }, [makeWorkbook('', 'ADDED', '铜'), makeWorkbook('', 'ADDED-SECOND', '铝'), makeWorkbook('sku-one', '', '不锈钢')]);
  expect(imported[0].models).toHaveLength(3);
  expect(new Set(imported[0].models.map((model) => model.id)).size).toBe(3);
  expect(imported[0].models.find((model) => model.code === 'ADDED').attributes).toEqual({ 材质: '铜' });
  expect(imported[0].models.find((model) => model.id === 'sku-one').attributes).toEqual({ 材质: '不锈钢' });
});


test('mock importer rejects populated fourth specification columns', async ({ page }) => {
  await seed(page);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Group Key', 'Product Name', 'Category ID', 'Spec 1 Name', 'Spec 1 Value', 'Spec 4 Name', 'Spec 4 Value'],
    ['fourth', '非法四级商品', '', '材质', '钢', '非法层级', '值']
  ]), 'Products');
  const result = await page.evaluate(async (base64) => {
    const importer = await import('/src/lib/product-import.js');
    const file = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'fourth.xlsx');
    return importer.parseMockProductImport({ excelFile: file });
  }, XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }));
  expect(result.failedCount).toBe(1);
  expect(result.products).toHaveLength(0);
  expect(result.failedRows[0].error).toContain('three levels');
});


test('arbitrary dimension names survive editing and Excel roundtrip as own attributes', async ({ page }) => {
  await seed(page);
  await page.locator('[data-role="open-product-drawer"]').click();
  const drawer = page.locator('#product-edit-drawer');
  await drawer.getByLabel('第 1 级名称', { exact: true }).fill('__proto__');
  await drawer.getByRole('button', { name: '新增层级' }).click();
  await drawer.getByLabel('第 2 级名称', { exact: true }).fill('constructor');
  await drawer.getByLabel('第 1 行第 2 级规格值').fill('安全值');
  await drawer.getByRole('button', { name: '保存', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  const resultJson = await page.evaluate(async () => {
    const importer = await import('/src/lib/product-import.js');
    const products = JSON.parse(localStorage.getItem('admin-web-mock-products') || '[]');
    const base64 = importer.buildProductExportFileUrl(products).split(',')[1];
    const file = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'names.xlsx');
    return JSON.stringify(await importer.parseMockProductImport({ excelFile: file }));
  });
  // Playwright's object transport drops __proto__ keys; JSON preserves own attributes.
  const result = JSON.parse(resultJson);
  expect(result.failedCount).toBe(0);
  expect(result.products[0].models[0].attributes).toEqual(Object.fromEntries([['__proto__', '钢'], ['constructor', '安全值'], ['备注', 'a:b|c']]));
});


test('mixed product IDs sharing a Group Key fail atomically', async ({ page }) => {
  await seed(page);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Group Key', 'Product ID', 'Product Name', 'Category ID', 'Spec 1 Name', 'Spec 1 Value'],
    ['same-group', fixture.id, fixture.name, '', '材质', '钢'],
    ['same-group', '', fixture.name, '', '材质', '铜']
  ]), 'Products');
  const result = await page.evaluate(async (base64) => {
    const importer = await import('/src/lib/product-import.js');
    const file = new File([Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))], 'groups.xlsx');
    return importer.parseMockProductImport({ excelFile: file });
  }, XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }));
  expect(result.failedCount).toBe(2);
  expect(result.products).toHaveLength(0);
  expect(result.failedRows[0].error).toContain('identical product-level fields');
});
