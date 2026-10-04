import assert from 'node:assert/strict';
import test from 'node:test';

const keys = ['TMO_ADMIN_REAL_ISOLATED', 'ADMIN_WEB_BASE_URL', 'ADMIN_WEB_PROXY_TARGET', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'VITE_ADMIN_WEB_MODE', 'VITE_ADMIN_WEB_BASE_PATH', 'VITE_ADMIN_WEB_API_BASE_URL', 'VITE_ADMIN_WEB_PAYMENT_API_BASE_URL'];
let revision = 0;

const loadConfig = async (overrides = {}) => {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    TMO_ADMIN_REAL_ISOLATED: '1',
    ADMIN_WEB_PROXY_TARGET: 'http://127.0.0.1:58080',
    ADMIN_WEB_PAYMENT_PROXY_TARGET: 'http://127.0.0.1:58083'
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const url = new URL('../playwright.e2e.real.config.mjs', import.meta.url);
    url.searchParams.set('case', String(++revision));
    return (await import(url.href)).default;
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

test('isolated real config accepts explicit loopback origins', async () => {
  const config = await loadConfig();
  assert.equal(config.webServer.env.ADMIN_WEB_PROXY_TARGET, 'http://127.0.0.1:58080');
  assert.equal(config.webServer.env.ADMIN_WEB_PAYMENT_PROXY_TARGET, 'http://127.0.0.1:58083');
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.match(config.webServer.command, /--strictPort/);
});

test('isolated real config accepts HTTPS localhost and IPv6 origins', async () => {
  const config = await loadConfig({ ADMIN_WEB_PROXY_TARGET: 'https://localhost:58443/', ADMIN_WEB_PAYMENT_PROXY_TARGET: 'https://[::1]:58444' });
  assert.equal(config.webServer.env.ADMIN_WEB_PROXY_TARGET, 'https://localhost:58443');
  assert.equal(config.webServer.env.ADMIN_WEB_PAYMENT_PROXY_TARGET, 'https://[::1]:58444');
});

test('inherited Vite variables cannot change the real test API destinations or mode', async () => {
  const config = await loadConfig({
    VITE_ADMIN_WEB_API_BASE_URL: 'https://non-loopback.invalid/api',
    VITE_ADMIN_WEB_PAYMENT_API_BASE_URL: 'https://non-loopback.invalid/payments',
    VITE_ADMIN_WEB_MODE: 'mock',
    VITE_ADMIN_WEB_BASE_PATH: '/unexpected/'
  });
  assert.equal(config.webServer.env.VITE_ADMIN_WEB_API_BASE_URL, '/api');
  assert.equal(config.webServer.env.VITE_ADMIN_WEB_PAYMENT_API_BASE_URL, '/payment-api');
  assert.equal(config.webServer.env.VITE_ADMIN_WEB_MODE, 'dev');
  assert.equal(config.webServer.env.VITE_ADMIN_WEB_BASE_PATH, '/');
});

for (const [label, field, value] of [
  ['external gateway', 'ADMIN_WEB_PROXY_TARGET', 'https://non-loopback.invalid'],
  ['external payment service', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'https://non-loopback.invalid'],
  ['gateway credentials', 'ADMIN_WEB_PROXY_TARGET', 'http://user:password@127.0.0.1:58080'],
  ['payment credentials', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'http://user:password@localhost:58083'],
  ['gateway path', 'ADMIN_WEB_PROXY_TARGET', 'http://127.0.0.1:58080/api'],
  ['payment path', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'http://127.0.0.1:58083/payments'],
  ['gateway query', 'ADMIN_WEB_PROXY_TARGET', 'http://127.0.0.1:58080?route=other'],
  ['payment fragment', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'http://127.0.0.1:58083#other'],
  ['unsupported scheme', 'ADMIN_WEB_PROXY_TARGET', 'ftp://127.0.0.1:58080'],
  ['invalid URL', 'ADMIN_WEB_PAYMENT_PROXY_TARGET', 'not-a-url']
]) {
  test(`isolated real config rejects ${label}`, async () => {
    await assert.rejects(loadConfig({ [field]: value }), /loopback.*origin/i);
  });
}

test('an existing frontend does not bypass validation of supplied proxy targets', async () => {
  await assert.rejects(loadConfig({ ADMIN_WEB_BASE_URL: 'http://127.0.0.1:5175', ADMIN_WEB_PAYMENT_PROXY_TARGET: 'https://non-loopback.invalid' }), /loopback.*origin/i);
});

test('an explicitly isolated existing loopback frontend needs no auto-started proxy', async () => {
  const config = await loadConfig({ ADMIN_WEB_BASE_URL: 'http://127.0.0.1:5175', ADMIN_WEB_PROXY_TARGET: undefined, ADMIN_WEB_PAYMENT_PROXY_TARGET: undefined });
  assert.equal(config.webServer, undefined);
});
