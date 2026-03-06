import { defineConfig } from '@playwright/test';

const baseURL = process.env.ADMIN_WEB_BASE_URL || 'http://127.0.0.1:5174';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.mock\.spec\.ts/,
  timeout: 180000,
  expect: {
    timeout: 15000
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1600, height: 1000 }
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
