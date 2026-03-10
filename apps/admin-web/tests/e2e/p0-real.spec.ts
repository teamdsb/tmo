import { expect, test, type Response } from '@playwright/test';

import { loginAsBoss, loginAsManager } from './import-fixtures';

const isGet = (response: Response, path: string) => {
  const url = new URL(response.url());
  return response.request().method() === 'GET' && url.pathname === path;
};

const matchesPath = (response: Response, method: string, pattern: RegExp) => {
  const url = new URL(response.url());
  return response.request().method() === method && pattern.test(url.pathname);
};

test('P0/P1 real mode flows work in admin-web', async ({ page }) => {
  await loginAsBoss(page);
  await expect(page).toHaveURL(/dashboard\.html/);

  const customersRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/customers'));
  const salesUsersRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/sales-users'));
  const adminsRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/users'));

  await page.goto('/user-operations.html');
  await expect(page.getByTestId('user-operations-page')).toBeVisible();

  const [customersResp, salesUsersResp, adminsResp] = await Promise.all([
    customersRespPromise,
    salesUsersRespPromise,
    adminsRespPromise
  ]);
  expect(customersResp.status()).toBe(200);
  expect(salesUsersResp.status()).toBe(200);
  expect(adminsResp.status()).toBe(200);

  await page.getByTestId('tab-staff').click();
  const salesStaffRow = page.locator('tr', { hasText: 'Sales Dev' });
  await expect(salesStaffRow.getByRole('button', { name: '已是小程序业务员' })).toBeDisabled();
  const csStaffRow = page.locator('tr', { hasText: 'CS Dev' });
  await expect(csStaffRow.getByRole('button', { name: '已是客服' })).toBeDisabled();
  await expect(csStaffRow.getByRole('button', { name: '给予小程序业务员' })).toBeEnabled();
  const managerStaffRow = page.locator('tr', { hasText: 'Manager' });
  await expect(managerStaffRow.getByRole('button', { name: '已是经理' })).toBeDisabled();

  await page.getByTestId('tab-admins').click();
  const bossAdminRow = page.locator('tr').filter({ hasText: 'Boss' });
  await expect(bossAdminRow.getByRole('button', { name: '已是老板' })).toBeDisabled();
  await expect(bossAdminRow.getByRole('button', { name: '禁用账号' }).first()).toBeDisabled();
  const adminRow = page.locator('tr').filter({ hasText: 'Admin' });
  await expect(adminRow.getByRole('button', { name: '给予老板' })).toBeEnabled();
  await page.getByTestId('tab-customers').click();

  const promoteButtons = page.locator('[data-testid^="promote-to-sales-"]');
  const promoteCount = await promoteButtons.count();
  if (promoteCount > 0) {
    const firstButton = promoteButtons.first();
    const label = ((await firstButton.textContent()) || '').trim();
    const disabled = await firstButton.isDisabled();

    if (!disabled && label.includes('设为小程序业务员')) {
      await expect(firstButton).toContainText('设为小程序业务员');
    } else {
      await expect(firstButton).toContainText(/已是小程序业务员|处理中/);
    }
  } else {
    await expect(page.getByTestId('customers-empty-state')).toBeVisible();
  }

  const inquiriesRespPromise = page.waitForResponse((response) => isGet(response, '/api/inquiries/price'));
  await page.goto('/inquiries.html');
  await expect(page.getByTestId('inquiries-page')).toBeVisible();
  const inquiriesResp = await inquiriesRespPromise;
  expect(inquiriesResp.status()).toBe(200);

  const inquiryItems = page.locator('[data-testid^="inquiry-item-"]');
  const inquiryCount = await inquiryItems.count();
  if (inquiryCount > 0) {
    await inquiryItems.first().click();
    await expect(page.getByText('需求订单信息')).toBeVisible();
    await expect(page.getByText('需求单号')).toBeVisible();
    await expect(page.getByText(/REQ-/)).toBeVisible();
  } else {
    await expect(page.getByTestId('inquiry-list-empty')).toBeVisible();
  }

  const transactionsRespPromise = page.waitForResponse((response) =>
    isGet(response, '/payment-api/admin/payments/transactions')
  );
  await page.goto('/payments.html');
  await expect(page.getByTestId('payments-page')).toBeVisible();
  const transactionsResp = await transactionsRespPromise;
  expect(transactionsResp.status()).toBe(200);

  const transactionRows = page.locator('[data-testid^="transaction-row-"]');
  const transactionsReady = page.locator('[data-testid^="transaction-row-"], [data-testid="transactions-empty-state"]');
  await expect(transactionsReady.first()).toBeVisible();
  if ((await transactionRows.count()) > 0) {
    await transactionRows.first().click();
    await expect(page.getByTestId('transaction-detail')).toBeVisible();
  } else {
    await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
  }

  const webhooksRespPromise = page.waitForResponse((response) => isGet(response, '/payment-api/admin/payments/webhooks'));
  await page.getByTestId('payments-tab-webhooks').click();
  const webhooksResp = await webhooksRespPromise;
  expect(webhooksResp.status()).toBe(200);

  const webhookRows = page.locator('[data-testid^="webhook-row-"]');
  const webhooksReady = page.locator('[data-testid^="webhook-row-"], [data-testid="webhooks-empty-state"]');
  await expect(webhooksReady.first()).toBeVisible();
  if ((await webhookRows.count()) > 0) {
    const replayRespPromise = page.waitForResponse((response) =>
      matchesPath(response, 'POST', /^\/api\/admin\/payments\/webhooks\/[^/]+\/replay$/)
    );
    await page.getByRole('button', { name: '重放' }).first().click();
    const replayResp = await replayRespPromise;
    expect(replayResp.status()).toBe(200);
    await expect(page.getByTestId('payments-success')).toContainText('已提交重放');
  } else {
    await expect(page.getByTestId('webhooks-empty-state')).toBeVisible();
  }

  const suppliersRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/suppliers'));
  await page.goto('/suppliers.html');
  await expect(page.getByTestId('suppliers-page')).toBeVisible();
  const suppliersResp = await suppliersRespPromise;
  expect(suppliersResp.status()).toBe(200);

  const supplierRows = page.locator('[data-testid^="supplier-row-"]');
  if ((await supplierRows.count()) > 0) {
    await supplierRows.first().click();
    await expect(page.getByTestId('supplier-detail')).toBeVisible();
    await expect(page.getByTestId('supplier-save-button')).toBeVisible();
  } else {
    await expect(page.getByTestId('suppliers-empty-state')).toBeVisible();
  }
});

test('manager can login in real mode and access manager pages', async ({ page }) => {
  await loginAsManager(page);
  await expect(page).toHaveURL(/dashboard\.html/);
  await expect(page.locator('#user-role').first()).toContainText('经理');

  const salesUsersRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/sales-users'));
  await page.goto('/user-operations.html');
  await expect(page.getByTestId('user-operations-page')).toBeVisible();
  const salesUsersResp = await salesUsersRespPromise;
  expect(salesUsersResp.status()).toBe(200);
  await expect(page.getByTestId('tab-admins')).toHaveCount(0);

  await page.getByTestId('tab-staff').click();
  const csStaffRow = page.locator('tr', { hasText: 'CS Dev' });
  await expect(csStaffRow.getByRole('button', { name: '给予小程序业务员' })).toBeDisabled();
  await expect(csStaffRow.getByRole('button', { name: '禁用账号' }).first()).toBeEnabled();
});
