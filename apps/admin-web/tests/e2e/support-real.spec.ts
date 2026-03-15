import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { loginAsCs } from './import-fixtures';

type SupportArtifact = {
  conversationId: string;
  customerMessage: string;
};

const artifactPath = process.env.SUPPORT_REAL_E2E_ARTIFACT || '';
const replyText = process.env.SUPPORT_REAL_E2E_REPLY_TEXT || '';

const loadArtifact = async (): Promise<SupportArtifact> => {
  if (!artifactPath) {
    throw new Error('SUPPORT_REAL_E2E_ARTIFACT is required');
  }
  const raw = await readFile(artifactPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<SupportArtifact>;
  const conversationId = String(parsed.conversationId || '').trim();
  const customerMessage = String(parsed.customerMessage || '').trim();
  if (!conversationId) {
    throw new Error('support real e2e artifact missing conversationId');
  }
  if (!customerMessage) {
    throw new Error('support real e2e artifact missing customerMessage');
  }
  return {
    conversationId,
    customerMessage
  };
};

test('support real mode allows CS to claim and reply to a customer message', async ({ page }) => {
  test.skip(!artifactPath || !replyText, 'support real e2e env is not configured');

  const artifact = await loadArtifact();
  const customerMessageBubble = page.locator('[data-testid^="support-message-"]').filter({ hasText: artifact.customerMessage }).first();

  await loginAsCs(page);
  await page.goto(`/inquiries.html?conversationId=${encodeURIComponent(artifact.conversationId)}`);
  await expect(page.getByTestId('support-workspace-page')).toBeVisible();
  await expect(page.getByTestId(`support-conversation-${artifact.conversationId}`)).toBeVisible();
  await expect(customerMessageBubble).toBeVisible({ timeout: 30000 });

  const releaseButton = page.getByTestId('support-release-button');
  if (await releaseButton.isEnabled()) {
    const releaseResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST'
        && url.pathname === `/api/admin/support/conversations/${artifact.conversationId}/release`;
    });
    await releaseButton.click();
    const releaseResponse = await releaseResponsePromise;
    expect(releaseResponse.status()).toBe(200);
  }

  const claimButton = page.getByTestId('support-claim-button');
  if (await claimButton.isEnabled()) {
    const claimResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST'
        && url.pathname === `/api/admin/support/conversations/${artifact.conversationId}/claim`;
    });
    await claimButton.click();
    const claimResponse = await claimResponsePromise;
    expect([200, 409]).toContain(claimResponse.status());
  }

  await expect(page.getByTestId('support-active-customer-name')).toBeVisible();
  await expect(customerMessageBubble).toBeVisible();

  const replyInput = page.getByTestId('support-reply-input');
  await replyInput.fill(replyText);

  const sendResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname === `/api/support/conversations/${artifact.conversationId}/messages`;
  });

  await page.getByTestId('support-send-button').click();
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.status()).toBe(201);

  await expect(page.locator('[data-testid^="support-message-"]').filter({ hasText: replyText }).first()).toBeVisible({ timeout: 30000 });
});
