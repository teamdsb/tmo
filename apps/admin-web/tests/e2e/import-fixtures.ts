import { writeFile } from 'node:fs/promises';

import type { Page, TestInfo } from '@playwright/test';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

const PRODUCT_IMPORT_HEADERS = [
  'Group Key',
  'SKU Code',
  'Product Name',
  'SKU Name',
  'Category ID',
  'Description',
  'Cover Image',
  'Images',
  'Tags',
  'Filter Dimensions',
  'Spec',
  'Attributes',
  'Unit',
  'Is Active',
  'Price Tiers (Fen)'
];

export const loginAsBoss = async (page: Page) => {
  await page.goto('/');
  await page.fill('#username', 'boss');
  await page.fill('#password', 'boss123');
  await Promise.all([
    page.waitForURL('**/dashboard.html'),
    page.locator('#login-form button[type="submit"]').click()
  ]);
  await page.waitForURL(/dashboard\.html/);
};

export const loginAsManager = async (page: Page) => {
  await page.goto('/');
  await page.fill('#username', 'manager');
  await page.fill('#password', 'manager123');
  await Promise.all([
    page.waitForURL('**/dashboard.html'),
    page.locator('#login-form button[type="submit"]').click()
  ]);
  await page.waitForURL(/dashboard\.html/);
};

export const createImportFixture = async (
  testInfo: TestInfo,
  options: {
    productName: string;
    skuPrefix: string;
    categoryId: string;
    withZip: boolean;
  }
) => {
  const excelPath = testInfo.outputPath(`${options.skuPrefix}.xlsx`);
  const zipPath = testInfo.outputPath(`${options.skuPrefix}.zip`);

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    PRODUCT_IMPORT_HEADERS,
    [
      `${options.skuPrefix}-group`,
      `${options.skuPrefix}-A`,
      options.productName,
      `${options.productName} A`,
      options.categoryId,
      'fixture row',
      'main.png',
      'main.png|detail.png',
      'smoke|fixture',
      'material|size',
      'M6',
      'material:steel|size:M6',
      'pcs',
      'true',
      '1-9:1200|10-:1000'
    ]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Import');
  XLSX.writeFile(workbook, excelPath);

  if (options.withZip) {
    const zip = new JSZip();
    zip.file('main.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    zip.file('detail.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));
  }

  return {
    excelPath,
    zipPath: options.withZip ? zipPath : null
  };
};
