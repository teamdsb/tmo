import { expect, test } from './offline-fixtures';
import { loginAsManager, loginMockBoss } from './import-fixtures';

test('mock role grants match the seeded manager and CS permissions', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const codes = await page.evaluate(async () => {
    const { listMockAccounts } = await import('/src/lib/mock-accounts.js');
    return Object.fromEntries(listMockAccounts().map(account => [account.role, account.permissions.items.map(item => item.code).sort()]));
  });
  expect(codes.MANAGER).toEqual(['after_sales:manage', 'catalog:read', 'customer:read', 'customer:tag', 'customer:transfer', 'inquiry:manage', 'order:manage', 'order:read', 'product_request:read', 'staff:read', 'staff:status_manage', 'tracking:read'].sort());
  expect(codes.CS).toEqual(['after_sales:manage', 'import:shipment', 'inquiry:manage', 'order:read', 'product_request:read', 'shipment:manage', 'tracking:read'].sort());
});

test('mock manager sees a read-only catalog and cannot enter the import workbench', async ({ page }) => {
  await loginAsManager(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('readonly-products-page')).toBeVisible();
  await expect(page.getByRole('button', { name: /新建商品|编辑|删除/ })).toHaveCount(0);
  await page.goto('/import.html', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/dashboard\.html$/);
});

test('mock payment search honors a deep link that has no matching transaction', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/payments.html?q=does-not-exist', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('输入关键字搜索')).toHaveValue('does-not-exist');
  await expect(page.getByTestId('transactions-empty-state')).toBeVisible();
});
