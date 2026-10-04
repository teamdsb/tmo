import { expect, test, type Page } from './offline-fixtures';
import { createMockSupportData } from '../../src/react/pages/admin/supportWorkspaceData';

const productId = '11111111-2222-3333-4444-555555555555';
const categoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const seedSession = async (page: Page, role: string, codes: string[], roles = [role]) => {
  const user = { id: '33333333-3333-3333-3333-333333333333', displayName: role, roles, currentRole: role };
  const permissions = { items: codes.map(code => ({ code, scope: 'ALL' })) };
  await page.addInitScript(value => localStorage.setItem('tmo:admin:web:auth', JSON.stringify(value)), {
    mode: 'dev', accessToken: 'isolated-test-token', user, currentRole: role, permissions
  });
  await page.route('**/api/bff/bootstrap', route => route.fulfill({ json: { me: user, permissions } }));
  await page.route('**/api/admin/support/conversations**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 50, total: 0 } }));
};

const rejectProductManagementRequests = async (page: Page) => {
  const requests: string[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const isManagement = /^\/api\/admin\/(?:products|miniapp)(?:\/|$)/.test(pathname);
    const isCatalogWrite = pathname.startsWith('/api/catalog/') && !['GET', 'HEAD'].includes(request.method());
    if (isManagement || isCatalogWrite) {
      requests.push(`${request.method()} ${pathname}`);
      await route.fulfill({ status: 403, json: { message: 'management is forbidden' } });
      return;
    }
    await route.fallback();
  });
  return requests;
};

test('manager browses active products and read-only details without management requests', async ({ page }) => {
  await seedSession(page, 'MANAGER', ['catalog:read'], ['MANAGER', 'BOSS']);
  const managementRequests: string[] = [];
  const catalogQueries: URLSearchParams[] = [];
  const summaries = [1, 2].map(index => ({ id: index === 1 ? productId : '22222222-2222-3333-4444-555555555555', name: `只读商品 ${index}`, categoryId, status: 'ACTIVE' }));
  await page.route('**/api/admin/{products,miniapp}/**', route => {
    managementRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'management is forbidden' } });
  });
  await page.route('**/api/admin/products**', route => {
    managementRequests.push(route.request().url());
    return route.fulfill({ status: 403, json: { message: 'management is forbidden' } });
  });
  await page.route('**/api/catalog/categories', route => route.fulfill({ json: { items: [{ id: categoryId, name: '紧固件', sort: 1 }] } }));
  await page.route('**/api/catalog/products?**', route => {
    const query = new URL(route.request().url()).searchParams;
    catalogQueries.push(query);
    const items = query.get('q') ? [summaries[1]] : [summaries[Number(query.get('page') || '1') - 1]];
    return route.fulfill({ json: { items, page: Number(query.get('page')), pageSize: 10, total: query.get('q') ? 1 : 11 } });
  });
  await page.route(`**/api/catalog/products/${productId}`, route => route.fulfill({ json: {
    product: { ...summaries[0], description: '只读商品详情', filterDimensions: ['直径'] },
    skus: [{ id: '44444444-4444-4444-4444-444444444444', spuId: productId, skuCode: 'BOLT-M6', name: 'M6 螺栓', spec: 'M6', attributes: { 直径: 'M6' }, unit: '个', isActive: true, priceTiers: [{ minQty: 1, maxQty: null, unitPriceFen: 8800 }] }]
  } }));

  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('readonly-products-page')).toBeVisible();
  await expect(page.getByText('只读商品 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看详情', exact: true }).first().click();
  const detail = page.getByRole('dialog', { name: '商品详情（只读）' });
  await expect(detail).toContainText('BOLT-M6');
  await expect(detail).toContainText('M6');
  await expect(detail).toContainText('88.00');
  await expect(detail.locator('input, textarea, select, button[type="submit"]')).toHaveCount(0);
  await detail.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.getByText('只读商品 2', { exact: true })).toBeVisible();
  await page.getByPlaceholder('搜索在售商品').fill('商品 2');
  await expect.poll(() => catalogQueries.at(-1)?.get('q')).toBe('商品 2');
  await expect.poll(() => catalogQueries.at(-1)?.get('page')).toBe('1');
  expect(catalogQueries.every(query => query.get('status') === 'ACTIVE')).toBe(true);
  expect(managementRequests).toEqual([]);
  await expect(page.getByRole('button', { name: /新建商品|编辑|删除|导出当前|类目管理/ })).toHaveCount(0);
});

test('CS support deep link uses the same access rule as the sidebar workspace', async ({ page }) => {
  await seedSession(page, 'CS', ['inquiry:manage', 'order:read']);
  await page.route('**/api/orders**', route => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/staff**', route => route.fulfill({ json: { items: [], total: 0 } }));
  await page.goto('/support.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page).toHaveURL(/\/support\.html$/);
});

test('CS notification opens the second conversation and its messages from dashboard', async ({ page }) => {
  await seedSession(page, 'CS', ['inquiry:manage', 'order:read']);
  const support = createMockSupportData();
  const first = {
    ...support.conversations[0],
    staffUnreadCount: 1,
    customerDisplayName: '默认会话客户',
    lastMessageAt: '2026-10-04T09:02:00Z',
    lastMessagePreview: '默认会话独有消息'
  };
  const second = {
    ...first,
    id: '6dcb2d0d-a284-4538-a395-02a7a9025a20',
    customerUserId: '2dcb2d0d-a284-4538-a395-02a7a9025a21',
    customerDisplayName: '通知目标客户',
    customerPhone: '13800138000',
    lastMessageAt: '2026-10-04T09:01:00Z',
    lastMessagePreview: '第二会话独有消息：请核对蓝色包装'
  };
  const template = support.details[first.id];
  const conversations = [first, second];
  await page.route(/\/api\/admin\/support\/conversations(?:\?|$)/, route => route.fulfill({ json: { items: conversations, page: 1, pageSize: 50, total: 2 } }));
  for (const [index, conversation] of conversations.entries()) {
    await page.route(`**/api/admin/support/conversations/${conversation.id}`, route => route.fulfill({ json: {
      conversation,
      messages: [{
        ...template.messages[0],
        id: `notification-conversation-${index + 1}`,
        conversationId: conversation.id,
        senderUserId: conversation.customerUserId,
        textContent: conversation.lastMessagePreview
      }],
      context: { ...template.context, customerUserId: conversation.customerUserId, recentOrders: [], recentInquiries: [], recentTickets: [] }
    } }));
  }
  await page.route('**/api/bff/admin/summary', route => route.fulfill({ json: { metrics: {} } }));
  await page.route('**/api/orders?**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 10, total: 0 } }));
  await page.route('**/api/inquiries/price?**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 10, total: 0 } }));
  await page.route('**/api/staff?**', route => route.fulfill({ json: { items: support.staff, page: 1, pageSize: 100, total: support.staff.length } }));

  await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('admin-support-notification-button').click();
  const notifications = page.getByTestId('admin-support-notification-panel').locator('[data-testid^="admin-support-notification-item-"]');
  await expect(notifications).toHaveCount(2);
  await expect(notifications.first()).toHaveAttribute('data-testid', `admin-support-notification-item-${first.id}`);
  await page.getByTestId(`admin-support-notification-item-${second.id}`).click();

  await expect(page).toHaveURL(new RegExp(`/support\\.html\\?conversationId=${second.id}$`));
  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page.getByTestId(`support-conversation-${first.id}`)).toBeVisible();
  await expect(page.getByTestId('support-active-customer-name')).toHaveText(second.customerDisplayName);
  await expect(page.getByTestId('support-customer-card')).toContainText(second.customerUserId);
  await expect(page.getByTestId('support-message-notification-conversation-2')).toContainText(second.lastMessagePreview);
  await expect(page.getByTestId('support-message-notification-conversation-1')).toHaveCount(0);
});

test('manager sees a read-only detail error for an inaccessible product deep link', async ({ page }) => {
  await seedSession(page, 'MANAGER', ['catalog:read']);
  const managementRequests = await rejectProductManagementRequests(page);
  await page.route('**/api/catalog/categories', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/catalog/products?**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 10, total: 0 } }));
  await page.route(`**/api/catalog/products/${productId}`, route => route.fulfill({ status: 403, json: { code: 'forbidden', message: 'Product is no longer active' } }));
  const detailResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/catalog/products/${productId}`);

  await page.goto(`/products.html?productId=${productId}`, { waitUntil: 'domcontentloaded' });
  expect((await detailResponse).status()).toBe(403);
  await expect(page.getByTestId('readonly-products-page')).toBeVisible();
  const detail = page.getByRole('dialog', { name: '商品详情（只读）' });
  await expect(detail.getByRole('alert')).toHaveText('目标商品不存在或无法访问。');
  await expect(detail.locator('input, textarea, select, button[type="submit"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /新建商品|编辑|删除|导出当前|类目管理|保存/ })).toHaveCount(0);
  expect(managementRequests).toEqual([]);
});

test('manager keeps the second product detail when the first request finishes last', async ({ page }) => {
  await seedSession(page, 'MANAGER', ['catalog:read']);
  const managementRequests = await rejectProductManagementRequests(page);
  const secondProductId = '22222222-2222-3333-4444-555555555555';
  const products = [
    { id: productId, name: '第一件慢响应商品', categoryId, status: 'ACTIVE' },
    { id: secondProductId, name: '第二件当前商品', categoryId, status: 'ACTIVE' }
  ];
  let releaseFirst!: () => void;
  const firstResponseGate = new Promise<void>(resolve => { releaseFirst = resolve; });
  await page.route('**/api/catalog/categories', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/catalog/products?**', route => route.fulfill({ json: { items: products, page: 1, pageSize: 10, total: 2 } }));
  await page.route(`**/api/catalog/products/${productId}`, async route => {
    await firstResponseGate;
    await route.fulfill({ json: { product: { ...products[0], description: '旧响应独有详情' }, skus: [] } });
  });
  await page.route(`**/api/catalog/products/${secondProductId}`, route => route.fulfill({ json: { product: { ...products[1], description: '当前响应独有详情' }, skus: [] } }));

  try {
    await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
    const firstRequest = page.waitForRequest(request => new URL(request.url()).pathname === `/api/catalog/products/${productId}`);
    await page.locator(`[data-product-id="${productId}"]`).getByRole('button', { name: '查看详情' }).click();
    await firstRequest;
    const detail = page.getByRole('dialog', { name: '商品详情（只读）' });
    await expect(detail).toContainText('加载商品详情...');
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(detail).toHaveCount(0);
    await page.locator(`[data-product-id="${secondProductId}"]`).getByRole('button', { name: '查看详情' }).click();
    await expect(detail.getByRole('heading', { name: products[1].name, exact: true })).toBeVisible();
    await expect(detail).toContainText('当前响应独有详情');

    const firstResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/catalog/products/${productId}`);
    releaseFirst();
    expect(await (await firstResponse).finished()).toBeNull();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

    await expect(detail.getByRole('heading', { name: products[1].name, exact: true })).toBeVisible();
    await expect(detail).toContainText('当前响应独有详情');
    await expect(detail).not.toContainText('旧响应独有详情');
    await expect(page).toHaveURL(new RegExp(`productId=${secondProductId}$`));
    expect(managementRequests).toEqual([]);
  } finally {
    releaseFirst();
  }
});

test('payment deep link applies its query to the first payment API request', async ({ page }) => {
  await seedSession(page, 'BOSS', ['payment:manage']);
  const queries: Array<string | null> = [];
  await page.route('**/payment-api/admin/payments/transactions**', route => {
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.goto('/payments.html?q=TXN-ONLY-THIS', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('输入关键字搜索')).toHaveValue('TXN-ONLY-THIS');
  await expect.poll(() => queries[0]).toBe('TXN-ONLY-THIS');
  await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
});

test('order payment links honor the application base path', async ({ page, baseURL }) => {
  await seedSession(page, 'BOSS', ['order:read', 'payment:manage']);
  const paymentId = 'payment with spaces';
  await page.route('**/api/orders?**', route => route.fulfill({ json: {
    items: [{ id: 'order-payment-link', status: 'CONFIRMED', paymentStatus: 'PAID', paymentMethod: 'ONLINE', latestPaymentId: paymentId,
      address: { receiverName: '客户', receiverPhone: '1', detail: '地址' }, items: [], createdAt: '2026-10-04T00:00:00Z' }], total: 1, page: 1, pageSize: 20
  } }));
  await page.route('**/api/catalog/products?**', route => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/staff?**', route => route.fulfill({ json: { items: [], total: 0 } }));
  const basePath = new URL(baseURL || 'http://127.0.0.1').pathname.replace(/\/$/, '');
  await page.goto(`${basePath}/orders.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: paymentId, exact: true })).toHaveAttribute('href', `${basePath}/payments.html?q=${encodeURIComponent(paymentId)}`);
});

test('quote workflow explicitly stays unavailable without fake transactions or actions', async ({ page }) => {
  await seedSession(page, 'BOSS', ['inquiry:manage']);
  await page.goto('/quote-workflow.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: '报价审批暂未开放' })).toBeVisible();
  await expect(page.getByRole('button', { name: /批准报价|请求修改|驳回/ })).toHaveCount(0);
  await expect(page.getByPlaceholder('输入消息...')).toHaveCount(0);
  await expect(page.getByText('¥12,500.00', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '返回在线客服' })).toHaveAttribute('href', '/inquiries.html');
});
