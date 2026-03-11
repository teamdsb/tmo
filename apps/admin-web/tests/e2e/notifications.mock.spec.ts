import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

const mockConversation = {
  id: '5dcb2d0d-a284-4538-a395-02a7a9025a10',
  customerUserId: '1dcb2d0d-a284-4538-a395-02a7a9025a11',
  customerDisplayName: '宁波远航供应链',
  customerPhone: '13700137000',
  ownerSalesUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  assigneeUserId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  assigneeRole: 'CS',
  status: 'OPEN_ASSIGNED',
  lastMessageType: 'TEXT',
  lastMessagePreview: '客户刚刚发来一条新的催单消息。',
  lastMessageAt: '2026-03-11T12:30:00Z',
  customerUnreadCount: 0,
  staffUnreadCount: 2,
  createdAt: '2026-03-10T09:00:00Z',
  updatedAt: '2026-03-11T12:30:00Z',
  closedAt: ''
};

const dispatchMockUnread = async (page, conversation = mockConversation) => {
  await page.waitForFunction(() => Boolean(window.__TMO_ADMIN_SUPPORT_NOTIFICATIONS__?.dispatchMockUpdate));
  await page.evaluate((conversation) => {
    window.__TMO_ADMIN_SUPPORT_NOTIFICATIONS__.dispatchMockUpdate([conversation]);
  }, conversation);
};

test('dashboard notification item navigates to support conversation detail', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/dashboard.html');
  await expect(page.getByTestId('admin-support-notification-button')).toBeVisible();

  await expect(page.getByTestId('admin-support-notification-badge')).toHaveCount(0);

  await dispatchMockUnread(page);

  await expect(page.getByTestId('admin-support-notification-toast')).toContainText('宁波远航供应链 发来新消息');
  await expect(page.getByTestId('admin-support-notification-badge')).toHaveText('2');

  await page.getByTestId('admin-support-notification-button').click();
  await expect(page.getByTestId('admin-support-notification-panel')).toContainText('客户刚刚发来一条新的催单消息。');

  await page.getByTestId(`admin-support-notification-item-${mockConversation.id}`).click();
  await expect(page).toHaveURL(new RegExp(`support\\.html\\?conversationId=${mockConversation.id}`));
  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
});

test('support workspace topbar also shows injected unread notifications', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/support.html');
  await expect(page.getByTestId('admin-support-notification-button')).toBeVisible();

  const conversationButtons = page.locator('[data-testid^="support-conversation-"]');
  const conversationCount = await conversationButtons.count();
  const targetConversation = conversationButtons.nth(conversationCount > 1 ? 1 : 0);
  const targetTestId = await targetConversation.getAttribute('data-testid');
  const targetConversationId = String(targetTestId || '').replace('support-conversation-', '');

  await dispatchMockUnread(page, {
    ...mockConversation,
    id: targetConversationId,
    lastMessagePreview: '现有会话收到一条新的未读消息。'
  });

  await expect(page.getByTestId('admin-support-notification-badge')).toHaveText('2');
  await page.getByTestId('admin-support-notification-button').click();
  await expect(page.getByTestId(`admin-support-notification-item-${targetConversationId}`)).toContainText('现有会话收到一条新的未读消息。');
});

test('support page honors conversationId query on first load', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/support.html');
  const conversationButtons = page.locator('[data-testid^="support-conversation-"]');
  const targetConversation = conversationButtons.first();
  const targetTestId = await targetConversation.getAttribute('data-testid');
  const targetConversationId = String(targetTestId || '').replace('support-conversation-', '');
  const targetName = await targetConversation.locator('p').first().textContent();

  await page.goto(`/support.html?conversationId=${targetConversationId}`);

  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page.getByTestId('support-active-customer-name')).toContainText(String(targetName || '').trim());
});
