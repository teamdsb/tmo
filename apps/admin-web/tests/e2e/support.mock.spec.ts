import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('mock support workspace shows customer card and priority cues', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/support.html');

  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page.getByTestId('support-customer-card')).toContainText('宁波远航供应链');
  await expect(page.getByTestId('support-customer-card')).toContainText('13700137000');
  await expect(page.getByTestId('support-customer-card')).toContainText('张销售');

  const firstConversation = page.getByTestId('support-conversation-5dcb2d0d-a284-4538-a395-02a7a9025a10');
  await expect(firstConversation).toContainText('宁波远航供应链');
  await expect(firstConversation).toContainText('13700137000');
  await expect(firstConversation).toContainText('归属销售 张销售');
  await expect(firstConversation).toContainText('等待超时');
  await expect(page.getByTestId('support-active-customer-name')).toContainText('宁波远航供应链');

  await expect(page.getByTestId('support-reply-input')).toBeDisabled();
  await expect(page.getByTestId('support-product-picker-open')).toBeDisabled();
  await expect(page.getByText('请先认领会话后再回复客户')).toBeVisible();

  await page.getByTestId('support-claim-button').click();

  await expect(page.getByTestId('support-reply-input')).toBeEnabled();
  await expect(page.getByTestId('support-product-picker-open')).toBeEnabled();
  await expect(page.getByTestId('support-claim-button')).toBeDisabled();
});

test('support product card opens product detail drawer', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/support.html');

  const productCard = page.getByTestId('support-product-card-spu-bolt-a2');
  await expect(productCard).toContainText('不锈钢六角螺栓 A2');

  await productCard.click();

  await expect(page).toHaveURL(/products\.html\?productId=spu-bolt-a2/);
  await expect(page.locator('#product-edit-drawer')).toBeVisible();
  await expect(page.locator('#product-edit-drawer input[name="name"]')).toHaveValue('不锈钢六角螺栓 A2');
});

test('support reply composer stays pinned when conversation history is long', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/support.html');

  await expect(page.getByTestId('support-reply-input')).toBeVisible();
  await expect(page.locator('[data-testid^="support-message-"]').first()).toBeVisible();
  await page.evaluate(() => {
    const firstMessage = document.querySelector('[data-testid^="support-message-"]');
    const messageList = firstMessage?.parentElement;
    if (!messageList || !firstMessage) {
      throw new Error('support message list fixture not found');
    }
    for (let index = 0; index < 28; index += 1) {
      const clone = firstMessage.cloneNode(true);
      if (clone instanceof HTMLElement) {
        clone.dataset.testid = `support-message-long-${index}`;
        clone.querySelector('p')?.append(` 长消息内容 ${index + 1} `.repeat(12));
      }
      messageList.appendChild(clone);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });

  const inputBox = await page.getByTestId('support-reply-input').boundingBox();
  const viewport = page.viewportSize();
  expect(inputBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  const inputBottom = inputBox!.y + inputBox!.height;
  expect(inputBottom).toBeLessThanOrEqual(viewport!.height - 16);
  expect(inputBox!.y).toBeGreaterThan(viewport!.height - 180);
  expect(inputBox!.height).toBeLessThanOrEqual(80);
  await expect(page.getByTestId('support-send-button')).toBeVisible();
});

test('support reply clears the composer after a successful send', async ({ page }) => {
  await page.route('**/support/conversations/*/messages', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-support-reply-1',
        conversationId: '5dcb2d0d-a284-4538-a395-02a7a9025a10',
        senderType: 'STAFF',
        senderRole: 'CS',
        messageType: 'TEXT',
        textContent: '请稍等，我马上为您确认。',
        createdAt: '2026-03-10T18:31:00Z'
      })
    });
  });
  await loginMockBoss(page);
  await page.goto('/support.html');

  await page.getByTestId('support-claim-button').click();

  const input = page.getByTestId('support-reply-input');
  await input.fill('请稍等，我马上为您确认。');
  await page.getByTestId('support-send-button').click();

  await expect(input).toHaveValue('');
  await expect(page.getByText('发送失败')).not.toBeVisible();
});

test('support selects and sends a searched product exactly once', async ({ page }) => {
  const firstProductId = '11111111-1111-4111-8111-111111111111';
  const secondProductId = '22222222-2222-4222-8222-222222222222';
  const catalogRequests: URL[] = [];
  const sentBodies: Array<Record<string, unknown>> = [];

  await page.route('**/catalog/products**', async (route) => {
    const requestUrl = new URL(route.request().url());
    catalogRequests.push(requestUrl);
    const isSearch = requestUrl.searchParams.get('q') === '螺栓';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: firstProductId, name: '不锈钢螺母', coverImageUrl: '/media/nut.png', categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ACTIVE', tags: [] },
          { id: secondProductId, name: '镀锌六角螺栓', coverImageUrl: '/media/bolt.png', categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ACTIVE', tags: [] }
        ],
        page: 1,
        pageSize: 12,
        total: isSearch ? 2 : 13
      })
    });
  });
  await page.route('**/support/conversations/*/messages', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sentBodies.push(body);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-product-message-1',
        conversationId: '5dcb2d0d-a284-4538-a395-02a7a9025a10',
        senderType: 'STAFF',
        senderRole: 'BOSS',
        messageType: 'PRODUCT_CARD',
        cardPayload: body.cardPayload,
        createdAt: '2026-08-17T10:00:00Z'
      })
    });
  });

  await loginMockBoss(page);
  await page.goto('/support.html');
  await page.getByTestId('support-claim-button').click();
  await page.getByTestId('support-product-picker-open').click();

  await expect(page.getByTestId('support-product-picker')).toBeVisible();
  await page.getByTestId('support-product-page-next').click();
  await expect.poll(() => catalogRequests.some((url) => url.searchParams.get('page') === '2')).toBe(true);
  await page.getByTestId('support-product-search-input').fill('螺栓');
  await page.getByTestId('support-product-search-submit').click();
  await expect(page.getByText('镀锌六角螺栓')).toBeVisible();
  await page.getByTestId(`support-product-select-${secondProductId}`).click();

  await expect.poll(() => sentBodies.length).toBe(1);
  expect(catalogRequests.some((url) => url.searchParams.get('q') === '螺栓')).toBe(true);
  expect(sentBodies[0]).toMatchObject({
    messageType: 'PRODUCT_CARD',
    cardPayload: {
      productId: secondProductId,
      route: `/pages/goods/detail/index?id=${secondProductId}`
    }
  });
  await expect(page.getByTestId('support-product-picker')).not.toBeVisible();
  await expect(page.locator('[data-support-message-type="PRODUCT_CARD"]').filter({ hasText: '镀锌六角螺栓' })).toHaveCount(1);
});

test('support keeps the product picker open when product sending fails', async ({ page }) => {
  const productId = '33333333-3333-4333-8333-333333333333';
  await page.route('**/catalog/products**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{ id: productId, name: '已下架测试商品', categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'ACTIVE', tags: [] }],
        page: 1,
        pageSize: 12,
        total: 1
      })
    });
  });
  await page.route('**/support/conversations/*/messages', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_request', message: '商品已下架' })
    });
  });

  await loginMockBoss(page);
  await page.goto('/support.html');
  await page.getByTestId('support-claim-button').click();
  await page.getByTestId('support-product-picker-open').click();
  await page.getByTestId(`support-product-select-${productId}`).click();

  await expect(page.getByTestId('support-product-picker')).toBeVisible();
  await expect(page.getByTestId('support-product-picker')).toContainText('商品已下架');
  await expect(page.getByTestId(`support-product-select-${productId}`)).toBeEnabled();
});
