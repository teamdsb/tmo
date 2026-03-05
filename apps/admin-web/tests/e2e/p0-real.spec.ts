import { expect, test, type Page, type Response } from '@playwright/test';

const isGet = (response: Response, path: string) => {
  const url = new URL(response.url());
  return response.request().method() === 'GET' && url.pathname === path;
};

const matchesPath = (response: Response, method: string, pattern: RegExp) => {
  const url = new URL(response.url());
  return response.request().method() === method && pattern.test(url.pathname);
};

const loginAsBoss = async (page: Page) => {
  await page.goto('/');
  await page.fill('#username', 'boss');
  await page.fill('#password', 'boss123');
  await Promise.all([
    page.waitForURL('**/dashboard.html'),
    page.locator('#login-form button[type="submit"]').click()
  ]);
  await expect(page).toHaveURL(/dashboard\.html/);
};

test('P0/P1 real mode flows work in admin-web', async ({ page }) => {
  await loginAsBoss(page);

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

  const promoteButtons = page.locator('[data-testid^="promote-to-sales-"]');
  const promoteCount = await promoteButtons.count();
  if (promoteCount > 0) {
    const firstButton = promoteButtons.first();
    const label = ((await firstButton.textContent()) || '').trim();
    const disabled = await firstButton.isDisabled();

    if (!disabled && label.includes('设为业务员')) {
      const promoteRespPromise = page.waitForResponse((response) =>
        matchesPath(response, 'POST', /^\/api\/admin\/customers\/[^/]+\/promote-to-sales$/)
      );
      await firstButton.click();
      const promoteResp = await promoteRespPromise;
      expect(promoteResp.status()).toBe(200);
      await expect(page.getByTestId('user-operations-success')).toContainText('设置为业务员');
    } else {
      await expect(firstButton).toContainText(/已是业务员|处理中/);
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
    isGet(response, '/api/admin/payments/transactions')
  );
  await page.goto('/payments.html');
  await expect(page.getByTestId('payments-page')).toBeVisible();
  const transactionsResp = await transactionsRespPromise;
  expect(transactionsResp.status()).toBe(200);

  const transactionRows = page.locator('[data-testid^="transaction-row-"]');
  if ((await transactionRows.count()) > 0) {
    await transactionRows.first().click();
    await expect(page.getByTestId('transaction-detail')).toBeVisible();
  }

  const webhooksRespPromise = page.waitForResponse((response) => isGet(response, '/api/admin/payments/webhooks'));
  await page.getByTestId('payments-tab-webhooks').click();
  const webhooksResp = await webhooksRespPromise;
  expect(webhooksResp.status()).toBe(200);

  const replayButtons = page.locator('[data-testid^="webhook-replay-"]');
  if ((await replayButtons.count()) > 0) {
    const replayRespPromise = page.waitForResponse((response) =>
      matchesPath(response, 'POST', /^\/api\/admin\/payments\/webhooks\/[^/]+\/replay$/)
    );
    await replayButtons.first().click();
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

    const saveRespPromise = page.waitForResponse((response) =>
      matchesPath(response, 'PATCH', /^\/api\/admin\/suppliers\/[^/]+$/)
    );
    await page.getByTestId('supplier-save-button').click();
    const saveResp = await saveRespPromise;
    expect(saveResp.status()).toBe(200);
    await expect(page.getByTestId('suppliers-success')).toContainText('保存成功');
  } else {
    await expect(page.getByTestId('suppliers-empty-state')).toBeVisible();
  }
});
