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
  await page.route('**/api/catalog/products?page=1&pageSize=200', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [serverProduct],
        page: 1,
        pageSize: 200,
        total: 1
      })
    });
  });
  await page.route(`**/api/catalog/products/${productId}`, async (route) => {
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        product: {
          ...productSummary,
          name: payload.name,
          description: payload.description,
          coverImageUrl: payload.coverImageUrl,
          images: payload.images,
          tags: productSummary.tags
        },
        skus: []
      })
    });
  });
};

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
