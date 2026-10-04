import type { APIRequestContext, Page } from '@playwright/test';

type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;

// Keep login credentials and session tokens on the current app origin, including
// export downloads. APIRequestContext otherwise forwards headers on redirects.
export const requestOnAppOrigin = async (page: Page, path: string, options: RequestOptions = {}) => {
  const appUrl = new URL(page.url());
  const requestUrl = new URL(path, appUrl);
  if (requestUrl.origin !== appUrl.origin || requestUrl.username || requestUrl.password) {
    throw new Error(`Refusing to send a session token outside the app origin: ${requestUrl.origin}`);
  }
  return page.request.fetch(requestUrl.href, { ...options, maxRedirects: 0 });
};

// APIRequestContext does not inherit the browser's localStorage authentication.
export const requestAsSignedInUser = async (page: Page, path: string, options: RequestOptions = {}) => {
  const token = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('tmo:admin:web:auth') || '{}');
    return session.accessToken;
  });
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Real API requests require a signed-in admin session');
  }
  return requestOnAppOrigin(page, path, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` }
  });
};
