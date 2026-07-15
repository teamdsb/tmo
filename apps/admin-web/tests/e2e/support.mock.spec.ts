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
  await expect(page.getByTestId('support-send-button')).toBeVisible();
});
