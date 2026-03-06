import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('mock payments page loads transactions, audit logs, and webhook replay', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/payments.html');

  await expect(page.getByTestId('payments-page')).toBeVisible();
  await expect(page.getByTestId('payments-tab-transactions')).toBeVisible();
  await expect(page.getByTestId('payments-tab-audit')).toBeVisible();
  await expect(page.getByTestId('payments-tab-webhooks')).toBeVisible();

  await expect(page.getByTestId('transaction-detail')).toBeVisible();

  await page.getByTestId('payments-tab-audit').click();
  await expect(page.getByText('status_updated')).toBeVisible();

  await page.getByTestId('payments-tab-webhooks').click();
  const replayButton = page.getByTestId('webhook-replay-WH-MOCK-001');
  await expect(replayButton).toBeVisible();
  await replayButton.click();
  await expect(page.getByTestId('payments-success')).toContainText('已提交重放：WH-MOCK-001');
});
