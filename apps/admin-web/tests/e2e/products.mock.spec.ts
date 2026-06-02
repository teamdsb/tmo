import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('product edit drawer uses image upload instead of cover URL input', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await expect(page.locator('#product-edit-drawer')).toBeVisible();
  await expect(page.getByText('封面图 URL')).toHaveCount(0);
  await expect(page.locator('#product-edit-drawer input[name="coverImageUrl"]')).toHaveCount(0);
  await expect(page.getByTestId('edit-product-cover-upload')).toBeVisible();

  await page.getByTestId('edit-product-cover-file').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  });

  await expect(page.locator('#product-edit-drawer [data-role="drawer-preview-image"]')).toHaveAttribute(
    'src',
    /^data:image\/png;base64,/
  );
});

test('product model code input keeps focus while accepting up to 20 digits', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  const modelCodeInput = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  await expect(modelCodeInput).toBeVisible();
  await modelCodeInput.fill('');
  await modelCodeInput.focus();
  await page.keyboard.type('abc12345678901234567890xyz987');

  await expect(modelCodeInput).toHaveValue('12345678901234567890');
  await expect(modelCodeInput).toBeFocused();
});

test('mock product edit persists after saving and reloading', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await page.locator('#product-edit-drawer input[name="name"]').fill('保存校验商品');
  const modelCodeInput = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  await modelCodeInput.fill('12345678901234567890');
  await page.locator('#product-edit-drawer button[type="submit"]').click();

  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);
  await expect(page.getByText('保存校验商品')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('保存校验商品')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();
  await expect(page.locator('#product-edit-drawer [data-field="model-code"]').first()).toHaveValue('12345678901234567890');
});
