import { expect, test } from '@playwright/test';

const orderId = '11111111-1111-1111-1111-111111111111';
const salesId = '22222222-2222-2222-2222-222222222222';
const permissions = { items: [{ code: 'order:read', scope: 'ALL' }, { code: 'order:manage', scope: 'ALL' }] };
const user = { id: '33333333-3333-3333-3333-333333333333', displayName: 'Boss', roles: ['BOSS'], currentRole: 'BOSS' };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ permissions, user }) => localStorage.setItem('tmo:admin:web:auth', JSON.stringify({ mode: 'dev', accessToken: 'token', user, currentRole: 'BOSS', permissions })), { permissions, user });
  await page.route(/\/(?:api\/)?bff\/bootstrap$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ me: user, permissions }) }));
  await page.route(/\/(?:api\/)?staff(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: salesId, displayName: '张业务', roles: ['SALES'], status: 'active' }], page: 1, pageSize: 100, total: 1 }) }));
  await page.route(/\/(?:api\/)?catalog\/products(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], page: 1, pageSize: 200, total: 0 }) }));
  await page.route(/\/(?:api\/)?admin\/support\/conversations(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }) }));
});

test('hybrid fulfillment refreshes payment, owner and audit timeline', async ({ page }) => {
  let paid = false;
  await page.route(/\/(?:api\/)?orders(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: orderId, status: paid ? 'CONFIRMED' : 'SUBMITTED', paymentStatus: paid ? 'PAID' : 'UNPAID', paymentChannel: paid ? 'OFFLINE' : null, ownerSalesUserId: paid ? salesId : null, address: { receiverName: '客户', receiverPhone: '1', detail: '地址' }, items: [], createdAt: '2026-07-06T10:00:00Z' }], page: 1, pageSize: 20, total: 1 }) }));
  await page.route(`**/api/admin/orders/${orderId}/events`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: paid ? [{ id: '44444444-4444-4444-4444-444444444444', orderId, actorUserId: user.id, action: 'OFFLINE_PAYMENT_AND_ASSIGN', note: '线下到账', previousStatus: 'SUBMITTED', newStatus: 'CONFIRMED', previousPaymentStatus: 'UNPAID', newPaymentStatus: 'PAID', newOwnerSalesUserId: salesId, createdAt: '2026-07-06T10:01:00Z' }] : [] }) }));
  await page.route(`**/api/admin/orders/${orderId}/fulfillment`, async (route) => { paid = true; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: orderId, status: 'CONFIRMED', paymentStatus: 'PAID', paymentChannel: 'OFFLINE', ownerSalesUserId: salesId, address: { receiverName: '客户', receiverPhone: '1', detail: '地址' }, items: [], createdAt: '2026-07-06T10:00:00Z' }) }); });
  await page.goto('/orders.html');
  await page.locator('[data-role="fulfillment-sales"]').selectOption(salesId);
  await page.locator('[data-role="fulfillment-note"]').fill('线下到账');
  await page.locator('[data-role="submit-fulfillment"]').click();
  await expect(page.locator('[data-role="order-fulfillment-panel"]')).toContainText('已支付');
  await expect(page.locator('[data-role="order-admin-events"]')).toContainText('线下到账');
});

test('hybrid fulfillment keeps the form when the server rejects the transition', async ({ page }) => {
  const order = { id: orderId, status: 'SUBMITTED', paymentStatus: 'UNPAID', address: { receiverName: '客户', receiverPhone: '1', detail: '地址' }, items: [], createdAt: '2026-07-06T10:00:00Z' };
  await page.route(/\/(?:api\/)?orders(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [order], page: 1, pageSize: 20, total: 1 }) }));
  await page.route(`**/api/admin/orders/${orderId}/events`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.route(`**/api/admin/orders/${orderId}/fulfillment`, (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_order_state', message: '订单已经发货，不能改派' }) }));
  await page.goto('/orders.html');
  await page.locator('[data-role="fulfillment-sales"]').selectOption(salesId);
  await page.locator('[data-role="fulfillment-note"]').fill('保留这条备注');
  await page.locator('[data-role="submit-fulfillment"]').click();
  await expect(page.locator('[data-role="fulfillment-error"]')).toContainText('订单已经发货，不能改派');
  await expect(page.locator('[data-role="fulfillment-note"]')).toHaveValue('保留这条备注');
  await expect(page.locator('[data-role="fulfillment-sales"]')).toHaveValue(salesId);
});

test('hybrid shipment moves a confirmed paid order to shipped', async ({ page }) => {
  let shipped = false;
  await page.route(/\/(?:api\/)?orders(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        id: orderId,
        status: shipped ? 'SHIPPED' : 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentChannel: 'WECHAT',
        ownerSalesUserId: salesId,
        tracking: shipped ? { shipments: [{ carrier: '顺丰', waybillNo: 'SF123456', shippedAt: '2026-07-06T10:05:00Z' }] } : { shipments: [] },
        address: { receiverName: '客户', receiverPhone: '1', detail: '地址' },
        items: [],
        createdAt: '2026-07-06T10:00:00Z'
      }],
      page: 1,
      pageSize: 20,
      total: 1
    })
  }));
  await page.route(`**/api/admin/orders/${orderId}/events`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.route(`**/api/admin/orders/${orderId}/ship`, async (route) => {
    const payload = route.request().postDataJSON() as { carrier?: string; waybillNo?: string; shippedAt?: string };
    expect(payload.carrier).toBe('顺丰');
    expect(payload.waybillNo).toBe('SF123456');
    expect(payload.shippedAt).toBeTruthy();
    shipped = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: orderId,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        paymentChannel: 'WECHAT',
        ownerSalesUserId: salesId,
        tracking: { shipments: [{ carrier: '顺丰', waybillNo: 'SF123456', shippedAt: '2026-07-06T10:05:00Z' }] },
        address: { receiverName: '客户', receiverPhone: '1', detail: '地址' },
        items: [],
        createdAt: '2026-07-06T10:00:00Z'
      })
    });
  });

  await page.goto('/orders.html');
  await expect(page.locator('[data-role="order-shipment-panel"]')).toContainText('确认发货');
  await page.locator('[data-role="shipment-carrier"]').fill('顺丰');
  await page.locator('[data-role="shipment-waybill"]').fill('SF123456');
  await page.locator('[data-role="submit-shipment"]').click();

  await expect(page.locator('[data-role="tracking-number"]')).toContainText('SF123456');
  await expect(page.locator('[data-role="shipping-badge-label"]')).toContainText('已发出');
});
