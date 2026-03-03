import { defineConfig } from '@playwright/test';

const baseURL = process.env.ADMIN_WEB_BASE_URL || 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 120000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL,
    headless: true
  },
  webServer: process.env.ADMIN_WEB_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev:mock',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180000
      }
});
