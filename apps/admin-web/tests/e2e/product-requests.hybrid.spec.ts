import { expect, test } from '@playwright/test';

const permissions = { items: [{ code: 'product_request:read', scope: 'ALL' }] };
const user = { id: 'boss-user', displayName: 'Boss', roles: ['BOSS'], currentRole: 'BOSS', userType: 'admin' };
const requestId = '11111111-2222-4333-8444-555555555555';

test('real product requests page sends server filters and renders the response', async ({ page }) => {
  const requestUrls: URL[] = [];
  await page.addInitScript(({ permissions: nextPermissions, user: nextUser }) => {
    window.localStorage.setItem('tmo:admin:web:auth', JSON.stringify({
      mode: 'dev', accessToken: 'test-token', user: nextUser, currentRole: 'BOSS', permissions: nextPermissions,
      featureFlags: null, loginAt: '2026-06-29T00:00:00.000Z'
    }));
  }, { permissions, user });
  await page.route('**/api/bff/bootstrap', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ me: user, permissions, featureFlags: null }) });
  });
  await page.route('**/api/catalog/categories', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 'category-1', name: '非标设备', parentId: null, sort: 1 }] }) });
  });
  await page.route('**/api/product-requests**', async (route) => {
    requestUrls.push(new URL(route.request().url()));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: requestId,
          createdByUserId: '99999999-8888-4777-8666-555555555555',
          name: '不锈钢控制柜',
          categoryId: 'category-1',
          spec: 'IP65',
          material: '304 stainless',
          dimensions: '800 × 600 × 300 mm',
          color: '银色',
          qty: '8 台',
          note: '需要室外安装',
          referenceImageUrls: ['https://cdn.example.com/request.png'],
          createdAt: '2026-06-15T08:30:00Z'
        }],
        page: 1,
        pageSize: 10,
        total: 1
      })
    });
  });

  await page.goto('/product-requests.html');
  await expect(page.getByRole('link', { name: '需求订单' })).toBeVisible();
  await expect(page.getByRole('link', { name: '在线客服' })).toHaveCount(0);
  await expect(page.locator(`[data-request-id="${requestId}"]`)).toContainText('不锈钢控制柜');
  await page.getByTestId('request-search').fill('stainless');
  await page.getByTestId('request-created-after').fill('2026-06-01');
  await page.getByTestId('request-created-before').fill('2026-06-30');

  await expect.poll(() => requestUrls.some((url) => (
    url.searchParams.get('q') === 'stainless'
    && url.searchParams.get('page') === '1'
    && url.searchParams.get('pageSize') === '10'
    && url.searchParams.get('createdAfter') === '2026-05-31T16:00:00.000Z'
    && url.searchParams.get('createdBefore') === '2026-06-30T15:59:59.999Z'
  ))).toBe(true);

  await page.getByTestId(`view-product-request-${requestId}`).click();
  await expect(page.getByTestId('product-request-detail')).toContainText('304 stainless');
  await expect(page.getByTestId('product-request-detail')).toContainText('需要室外安装');
});
