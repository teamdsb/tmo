import { defineConfig } from '@playwright/test';

const baseURL = process.env.ADMIN_WEB_BASE_URL || 'http://127.0.0.1:5175';
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const loopbackUrl = (value, name, originOnly = false) => {
  const message = `${name} must be an HTTP(S) loopback origin without credentials, query or fragment${originOnly ? ', and without a path' : ''}.`;
  let target;
  try {
    target = new URL(value);
  } catch {
    throw new Error(message);
  }
  if (!['http:', 'https:'].includes(target.protocol) || !loopbackHosts.has(target.hostname)
      || target.username || target.password || target.search || target.hash
      || (originOnly && target.pathname !== '/')) {
    throw new Error(message);
  }
  return target;
};

if (process.env.TMO_ADMIN_REAL_ISOLATED !== '1') {
  throw new Error('Real E2E requires TMO_ADMIN_REAL_ISOLATED=1 and a loopback frontend backed by disposable test databases.');
}
loopbackUrl(baseURL, 'ADMIN_WEB_BASE_URL');
const proxyTarget = process.env.ADMIN_WEB_PROXY_TARGET
  ? loopbackUrl(process.env.ADMIN_WEB_PROXY_TARGET, 'ADMIN_WEB_PROXY_TARGET', true).origin : undefined;
const paymentProxyTarget = process.env.ADMIN_WEB_PAYMENT_PROXY_TARGET
  ? loopbackUrl(process.env.ADMIN_WEB_PAYMENT_PROXY_TARGET, 'ADMIN_WEB_PAYMENT_PROXY_TARGET', true).origin : undefined;
if (!process.env.ADMIN_WEB_BASE_URL && (!proxyTarget || !paymentProxyTarget)) {
  throw new Error('Set explicit ADMIN_WEB_PROXY_TARGET and ADMIN_WEB_PAYMENT_PROXY_TARGET for the isolated services, or ADMIN_WEB_BASE_URL for an existing isolated frontend.');
}

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
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort',
        env: {
          VITE_ADMIN_WEB_MODE: 'dev',
          VITE_ADMIN_WEB_BASE_PATH: '/',
          VITE_ADMIN_WEB_API_BASE_URL: '/api',
          VITE_ADMIN_WEB_PAYMENT_API_BASE_URL: '/payment-api',
          ADMIN_WEB_PROXY_TARGET: proxyTarget,
          ADMIN_WEB_PAYMENT_PROXY_TARGET: paymentProxyTarget
        },
        url: baseURL,
        reuseExistingServer: false,
        timeout: 180000
      }
});
