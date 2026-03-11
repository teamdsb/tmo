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
  await expect(salesStaffRow).toContainText('小程序业务员');
  await expect(salesStaffRow.getByTestId('staff-role-select-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')).toHaveValue('SALES');
  await expect(salesStaffRow.getByRole('button', { name: '禁用账号' })).toBeEnabled();
  const csStaffRow = page.locator('tr', { hasText: 'CS Dev' });
  await expect(csStaffRow).toContainText('客服');
  await expect(csStaffRow.getByTestId('staff-role-select-99999999-9999-9999-9999-999999999999')).toHaveValue('CS');
  await expect(csStaffRow.getByRole('button', { name: '禁用账号' })).toBeEnabled();
  const managerStaffRow = page.locator('tr', { hasText: 'Manager' });
  await expect(managerStaffRow).toContainText('经理');
  await expect(managerStaffRow.getByTestId('staff-role-select-ffffffff-ffff-ffff-ffff-ffffffffffff')).toHaveValue('MANAGER');
  await expect(managerStaffRow.getByRole('button', { name: '禁用账号' })).toBeEnabled();

  await page.getByTestId('tab-admins').click();
  const bossAdminRow = page.locator('tr').filter({ hasText: 'Boss' });
  await expect(bossAdminRow).toContainText('老板');
  await expect(bossAdminRow.getByTestId('admin-role-select-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')).toHaveValue('BOSS');
  await expect(bossAdminRow.getByRole('button', { name: '禁用账号' }).first()).toBeDisabled();
  const adminRow = page.locator('tr').filter({ hasText: 'Admin' });
  await expect(adminRow).toContainText('管理员');
  await expect(adminRow.getByTestId('admin-role-select-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toHaveValue('ADMIN');
  await expect(adminRow.getByRole('button', { name: '禁用账号' }).first()).toBeEnabled();
  await page.getByTestId('tab-customers').click();

  const customerRoleSelects = page.locator('[data-testid^="customer-role-select-"]');
  await expect(customerRoleSelects.first()).toBeVisible();
  await expect(page.getByTestId('customer-role-select-dddddddd-dddd-dddd-dddd-dddddddddddd')).toHaveValue('CUSTOMER');
  await expect(page.getByTestId('customer-role-select-cccccccc-cccc-cccc-cccc-cccccccccccc')).toHaveValue('SALES');

  await page.goto('/inquiries.html');
  await expect(page.getByText('在线客服工作台')).toBeVisible();
  const inquiryItems = page.locator('[data-testid^="inquiry-item-"], [data-testid^="support-conversation-"]');
  const inquiryCount = await inquiryItems.count();
  if (inquiryCount > 0) {
    await inquiryItems.first().click();
    await expect(page.getByText('客户资料')).toBeVisible();
  } else {
    await expect(page.getByText(/当前筛选条件下暂无需求会话|暂无会话/)).toBeVisible();
  }

  await page.goto('/payments.html');
  await expect(page.getByTestId('payments-page')).toBeVisible();

  const transactionRows = page.locator('[data-testid^="transaction-row-"]');
  const transactionsReady = page.locator('[data-testid^="transaction-row-"], [data-testid="transactions-empty-state"]');
  await expect(transactionsReady.first()).toBeVisible();
  if ((await transactionRows.count()) > 0) {
    await transactionRows.first().click();
    await expect(page.getByTestId('transaction-detail')).toBeVisible();
  } else {
    await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
  }

  await page.getByTestId('payments-tab-webhooks').click();
  await expect(page.locator('[data-testid^="webhook-row-"], [data-testid="webhooks-empty-state"]').first()).toBeVisible();

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

  await page.goto('/suppliers.html');
  await expect(page.getByTestId('suppliers-page')).toBeVisible();

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
  await expect(csStaffRow.getByTestId('staff-role-select-99999999-9999-9999-9999-999999999999')).toHaveValue('CS');
  await expect(csStaffRow.getByTestId('staff-role-select-99999999-9999-9999-9999-999999999999')).toBeDisabled();
  await expect(csStaffRow.getByRole('button', { name: '禁用账号' }).first()).toBeEnabled();
});
