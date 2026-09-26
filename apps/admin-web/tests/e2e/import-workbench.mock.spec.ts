import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';
import { loginMockBoss } from './import-fixtures';
const workbook = (rows: unknown[][], name = '商品') => {
    const file = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(file, XLSX.utils.aoa_to_sheet(rows), name);
    return { name: '商品数据.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(XLSX.write(file, { type: 'array', bookType: 'xlsx' })) };
};
const standard = workbook([
    ['Group Key', 'Product Name', 'Category ID', 'SKU Code', 'Spec 1 Name', 'Spec 1 Value', 'Spec 2 Name', 'Spec 2 Value', 'Spec 3 Name', 'Spec 3 Value', 'Unit'],
    ['three', '三层螺钉', '', 'THREE-1', '直径', 'M5', '长度', '16mm', '螺距', '0.8mm', '个'],
    ['three', '三层螺钉', '', 'THREE-2', '直径', 'M5', '长度', '20mm', '螺距', '0.8mm', '个']
]);
test('preview makes no catalog writes, confirmation persists and history survives reload', async ({ page }, testInfo) => {
    await loginMockBoss(page);
    await page.goto('/import.html');
    await page.getByTestId('product-import-excel').setInputFiles(standard);
    await page.getByTestId('product-import-submit').click();
    await expect(page.getByTestId('latest-import-job-status')).toHaveText('待确认');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'))).toHaveLength(0);
    await page.getByRole('button', { name: /三层螺钉/ }).click();
    await expect(page.getByLabel('第 2 行 长度 规格值')).toHaveValue('16mm');
    await page.getByTestId('product-import-confirm').click();
    await expect(page.getByTestId('latest-import-job-status')).toHaveText('已完成');
    const products = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
    expect(products).toHaveLength(1);
    expect(products[0].models).toHaveLength(2);
    expect(products[0].filterDimensions).toEqual(['直径', '长度', '螺距']);
    await page.reload();
    await page.getByRole('button', { name: '任务历史', exact: true }).click();
    await expect(page.getByRole('cell', { name: /商品数据.xlsx/ })).toBeVisible();
    await page.getByRole('button', { name: '查看', exact: true }).click();
    await expect(page.getByTestId('import-preview')).toContainText('三层螺钉');
    await page.screenshot({ path: testInfo.outputPath('import-history-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath('import-history-mobile.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
test('legacy ambiguous dimensions become independent drafts with durable reviews and source replay protection', async ({ page }) => {
    await loginMockBoss(page);
    await page.goto('/import.html');
    const file = workbook([
        ['采购资料'], ['序号', '物资', '规格型号', '单位', '分类'],
        [1, '纸箱', '620*600*340', '个', '低耗'], [2, '纸箱', '62*42*45CM', '只', '低耗'],
        [3, '轴承', '30309', '个', '五金'], [4, '轴承', '30310', '个', '五金']
    ], '采购数据');
    await page.getByTestId('product-import-excel').setInputFiles(file);
    await page.getByTestId('product-import-submit').click();
    await expect(page.getByTestId('import-preview')).toContainText('独立草稿');
    await page.getByRole('button', { name: /纸箱.*独立草稿/ }).click();
    await expect(page.getByTestId('import-preview')).toContainText('尺寸缺少明确单位');
    await page.getByTestId('product-import-confirm').click();
    let products = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
    expect(products).toHaveLength(3);
    expect(products.every((item: any) => item.status === 'DRAFT')).toBeTruthy();
    expect(products.find((item: any) => item.name === '轴承').models).toHaveLength(2);
    await page.getByTestId('product-import-excel').setInputFiles(file);
    await page.getByTestId('product-import-submit').click();
    await page.getByTestId('product-import-confirm').click();
    products = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
    expect(products).toHaveLength(3);
    await page.getByRole('button', { name: /任务历史/ }).click();
    await expect(page.getByText('尺寸缺少明确单位，保留完整型号为独立草稿，请确认单位。')).toBeVisible();
    await page.getByRole('button', { name: '标记已解决' }).first().click();
    await page.reload();
    await page.getByRole('button', { name: /任务历史/ }).click();
    await page.getByLabel('复核状态').selectOption('RESOLVED');
    await expect(page.getByText('尺寸缺少明确单位，保留完整型号为独立草稿，请确认单位。')).toBeVisible();
});
test('resolution increments revision and the full source workbook groups actual SKU combinations', async ({ page }) => {
    await loginMockBoss(page);
    await page.goto('/import.html');
    const file = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(file, XLSX.utils.aoa_to_sheet([
        ['商品编号', '规范商品名称', '商品说明'], ['P-1', '内六角螺钉', '来源信息']
    ]), '商品');
    XLSX.utils.book_append_sheet(file, XLSX.utils.aoa_to_sheet([
        ['商品编号', 'SKU编号', 'SKU显示名称', '需求数量单位'], ['P-1', 'S-1', 'M5x16', '个'], ['P-1', 'S-2', 'M6x20', '个']
    ]), 'SKU规格');
    XLSX.utils.book_append_sheet(file, XLSX.utils.aoa_to_sheet([
        ['商品编号', 'SKU编号', '属性名称', '数值', '文本值', '单位'],
        ['P-1', 'S-1', '螺纹直径', '', 'M5', ''], ['P-1', 'S-1', '长度', 16, '', 'mm'], ['P-1', 'S-1', '螺距', 0.8, '', 'mm'],
        ['P-1', 'S-2', '螺纹直径', '', 'M6', ''], ['P-1', 'S-2', '长度', 20, '', 'mm'], ['P-1', 'S-2', '螺距', 1, '', 'mm']
    ]), '独立属性');
    await page.getByTestId('product-import-excel').setInputFiles({ name: '母表.xlsx', mimeType: standard.mimeType, buffer: Buffer.from(XLSX.write(file, { type: 'array', bookType: 'xlsx' })) });
    await page.getByTestId('product-import-submit').click();
    await page.getByRole('button', { name: /内六角螺钉/ }).click();
    await page.getByLabel('第 2 行单位').fill('只');
    await page.getByRole('button', { name: '保存修正并重新校验' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 2');
    await page.getByTestId('product-import-confirm').click();
    const products = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
    expect(products).toHaveLength(1);
    expect(products[0].models).toHaveLength(2);
    expect(products[0].models[0].unit).toBe('只');
    expect(products[0].models[0].spec).toBe('M5 / 16mm / 0.8mm');
    await page.goto('/exports.html');
    await expect(page.getByRole('button', { name: '商品导出', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: '创建导出任务' }).click();
    await expect(page.getByRole('link', { name: '下载导出文件' })).toBeVisible();
});
test('editing product units keeps review pending until the admin explicitly resolves it', async ({ page }) => {
    await loginMockBoss(page);
    await page.evaluate(() => {
        localStorage.setItem('admin-web-mock-products', JSON.stringify([{ id: 'review-product', name: '待复核纸箱', status: 'DRAFT', categoryId: '', description: '', images: [], tags: [], inventory: 0, filterDimensions: ['规格'], tierPricing: [], models: [{ id: 'review-sku', code: 'REVIEW-1', name: '620*600*340', spec: '620*600*340', attributes: { 规格: '620*600*340' }, unit: '个', isActive: true, basePrice: 0, priceTiers: [] }] }]));
        localStorage.setItem('admin-web-mock-import-reviews', JSON.stringify([{ id: 'review-one', jobId: 'source-job', productId: 'review-product', skuId: 'review-sku', productName: '待复核纸箱', sourceSheet: '采购数据', sourceRow: 3, code: 'DIMENSION_UNIT_MISSING', message: '尺寸缺少单位，请确认原始记录。', status: 'PENDING', rawValues: {}, createdAt: new Date().toISOString() }]));
    });
    await page.goto('/products.html?productId=review-product', { waitUntil: 'domcontentloaded' });
    const drawer = page.locator('#product-edit-drawer');
    await expect(drawer.getByRole('region', { name: '导入待复核' })).toContainText('尺寸缺少单位');
    await drawer.getByLabel('第 1 行计量单位').fill('只');
    await drawer.getByRole('button', { name: '保存', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-import-reviews') || '[]')[0].status)).toBe('PENDING');
    await page.getByLabel('仅待复核商品').check();
    await page.locator('[data-role="open-product-drawer"]').click();
    await expect(drawer.getByLabel('第 1 行计量单位')).toHaveValue('只');
    await drawer.getByRole('button', { name: '标记已解决' }).click();
    await expect(drawer.getByRole('region', { name: '导入待复核' })).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-import-reviews') || '[]')[0].status)).toBe('RESOLVED');
});

test('explicit clears survive subsequent corrections and can be explicitly cancelled', async ({ page }) => {
    await loginMockBoss(page);
    await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('product-import-excel').setInputFiles(workbook([
        ['Group Key', 'Product Name', 'Category ID', 'SKU Code', 'Spec 1 Name', 'Spec 1 Value', 'Unit', 'Price Tiers (Fen)'],
        ['clear-price', '清空价格商品', '', 'CLEAR-1', '规格', 'M6', '个', '1-:1200']
    ]));
    await page.getByTestId('product-import-submit').click();
    await page.getByRole('button', { name: /清空价格商品/ }).click();
    await page.getByText('清空字段', { exact: true }).click();
    const clearPrice = page.getByLabel('阶梯价格', { exact: true });
    await clearPrice.check();
    await page.getByRole('button', { name: '保存修正并重新校验' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 2');
    await expect(clearPrice).toBeChecked();
    await page.getByLabel('第 2 行单位').fill('只');
    await page.getByRole('button', { name: '保存修正并重新校验' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 3');
    await expect(clearPrice).toBeChecked();
    await clearPrice.uncheck();
    await page.getByRole('button', { name: '保存修正并重新校验' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 4');
    await expect(clearPrice).not.toBeChecked();
    const preview = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('admin-web-mock-import-previews') || '{}'))[0] as any);
    expect(preview.items[0].rows[0].clearFields).toEqual([]);
    await clearPrice.check();
    await page.getByRole('button', { name: '保存修正并重新校验' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 5');
    await page.getByTestId('product-import-confirm').click();
    const products = await page.evaluate(() => JSON.parse(localStorage.getItem('admin-web-mock-imported-products') || '[]'));
    expect(products[0].models[0]).toMatchObject({ unit: '只', priceTiers: [], basePrice: 0 });
});

test('bulk category resolution only maps unclassified groups on the current preview page', async ({ page }) => {
    await loginMockBoss(page);
    const existingCategory = '11111111-1111-1111-1111-111111111111';
    const targetCategory = '22222222-2222-2222-2222-222222222222';
    await page.evaluate(([existing, target]) => localStorage.setItem('admin-web-products-categories', JSON.stringify([
        { id: existing, name: '已确认分类', parentId: null, sort: 0 }, { id: target, name: '目标分类', parentId: null, sort: 1 }
    ])), [existingCategory, targetCategory]);
    await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('product-import-excel').setInputFiles(workbook([
        ['Group Key', 'Product Name', 'Category ID', 'SKU Code', 'Spec 1 Name', 'Spec 1 Value', 'Unit'],
        ...Array.from({ length: 21 }, (_, index) => [`bulk-${index}`, `批量商品 ${index}`, index === 0 ? existingCategory : '', `BULK-${index}`, '规格', `M${index + 1}`, '个'])
    ]));
    await page.getByTestId('product-import-submit').click();
    await expect(page.getByTestId('import-preview')).toContainText('本页 19 个待分类商品');
    await page.getByLabel('批量设置分类').selectOption(targetCategory);
    await page.getByRole('button', { name: '应用到本页待分类商品' }).click();
    await expect(page.getByTestId('import-preview')).toContainText('版本 2');
    await expect(page.getByRole('button', { name: '应用到本页待分类商品' })).toBeDisabled();
    const preview = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('admin-web-mock-import-previews') || '{}'))[0] as any);
    expect(preview.items).toHaveLength(21);
    expect(preview.items[0].categoryId).toBe(existingCategory);
    expect(preview.items.slice(1, 20).every((group: any) => group.categoryId === targetCategory)).toBeTruthy();
    expect(preview.items[20].categoryId).toBe('');
});

test('completed review counts and filters follow pending targets while retaining preview audit issues', async ({ page }) => {
    await loginMockBoss(page);
    const legacy = (spec: string) => workbook([
        ['序号', '物资', '规格型号', '单位', '分类'], [1, '纸箱', spec, '个', '低耗']
    ]).buffer.toString('base64');
    const scenario = await page.evaluate(async ([original, changed]) => {
        const lifecycle = await import('/src/lib/product-import-workbench.js');
        const jobs = await import('/src/lib/product-import.js');
        const upload = async (base64: string) => lifecycle.createMockImportPreview({ excelFile: new File([Uint8Array.from(atob(base64), value => value.charCodeAt(0))], '复核计数.xlsx') });
        const first = await upload(original);
        const awaitingCount = first.summary.reviewCount;
        lifecycle.confirmMockImport(first.id, first.revision, 'first-confirm');
        const completedCount = jobs.getMockProductImportJob(first.id).summary.reviewCount;
        const replay = await upload(original);
        lifecycle.confirmMockImport(replay.id, replay.revision, 'replay-confirm');
        const pendingPreview = await upload(changed);
        const reviews = lifecycle.listMockImportReviews({ status: 'PENDING', pageSize: 100 }).items;
        lifecycle.resolveMockImportReview(reviews[0].id);
        return {
            firstId: first.id, replayId: replay.id, pendingId: pendingPreview.id,
            awaitingCount, completedCount, pendingCount: pendingPreview.summary.reviewCount,
            reviewIssues: reviews.length,
            partialFirst: jobs.getMockProductImportJob(first.id).summary.reviewCount,
            partialReplay: jobs.getMockProductImportJob(replay.id).summary.reviewCount
        };
    }, [legacy('620*600*340'), legacy('620*600*350')]);
    expect(scenario.awaitingCount).toBe(2);
    expect(scenario.reviewIssues).toBe(2);
    expect(scenario.completedCount).toBe(1);
    expect(scenario.partialFirst).toBe(1);
    expect(scenario.partialReplay).toBe(1);
    await page.goto(`/import.html?jobId=${scenario.firstId}`, { waitUntil: 'domcontentloaded' });
    const currentJob = page.getByTestId('latest-import-job');
    await expect(currentJob.getByTestId('latest-import-job-status')).toContainText('有待复核');
    await page.getByRole('button', { name: /任务历史/ }).click();
    await page.getByRole('button', { name: '标记已解决', exact: true }).click();
    await expect(currentJob.getByTestId('latest-import-job-status')).toHaveText('已完成');
    const result = await page.evaluate(async ({ firstId, replayId, pendingId }) => {
        const lifecycle = await import('/src/lib/product-import-workbench.js');
        const jobs = await import('/src/lib/product-import.js');
        const first = lifecycle.getMockImportPreview(firstId);
        return {
            firstCount: jobs.getMockProductImportJob(firstId).summary.reviewCount,
            replayCount: jobs.getMockProductImportJob(replayId).summary.reviewCount,
            previewCount: first.summary.reviewCount,
            completedFiltered: lifecycle.getMockImportPreview(firstId, { needsReview: true }).total,
            auditIssues: first.items[0].rows[0].issues.length,
            pendingCount: jobs.getMockProductImportJob(pendingId).summary.reviewCount,
            pendingFiltered: lifecycle.getMockImportPreview(pendingId, { needsReview: true }).total,
            historyCounts: jobs.loadMockProductImportJobs().filter(job => [firstId, replayId].includes(job.id)).map(job => job.summary.reviewCount)
        };
    }, scenario);
    expect(result).toMatchObject({ firstCount: 0, replayCount: 0, previewCount: 0, completedFiltered: 0, auditIssues: 2, pendingCount: scenario.pendingCount, pendingFiltered: 1, historyCounts: [0, 0] });
});

for (const role of ['manager', 'cs']) {
    test(`${role} retains shipment actions without exposing product jobs or review data`, async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('#username').fill(role);
        await page.locator('#password').fill(`${role}123`);
        await Promise.all([page.waitForURL('**/dashboard.html', { waitUntil: 'domcontentloaded' }), page.locator('#login-form button[type="submit"]').click()]);
        await page.evaluate(() => {
            localStorage.setItem('admin-web-mock-import-jobs', JSON.stringify([{ id: 'private-product-job', type: 'PRODUCT_IMPORT', status: 'AWAITING_CONFIRMATION', progress: 100, fileName: '不可见商品文件.xlsx' }]));
            localStorage.setItem('admin-web-mock-import-reviews', JSON.stringify([{ id: 'private-review', jobId: 'private-product-job', productId: 'private-product', productName: '不可见商品', message: '不可见复核内容', status: 'PENDING' }]));
        });
        await page.goto('/import.html?jobId=private-product-job', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('import-page')).toBeVisible();
        await expect(page.getByTestId('product-import-submit')).toHaveCount(0);
        await expect(page.getByRole('button', { name: '任务历史', exact: true })).toHaveCount(0);
        await expect(page.getByTestId('import-preview')).toHaveCount(0);
        await expect(page.getByText('不可见复核内容')).toHaveCount(0);
        await expect(page.getByTestId('import-error-message')).toHaveCount(0);
        await expect(page.getByTestId('shipment-import-submit')).toBeEnabled();
        await page.getByTestId('shipment-import-excel').setInputFiles(standard);
        await page.getByTestId('shipment-import-submit').click();
        await expect(page.getByTestId('latest-import-job-status')).toContainText('已完成');
        if (role === 'manager') await expect(page.getByTestId('request-export-submit')).toBeEnabled();
        else await expect(page.getByTestId('request-export-submit')).toBeDisabled();
        await expect(page.getByTestId('import-error-message')).toHaveCount(0);
    });
}
