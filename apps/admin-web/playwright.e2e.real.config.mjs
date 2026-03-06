import { defineConfig } from '@playwright/test';

const baseURL = process.env.ADMIN_WEB_BASE_URL || 'http://127.0.0.1:5175';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*(?:\.real|-real)\.spec\.ts/,
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
        command: 'VITE_ADMIN_WEB_MODE=dev VITE_ADMIN_WEB_API_BASE_URL=/api vite --host 127.0.0.1 --port 5175',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180000
      }
});
