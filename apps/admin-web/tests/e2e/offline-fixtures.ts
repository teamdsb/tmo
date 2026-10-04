import { expect, test as base } from '@playwright/test';

const businessPath = /^\/(?:api|payment-api|auth|bff|admin|catalog|orders|staff|customers|support|inquiries|after-sales|product-requests|shipments|rbac|me|cart|wishlist|addresses|tracking)(?:\/|$)/;
const fixtureImageHosts = new Set(['cdn.example.com', 'images.unsplash.com', 'lh3.googleusercontent.com']);
const fixtureImage = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e2e8f0"/><path d="M135 115h130v70H135z" fill="#94a3b8"/><path d="M160 90h80v120h-80z" fill="#64748b"/></svg>';

export const test = base.extend<{ offlineNetwork: void }>({
  offlineNetwork: [async ({ context, baseURL }, use) => {
    const frontend = new URL(baseURL!);
    const unexpected = new Set<string>();
    const errors = new Set<string>();
    context.on('page', page => page.on('pageerror', error => errors.add(error.message)));
    await context.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      const sameOrigin = url.host === frontend.host && (url.protocol === 'ws:' || url.protocol === 'wss:');
      if (sameOrigin && url.pathname.endsWith('/ws/support')) return socket.close();
      if (sameOrigin && url.pathname === frontend.pathname) return void socket.connectToServer();
      unexpected.add(`unstubbed WebSocket ${url.origin}${url.pathname}`);
      return socket.close();
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['http:', 'https:'].includes(url.protocol)) return route.continue();
      if (url.origin !== frontend.origin) {
        // Explicit product/avatar fixtures are rendered locally, never fetched from those hosts.
        if (request.resourceType() === 'image' && fixtureImageHosts.has(url.hostname)) {
          return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fixtureImage });
        }
        unexpected.add(`external ${request.method()} ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      const prefix = frontend.pathname.replace(/\/$/, '');
      const pathname = prefix && url.pathname.startsWith(`${prefix}/`) ? url.pathname.slice(prefix.length) : url.pathname;
      if (businessPath.test(pathname) || ['fetch', 'xhr'].includes(request.resourceType())) {
        unexpected.add(`unstubbed ${request.method()} ${pathname}`);
        return route.fulfill({ status: 501, json: { code: 'offline_unstubbed_request', message: `Missing offline fixture: ${request.method()} ${pathname}` } });
      }
      return route.continue();
    });
    await use();
    expect([...unexpected], 'Offline tests must stub every business request and use local runtime assets').toEqual([]);
    expect([...errors], 'The page must not throw uncaught runtime errors').toEqual([]);
  }, { auto: true }]
});

export { expect };
export type { Page, TestInfo, Response } from '@playwright/test';
