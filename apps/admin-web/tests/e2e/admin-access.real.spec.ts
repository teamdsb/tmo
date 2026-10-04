import { expect, test } from '@playwright/test';
import { loginAsBoss, loginAsCs, loginAsManager } from './import-fixtures';
import { requestAsSignedInUser, requestOnAppOrigin } from './real-fixtures';

test('real manager reads catalog details while catalog management remains forbidden', async ({ page }) => {
  await loginAsManager(page);
  const catalog = await requestAsSignedInUser(page, '/api/catalog/products?status=ACTIVE&page=1&pageSize=10');
  expect(catalog.status()).toBe(200);
  const firstProduct = (await catalog.json()).items[0];
  expect(firstProduct?.id, 'isolated seed must contain an active product').toBeTruthy();

  const forbidden = await requestAsSignedInUser(page, '/api/admin/products');
  expect(forbidden.status()).toBe(403);
  const write = await requestAsSignedInUser(page, `/api/catalog/products/${firstProduct.id}`, { method: 'PATCH', data: { name: firstProduct.name } });
  expect(write.status()).toBe(403);

  const managementCalls: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/admin/products') || pathname.startsWith('/api/admin/miniapp/display-categories')) managementCalls.push(pathname);
  });
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('readonly-products-page')).toBeVisible();
  await page.getByRole('button', { name: '查看详情', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '商品详情（只读）' })).toContainText(firstProduct.name);
  expect(managementCalls).toEqual([]);
});

test('real CS can use the support URL with seeded permissions', async ({ page }) => {
  await loginAsCs(page);
  await page.goto('/support.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page).toHaveURL(/support\.html/);
});

test('real payment deep link sends its filter to the payment service', async ({ page }) => {
  await loginAsBoss(page);
  const query = 'audit-payment-that-does-not-exist';
  const response = page.waitForResponse(value => {
    const url = new URL(value.url());
    return value.request().method() === 'GET' && url.pathname === '/payment-api/admin/payments/transactions' && url.searchParams.get('q') === query;
  });
  await page.goto(`/payments.html?q=${query}`, { waitUntil: 'domcontentloaded' });
  expect((await response).status()).toBe(200);
  await expect(page.getByPlaceholder('输入关键字搜索')).toHaveValue(query);
  await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
});

test('seeded admin role permissions match the mock account grants', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const mockGrants = await page.evaluate(async () => {
    const { listMockAccounts } = await import('/src/lib/mock-accounts.js');
    return Object.fromEntries(listMockAccounts().map(account => [account.role, account.permissions.items]));
  });
  const normalize = (items: Array<{ code: string; scope: string }>) => items.map(item => `${item.code}:${item.scope}`).sort();
  for (const username of ['boss', 'admin', 'manager', 'cs']) {
    const login = await requestOnAppOrigin(page, '/api/auth/password/login', { method: 'POST', data: { username, password: `${username}123` } });
    expect(login.status()).toBe(200);
    const { accessToken } = await login.json();
    const bootstrap = await requestOnAppOrigin(page, '/api/bff/bootstrap', { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(bootstrap.status()).toBe(200);
    const actual = (await bootstrap.json()).permissions.items;
    expect(normalize(mockGrants[username.toUpperCase()]), `${username} permissions`).toEqual(normalize(actual));
  }
});
