import { expect, test } from '@playwright/test';

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
  await page.route('**/api/catalog/products?page=1&pageSize=200', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [productSummary],
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
  await installDevSession(page);
  await routeProductPageApis(page);

  await page.goto('/products.html');
  await expect(page.getByText('旧商品名')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();
  await expect(page.locator('#product-edit-drawer')).toBeVisible();

  await page.locator('#product-edit-drawer input[name="name"]').fill('新商品名');
  await page.getByTestId('edit-product-cover-file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  });

  const patchRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === 'PATCH' && url.pathname === `/api/catalog/products/${productId}`;
  });
  await page.locator('#product-edit-drawer button[type="submit"]').click();
  const patchRequest = await patchRequestPromise;
  const payload = patchRequest.postDataJSON();

  expect(payload.name).toBe('新商品名');
  expect(payload.categoryId).toBe(categoryId);
  expect(payload.coverImageUrl).toMatch(/^data:image\/png;base64,/);
  expect(payload.images).toEqual([payload.coverImageUrl]);
  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);
  await expect(page.getByText('新商品名')).toBeVisible();
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
