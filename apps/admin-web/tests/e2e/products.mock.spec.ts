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

test('bulk status and delete actions persist in mock mode', async ({ page }) => {
  await loginMockBoss(page);
  await page.evaluate(() => {
    window.localStorage.setItem('admin-web-mock-products', JSON.stringify([
      {
        id: 'bulk-mock-one',
        name: '批量 Mock 商品一',
        categoryId: 'fasteners',
        coverImageUrl: '',
        description: '',
        inventory: 0,
        models: [{ name: '默认型号', code: 'BULK-MOCK-ONE', basePrice: 1 }],
        status: 'ACTIVE',
        tierPricing: []
      },
      {
        id: 'bulk-mock-two',
        name: '批量 Mock 商品二',
        categoryId: 'fasteners',
        coverImageUrl: '',
        description: '',
        inventory: 0,
        models: [{ name: '默认型号', code: 'BULK-MOCK-TWO', basePrice: 1 }],
        status: 'DRAFT',
        tierPricing: []
      }
    ]));
  });
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await page.locator('[data-role="select-all-products"]').check();
  await page.locator('[data-role="bulk-set-inactive"]').click();
  await expect(page.locator('tbody tr[data-product-id]').filter({ hasText: '停用' })).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(window.localStorage.getItem('admin-web-mock-products') || '[]').map((item) => item.status)
  ))).toEqual(['INACTIVE', 'INACTIVE']);

  await page.locator('[data-role="select-all-products"]').check();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-role="bulk-delete-products"]').click();
  await expect(page.locator('tbody tr[data-product-id]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(window.localStorage.getItem('admin-web-mock-products') || '[]').length
  ))).toBe(0);
});

test('product edit drawer uploads, reorders, removes, and persists multiple images', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('[data-role="open-product-drawer"]').first()).toBeVisible();
  await page.locator('[data-role="open-product-drawer"]').first().click();

  await expect(page.locator('#product-edit-drawer')).toBeVisible();
  await expect(page.getByText('封面图 URL')).toHaveCount(0);
  await expect(page.locator('#product-edit-drawer input[name="coverImageUrl"]')).toHaveCount(0);
  await expect(page.getByTestId('edit-product-cover-upload')).toBeVisible();

  const imageItems = page.locator('#product-edit-drawer [data-role="product-image-item"]');
  const existingImageCount = await imageItems.count();
  for (let index = 0; index < existingImageCount; index += 1) {
    await imageItems.first().hover();
    await imageItems.first().locator('[data-role="remove-product-image"]').click();
  }

  await page.getByTestId('edit-product-cover-file').setInputFiles([
    { name: 'one.png', mimeType: 'image/png', buffer: Buffer.from([1, 2, 3]) },
    { name: 'two.png', mimeType: 'image/png', buffer: Buffer.from([4, 5, 6]) },
    { name: 'three.png', mimeType: 'image/png', buffer: Buffer.from([7, 8, 9]) }
  ]);

  await expect(imageItems).toHaveCount(3);
  await expect(page.locator('#product-edit-drawer [data-role="product-image-count"]')).toHaveText('3/9');
  await expect(imageItems.first().getByText('封面')).toBeVisible();

  const originalSources = await imageItems.locator('[data-role="product-image-preview"]').evaluateAll((images) => (
    images.map((image) => (image as HTMLImageElement).src)
  ));
  await imageItems.nth(2).dragTo(imageItems.first());
  await expect(imageItems.first().locator('[data-role="product-image-preview"]')).toHaveAttribute('src', originalSources[2]);
  await imageItems.first().hover();
  await imageItems.first().locator('[data-role="move-image-right"]').click();
  await expect(imageItems.first().locator('[data-role="product-image-preview"]')).toHaveAttribute('src', originalSources[0]);

  await imageItems.last().hover();
  await imageItems.last().locator('[data-role="remove-product-image"]').click();
  await expect(imageItems).toHaveCount(2);
  await page.locator('#product-edit-drawer button[type="submit"]').click();
  await expect(page.locator('#product-edit-drawer')).toHaveCount(0);

  await expect.poll(() => page.evaluate(() => {
    const products = JSON.parse(window.localStorage.getItem('admin-web-mock-products') || '[]');
    return products[0]?.images || [];
  })).toEqual([originalSources[0], originalSources[2]]);
});

test('create product image uploader enforces the nine image limit', async ({ page }) => {
  await loginMockBoss(page);
  await page.goto('/products.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /新建商品/ }).click();

  const files = Array.from({ length: 10 }, (_, index) => ({
    name: `image-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from([index + 1])
  }));
  await page.getByTestId('create-product-image-files').setInputFiles(files);

  const modal = page.locator('#create-product-modal');
  await expect(modal.locator('[data-role="product-image-item"]')).toHaveCount(9);
  await expect(modal.locator('[data-role="product-image-count"]')).toHaveText('9/9');
  await expect(modal.getByText('超过上限的 1 张未上传')).toBeVisible();
  await expect(page.getByTestId('create-product-image-upload')).toHaveCount(0);
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
