import { defineConfig } from '@playwright/test';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export const createOfflineConfig = ({ mode, port, testMatch, basePath = '/', grep }) => {
  const baseURL = process.env.ADMIN_WEB_BASE_URL || `http://127.0.0.1:${port}${basePath}`;
  const target = new URL(baseURL);
  if (!loopbackHosts.has(target.hostname) || target.protocol !== 'http:') {
    throw new Error('Offline E2E requires a loopback HTTP frontend; use the isolated real suite for real services.');
  }
  if (target.pathname !== basePath || target.search || target.hash || target.username || target.password) {
    throw new Error(`Offline frontend URL must retain the configured base path ${basePath}`);
  }
  const name = basePath === '/' ? mode : 'prefix';
  return defineConfig({
    testDir: './tests/e2e', testMatch, grep,
    timeout: 60000,
    expect: { timeout: 15000 },
    forbidOnly: Boolean(process.env.CI),
    fullyParallel: false,
    workers: process.env.CI ? 2 : 4,
    outputDir: `./test-results/${name}`,
    use: {
      baseURL, headless: true, serviceWorkers: 'block', locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
      trace: 'retain-on-failure', screenshot: 'only-on-failure',
      viewport: { width: 1600, height: 1000 },
      launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] }
    },
    webServer: process.env.ADMIN_WEB_BASE_URL ? undefined : {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,
      env: {
        VITE_ADMIN_WEB_MODE: mode === 'mock' ? 'mock' : 'dev',
        VITE_ADMIN_WEB_API_BASE_URL: mode === 'mock' ? '' : '/api',
        VITE_ADMIN_WEB_PAYMENT_API_BASE_URL: mode === 'mock' ? '' : '/payment-api',
        VITE_ADMIN_WEB_BASE_PATH: basePath,
        ADMIN_WEB_PROXY_TARGET: 'http://127.0.0.1:9',
        ADMIN_WEB_PAYMENT_PROXY_TARGET: 'http://127.0.0.1:9'
      },
      url: baseURL, reuseExistingServer: false, timeout: 60000
    }
  });
};
