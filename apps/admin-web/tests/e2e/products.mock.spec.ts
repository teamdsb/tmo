import { expect, test } from '@playwright/test';

import { loginMockBoss } from './import-fixtures';

test('create product modal only closes from explicit controls', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /新建商品/ }).click();
  const modal = page.locator('#create-product-modal');
  await expect(modal).toBeVisible();

  await modal.click({ position: { x: 12, y: 12 } });
  await expect(modal).toBeVisible();

  await modal.locator('[data-role="close"]').click();
  await expect(modal).toHaveCount(0);
});

test('product delete works for active and draft products', async ({ page }) => {
  await loginMockBoss(page);
  await page.evaluate(() => {
    window.localStorage.setItem('admin-web-mock-products', JSON.stringify([
      {
        id: 'delete-active-product',
        name: 'E2E 启用删除商品',
        categoryId: 'fasteners',
        coverImageUrl: '',
        description: '',
        inventory: 0,
        models: [{ name: '默认型号', code: 'ACTIVE-DELETE', basePrice: 1 }],
        status: 'ACTIVE',
        tierPricing: []
      },
      {
        id: 'delete-draft-product',
        name: 'E2E 草稿删除商品',
        categoryId: 'fasteners',
        coverImageUrl: '',
        description: '',
        inventory: 0,
        models: [{ name: '默认型号', code: 'DRAFT-DELETE', basePrice: 1 }],
        status: 'DRAFT',
        tierPricing: []
      }
    ]));
  });
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  for (const productName of ['E2E 启用删除商品', 'E2E 草稿删除商品']) {
    const row = page.locator('tbody tr').filter({ hasText: productName });
    await expect(row).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await row.locator('[data-role="delete-product"]').click();
    await expect(row).toHaveCount(0);
  }
});

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

test('product model code input keeps focus while accepting Chinese and symbols', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  const modelCodeInput = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  await expect(modelCodeInput).toBeVisible();
  await modelCodeInput.fill('');
  await modelCodeInput.focus();
  await page.keyboard.type('型号-长460*宽240+(a)');

  await expect(modelCodeInput).toHaveValue('型号-长460*宽240+(A)');
  await expect(modelCodeInput).toBeFocused();
});

test('product model code input does not persist IME pinyin while composing Chinese', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  const modelCodeInput = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  await expect(modelCodeInput).toBeVisible();
  await modelCodeInput.fill('5');
  await modelCodeInput.focus();
  await modelCodeInput.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    input.value = '5a';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'a',
      inputType: 'insertCompositionText',
      isComposing: true
    }));
    input.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: 'a' }));
    input.value = '5啊';
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '啊' }));
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: '啊',
      inputType: 'insertCompositionText',
      isComposing: false
    }));
  });

  await expect(modelCodeInput).toHaveValue('5啊');
  await page.keyboard.type('b');
  await expect(modelCodeInput).toHaveValue('5啊B');
});

test('product tier quantity input keeps focus while typing multiple digits', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await page.locator('#product-edit-drawer [data-role="add-tier-row"]').click();
  const tierMinQtyInput = page.locator('#product-edit-drawer [data-field="tier-min-qty"]').first();
  await expect(tierMinQtyInput).toBeVisible();
  await tierMinQtyInput.focus();
  await tierMinQtyInput.selectText();
  await page.keyboard.type('20000');

  await expect(tierMinQtyInput).toHaveValue('20000');
  await expect(tierMinQtyInput).toBeFocused();
});

test('product tier number inputs can be cleared before retyping', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await page.locator('#product-edit-drawer [data-role="add-tier-row"]').click();
  const tierRow = page.locator('#product-edit-drawer [data-role="tier-row"]').first();
  const tierMinQtyInput = tierRow.locator('[data-field="tier-min-qty"]');
  const tierDiscountInput = tierRow.locator('[data-field="tier-discount-rate"]');

  await tierMinQtyInput.focus();
  await tierMinQtyInput.selectText();
  await page.keyboard.press('Backspace');
  await expect(tierMinQtyInput).toHaveValue('');
  await page.keyboard.type('300');
  await expect(tierMinQtyInput).toHaveValue('300');

  await tierDiscountInput.focus();
  await tierDiscountInput.selectText();
  await page.keyboard.press('Backspace');
  await expect(tierDiscountInput).toHaveValue('');
  await page.keyboard.type('8.5');
  await expect(tierDiscountInput).toHaveValue('8.5');
  await expect(tierDiscountInput).toBeFocused();
});

test('mock product edit persists after saving and reloading', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await page.locator('#product-edit-drawer input[name="name"]').fill('保存校验商品');
  const modelCodeInput = page.locator('#product-edit-drawer [data-field="model-code"]').first();
  await modelCodeInput.fill('型号-长460*宽240+(a)');
  await page.locator('#product-edit-drawer button[type="submit"]').click();

  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);
  await expect(page.getByText('保存校验商品')).toBeVisible();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('保存校验商品')).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();
  await expect(page.locator('#product-edit-drawer [data-field="model-code"]').first()).toHaveValue('型号-长460*宽240+(A)');
});
