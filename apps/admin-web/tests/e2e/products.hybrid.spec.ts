import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const productId = '11111111-2222-3333-4444-555555555555';
const categoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const bossPermissions = {
  items: [
    { code: 'catalog:read', scope: 'ALL' },
    { code: 'product:manage', scope: 'ALL' }
  ]
};

const bossUser = {
  id: 'boss-user',
  displayName: 'Boss',
  userType: 'admin',
  roles: ['BOSS'],
  currentRole: 'BOSS'
};

const productSummary = {
  id: productId,
  name: '旧商品名',
  categoryId,
  coverImageUrl: 'https://cdn.example.com/old.png',
  tags: ['旧标签']
};

const skuId = '66666666-7777-8888-9999-000000000000';

const productDetail = {
  product: {
    ...productSummary,
    description: '旧简介',
    images: ['https://cdn.example.com/old.png']
  },
  skus: [
    {
      id: skuId,
      spuId: productId,
      skuCode: '1234567890',
      name: '旧型号',
      spec: '旧型号',
      priceTiers: [{ minQty: 1, maxQty: null, unitPriceFen: 8800 }],
      isActive: true
    }
  ]
};

const createUploadFixture = async () => {
  const uploadDir = path.resolve(process.cwd(), '../../tmp');
  const uploadPath = path.join(uploadDir, 'test-upload.png');
  await mkdir(uploadDir, { recursive: true });

  const png = new PNG({ width: 400, height: 300 });
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const offset = (png.width * y + x) << 2;
      png.data[offset] = Math.floor((x / png.width) * 255);
      png.data[offset + 1] = Math.floor((y / png.height) * 255);
      png.data[offset + 2] = 180;
      png.data[offset + 3] = 255;
    }
  }
  await writeFile(uploadPath, PNG.sync.write(png));
  return uploadPath;
};

const categoryList = {
  items: [{ id: categoryId, name: '紧固件', parentId: null, sort: 1 }]
};

const displayCategoryList = {
  items: [{ id: 'cat-fasteners', name: '紧固件', iconKey: 'setting', sort: 1, enabled: true }]
};

const installDevSession = async (page) => {
  await page.addInitScript(({ permissions, user }) => {
    window.localStorage.setItem(
      'tmo:admin:web:auth',
      JSON.stringify({
        mode: 'dev',
        accessToken: 'test-token',
        user,
        currentRole: 'BOSS',
        permissions,
        featureFlags: null,
        loginAt: '2026-05-28T00:00:00.000Z'
      })
    );
  }, { permissions: bossPermissions, user: bossUser });
};

const routeProductPageApis = async (page, options = {}) => {
  const patchStatus = options.patchStatus ?? 200;
  const uploadedImageUrl = options.uploadedImageUrl ?? 'http://127.0.0.1:5174/assets/media/catalog/products/test-upload.png';
  let serverProduct = { ...productSummary };
  let serverDetail = JSON.parse(JSON.stringify(options.productDetail ?? productDetail));

  await page.route('**/api/bff/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        me: bossUser,
        permissions: bossPermissions,
        featureFlags: null
      })
    });
  });
  await page.route('**/api/catalog/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(categoryList)
    });
  });
  await page.route('**/api/admin/miniapp/display-categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(displayCategoryList)
    });
  });
  await page.route('**/api/admin/support/conversations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 })
    });
  });
  await page.route('**/api/admin/catalog/products/assets', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ url: uploadedImageUrl, contentType: 'image/png', size: 8 })
    });
  });
  await page.route('**/assets/media/catalog/products/test-upload.png', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      path: options.uploadPath
    });
  });
  await page.route('**/api/catalog/products**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.pathname !== '/api/catalog/products') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: serverProduct ? [serverProduct] : [],
        page: 1,
        pageSize: 200,
        total: serverProduct ? 1 : 0
      })
    });
  });
  await page.route(`**/api/catalog/products/${productId}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(serverDetail)
      });
      return;
    }
    if (route.request().method() === 'DELETE') {
      serverProduct = null;
      await route.fulfill({ status: 204 });
      return;
    }
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    if (patchStatus !== 200) {
      await route.fulfill({
        status: patchStatus,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'update failed' })
      });
      return;
    }
    const payload = route.request().postDataJSON();
    serverProduct = {
      ...serverProduct,
      name: payload.name,
      categoryId: payload.categoryId,
      coverImageUrl: payload.coverImageUrl,
      tags: productSummary.tags
    };
    serverDetail = {
      ...serverDetail,
      product: {
        ...serverDetail.product,
        name: payload.name,
        description: payload.description,
        coverImageUrl: payload.coverImageUrl,
        images: payload.images
      }
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...serverDetail,
        product: serverDetail.product
      })
    });
  });
  await page.route(`**/api/catalog/products/${productId}/skus/${skuId}`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const payload = route.request().postDataJSON();
    serverDetail = {
      ...serverDetail,
      skus: serverDetail.skus.map((sku) => sku.id === skuId ? {
        ...sku,
        skuCode: payload.skuCode,
        name: payload.name,
        spec: payload.spec,
        priceTiers: payload.priceTiers,
        isActive: payload.isActive
      } : sku)
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(serverDetail.skus.find((sku) => sku.id === skuId))
    });
  });
};

test('product list groups statuses and leaves empty covers empty', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);
  await page.route('**/api/catalog/products**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.pathname !== '/api/catalog/products') {
      await route.continue();
      return;
    }
    const items = [
      { id: 'draft-first', name: '草稿商品一', status: 'DRAFT', coverImageUrl: '' },
      { id: 'active-empty-cover', name: '启用商品一', status: 'ACTIVE', coverImageUrl: '' },
      { id: 'inactive-only', name: '停用商品', status: 'INACTIVE', coverImageUrl: '' },
      { id: 'active-second', name: '启用商品二', status: 'ACTIVE', coverImageUrl: '' },
      { id: 'draft-second', name: '草稿商品二', status: 'DRAFT', coverImageUrl: '' }
    ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, page: 1, pageSize: 200, total: items.length })
    });
  });

  await page.goto('/products.html');

  const rowIds = await page.locator('tbody tr[data-product-id]').evaluateAll((rows) => (
    rows.map((row) => row.getAttribute('data-product-id'))
  ));
  expect(rowIds).toEqual([
    'active-empty-cover',
    'active-second',
    'draft-first',
    'draft-second',
    'inactive-only'
  ]);
  const emptyCover = page.locator('[data-product-id="active-empty-cover"] td').nth(1).locator('div').first();
  expect(await emptyCover.getAttribute('style')).toBeNull();
});

test('bulk status actions update selected products and filters clear selection', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);
  const secondProductId = '22222222-3333-4444-5555-666666666666';
  let items = [
    { id: productId, name: '批量商品一', status: 'DRAFT', categoryId, coverImageUrl: '' },
    { id: secondProductId, name: '批量商品二', status: 'DRAFT', categoryId, coverImageUrl: '' }
  ];
  const patchPayloads = [];

  await page.route('**/api/catalog/products**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/catalog/products') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, pageSize: 200, total: items.length })
      });
      return;
    }
    if (route.request().method() === 'PATCH' && url.pathname.startsWith('/api/catalog/products/')) {
      const id = url.pathname.split('/').pop();
      const payload = route.request().postDataJSON();
      patchPayloads.push({ id, payload });
      items = items.map((item) => item.id === id ? { ...item, status: payload.status } : item);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(items.find((item) => item.id === id))
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/products.html');

  for (const [role, status] of [
    ['bulk-set-active', 'ACTIVE'],
    ['bulk-set-draft', 'DRAFT'],
    ['bulk-set-inactive', 'INACTIVE']
  ]) {
    await page.locator('[data-role="select-all-products"]').check();
    await expect(page.locator('[data-role="bulk-selection-count"]')).toHaveText('已选择 2 项');
    const startCount = patchPayloads.length;
    await page.locator(`[data-role="${role}"]`).click();
    await expect.poll(() => patchPayloads.slice(startCount).map((item) => item.payload.status)).toEqual([status, status]);
    await expect(page.locator('[data-role="bulk-product-toolbar"]')).toHaveCount(0);
  }

  await page.locator('[data-role="select-all-products"]').check();
  await expect(page.locator('[data-role="bulk-product-toolbar"]')).toBeVisible();
  await page.locator('#products-status-filter').selectOption('DRAFT');
  await expect(page.locator('[data-role="bulk-product-toolbar"]')).toHaveCount(0);
});

test('bulk selection persists across pages and search clears it', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);
  const items = Array.from({ length: 11 }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
    name: `分页商品 ${String(index + 1).padStart(2, '0')}`,
    status: 'ACTIVE',
    categoryId,
    coverImageUrl: ''
  }));

  await page.route('**/api/catalog/products**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/catalog/products') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, pageSize: 200, total: items.length })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/products.html');
  await page.locator('[data-role="select-product-row"]').first().check();
  await page.locator('[data-role="page-number"][data-page="2"]').click();
  await page.locator('[data-role="select-product-row"]').first().check();
  await expect(page.locator('[data-role="bulk-selection-count"]')).toHaveText('已选择 2 项');

  await page.getByPlaceholder('按 SPU 名称或 SKU 编号搜索...').fill('不存在');
  await expect(page.locator('[data-role="bulk-product-toolbar"]')).toHaveCount(0);
});

test('bulk delete confirms once and keeps only failed products selected', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);
  const failedProductId = '33333333-4444-5555-6666-777777777777';
  let items = [
    { id: productId, name: '可删除商品一', status: 'ACTIVE', categoryId, coverImageUrl: '' },
    { id: failedProductId, name: '删除失败商品', status: 'DRAFT', categoryId, coverImageUrl: '' },
    { id: '44444444-5555-6666-7777-888888888888', name: '可删除商品二', status: 'INACTIVE', categoryId, coverImageUrl: '' }
  ];
  let confirmCount = 0;

  await page.route('**/api/catalog/products**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET' && url.pathname === '/api/catalog/products') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items, page: 1, pageSize: 200, total: items.length })
      });
      return;
    }
    if (route.request().method() === 'DELETE' && url.pathname.startsWith('/api/catalog/products/')) {
      const id = url.pathname.split('/').pop();
      if (id === failedProductId) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'delete failed' }) });
        return;
      }
      items = items.filter((item) => item.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });

  page.on('dialog', async (dialog) => {
    confirmCount += 1;
    await dialog.accept();
  });

  await page.goto('/products.html');
  await page.locator('[data-role="select-all-products"]').check();
  await page.locator('[data-role="bulk-delete-products"]').click();

  await expect.poll(() => confirmCount).toBe(1);
  await expect(page.getByText('批量删除完成：成功 2 项，失败 1 项。')).toBeVisible();
  await expect(page.locator('tbody tr[data-product-id]')).toHaveCount(1);
  await expect(page.locator(`[data-product-id="${failedProductId}"] [data-role="select-product-row"]`)).toBeChecked();
  await expect(page.locator('[data-role="bulk-selection-count"]')).toHaveText('已选择 1 项');
});

test('category sort can be cleared and inserts at an occupied position', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);
  let categories = [
    { id: categoryId, name: '紧固件', parentId: null, sort: 1 },
    { id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', name: '电气', parentId: null, sort: 2 }
  ];
  let createPayload;
  await page.route('**/api/catalog/categories**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/catalog/categories') {
      await route.continue();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: categories })
      });
      return;
    }
    if (route.request().method() === 'POST') {
      createPayload = route.request().postDataJSON();
      categories = [
        { id: 'cccccccc-dddd-eeee-ffff-000000000000', ...createPayload, parentId: null },
        ...categories.map((item) => ({ ...item, sort: item.sort + 1 }))
      ];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(categories[0])
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/products.html');
  await page.locator('#manage-category-btn').click();
  const modal = page.locator('#category-manager-modal');
  const nameInput = modal.locator('form input[name="name"]');
  const sortInput = modal.locator('form input[name="sort"]');

  await nameInput.fill('键盘');
  await sortInput.fill('');
  await expect(sortInput).toHaveValue('');
  await sortInput.fill('1');
  await expect(sortInput).toHaveValue('1');
  await modal.locator('form button[type="submit"]').click();

  await expect.poll(() => createPayload?.sort).toBe(1);
  await expect(modal.locator('[data-category-id="cccccccc-dddd-eeee-ffff-000000000000"] [data-role="category-sort"]')).toHaveValue('1');
  await expect(modal.locator(`[data-category-id="${categoryId}"] [data-role="category-sort"]`)).toHaveValue('2');
});

test('product edit persists changes through catalog PATCH', async ({ page }) => {
  const uploadPath = await createUploadFixture();
  await installDevSession(page);
  await routeProductPageApis(page, { uploadPath });

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();
  await expect(page.locator('#product-edit-drawer')).toBeVisible();

  await page.locator('#product-edit-drawer input[name="name"]').fill('新商品名');
  await page.getByTestId('edit-product-cover-file').setInputFiles(uploadPath);
  await expect(page.locator('#product-edit-drawer [data-role="drawer-preview-image"]')).toHaveAttribute(
    'src',
    'http://127.0.0.1:5174/assets/media/catalog/products/test-upload.png'
  );
  const imageResponse = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:5174/assets/media/catalog/products/test-upload.png');
    return {
      contentType: response.headers.get('content-type') || '',
      status: response.status
    };
  });
  expect(imageResponse.status).toBe(200);
  expect(imageResponse.contentType).toContain('image/png');

  const patchRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'PATCH' && url.pathname === `/api/catalog/products/${productId}`;
  });
  await page.locator('#product-edit-drawer button[type="submit"]').click();
  const patchRequest = await patchRequestPromise;
  const payload = patchRequest.postDataJSON();

  expect(payload.name).toBe('新商品名');
  expect(payload.categoryId).toBe(categoryId);
  expect(payload.coverImageUrl).toBe('http://127.0.0.1:5174/assets/media/catalog/products/test-upload.png');
  expect(payload.images).toEqual([payload.coverImageUrl]);
  await page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.status() === 200
      && url.pathname === '/api/catalog/products'
      && url.searchParams.get('pageSize') === '200';
  });
  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);
  await expect(page.getByText('新商品名')).toBeVisible();
  await page.reload();
  await expect(page.getByText('新商品名')).toBeVisible();
  await expect(page.locator(`[data-product-id="${productId}"] div[style*="test-upload.png"]`)).toBeVisible();
});

test('product edit keeps drawer open when catalog PATCH fails', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page, { patchStatus: 500 });

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();
  await page.locator('#product-edit-drawer input[name="name"]').fill('失败商品名');
  await page.locator('#product-edit-drawer button[type="submit"]').click();

  await expect(page.locator('#product-edit-drawer')).toBeVisible();
  await expect(page.locator('[data-role="drawer-error"]')).toContainText('保存失败');
  await expect(page.getByText('失败商品名')).toHaveCount(0);
});

test('product edit persists model fields through catalog SKU PATCH', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  const modelName = page.locator('#product-edit-drawer [data-field="model-name"]').first();
  const modelCode = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  const modelPrice = page.locator('#product-edit-drawer [data-field="model-base-price"]').first();
  await expect(modelName).toHaveValue('旧型号');
  await expect(modelCode).toHaveValue('1234567890');
  await expect(modelPrice).toHaveValue('88');

  await modelName.fill('新型号');
  await modelCode.fill('型号-长460*宽240+(a)');
  await modelPrice.fill('99.5');

  const skuPatchRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'PATCH' && url.pathname === `/api/catalog/products/${productId}/skus/${skuId}`;
  });
  await page.locator('#product-edit-drawer button[type="submit"]').click();
  const skuPatchRequest = await skuPatchRequestPromise;
  const payload = skuPatchRequest.postDataJSON();

  expect(payload.name).toBe('新型号');
  expect(payload.skuCode).toBe('型号-长460*宽240+(A)');
  expect(payload.spec).toBe('新型号');
  expect(payload.priceTiers).toEqual([{ minQty: 1, maxQty: null, unitPriceFen: 9950 }]);
  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);

  await page.locator('[data-role="open-product-drawer"]').first().click();
  await expect(page.locator('#product-edit-drawer [data-field="model-code"]').first()).toHaveValue('型号-长460*宽240+(A)');
  await expect(page.locator('#product-edit-drawer [data-field="model-base-price"]').first()).toHaveValue('99.5');
});

test('product edit shows saved SKU price tiers and preserves them on SKU PATCH', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page, {
    productDetail: {
      ...productDetail,
      skus: [
        {
          ...productDetail.skus[0],
          priceTiers: [
            { minQty: 1, maxQty: 4, unitPriceFen: 10000 },
            { minQty: 5, maxQty: 9, unitPriceFen: 9000 },
            { minQty: 10, maxQty: null, unitPriceFen: 8000 }
          ]
        }
      ]
    }
  });

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  const tierRows = page.locator('#product-edit-drawer [data-role="tier-row"]');
  await expect(tierRows).toHaveCount(2);
  await expect(tierRows.nth(0).locator('[data-field="tier-min-qty"]')).toHaveValue('5');
  await expect(tierRows.nth(0).locator('[data-field="tier-discount-rate"]')).toHaveValue('10');
  await expect(tierRows.nth(1).locator('[data-field="tier-min-qty"]')).toHaveValue('10');
  await expect(tierRows.nth(1).locator('[data-field="tier-discount-rate"]')).toHaveValue('20');

  const skuPatchRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'PATCH' && url.pathname === `/api/catalog/products/${productId}/skus/${skuId}`;
  });
  await page.locator('#product-edit-drawer button[type="submit"]').click();
  const skuPatchRequest = await skuPatchRequestPromise;
  const payload = skuPatchRequest.postDataJSON();

  expect(payload.priceTiers).toEqual([
    { minQty: 1, maxQty: 4, unitPriceFen: 10000 },
    { minQty: 5, maxQty: 9, unitPriceFen: 9000 },
    { minQty: 10, maxQty: null, unitPriceFen: 8000 }
  ]);
});

test('product row can delete a catalog product', async ({ page }) => {
  await installDevSession(page);
  await routeProductPageApis(page);

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());

  const deleteRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'DELETE' && url.pathname === `/api/catalog/products/${productId}`;
  });
  await page.locator('[data-role="delete-product"]').first().click();
  await deleteRequestPromise;

  await expect(page.getByText('旧商品名')).toHaveCount(0);
});
