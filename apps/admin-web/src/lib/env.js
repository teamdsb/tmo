const rawMode = String(import.meta.env.VITE_ADMIN_WEB_MODE || 'mock').toLowerCase().trim();

// 运行模式：仅支持 dev / mock 两种。
export const appMode = rawMode === 'dev' ? 'dev' : 'mock';
export const isDevMode = appMode === 'dev';
export const isMockMode = !isDevMode;

const rawBasePath = String(import.meta.env.VITE_ADMIN_WEB_BASE_PATH || '/').trim();
const normalizedBasePath = rawBasePath === '/'
  ? '/'
  : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;

export const adminBasePath = normalizedBasePath;

export const buildAppHref = (path = '/') => {
  const normalizedPath = `/${String(path || '/').replace(/^\/+/, '')}`;
  if (adminBasePath === '/') {
    return normalizedPath;
  }
  const baseWithoutTrailingSlash = adminBasePath.replace(/\/$/, '');
  return normalizedPath === '/'
    ? adminBasePath
    : `${baseWithoutTrailingSlash}${normalizedPath}`;
};

export const normalizeAppPath = (pathname = '/') => {
  const normalizedPathname = `/${String(pathname || '/').replace(/^\/+/, '')}`;
  if (adminBasePath === '/') {
    return normalizedPathname;
  }
  const baseWithoutTrailingSlash = adminBasePath.replace(/\/$/, '');
  if (normalizedPathname === baseWithoutTrailingSlash || normalizedPathname === adminBasePath) {
    return '/';
  }
  if (normalizedPathname.startsWith(`${baseWithoutTrailingSlash}/`)) {
    return normalizedPathname.slice(baseWithoutTrailingSlash.length) || '/';
  }
  return normalizedPathname;
};

// API 基础路径：dev 默认走 /api，mock 默认同源。
const rawBaseUrl = String(import.meta.env.VITE_ADMIN_WEB_API_BASE_URL || (isDevMode ? '/api' : '')).trim();
export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

// Payment API 基础路径：dev 默认独立走 /payment-api，未显式配置时不复用 commerce/general API。
const rawPaymentBaseUrl = String(import.meta.env.VITE_ADMIN_WEB_PAYMENT_API_BASE_URL || (isDevMode ? '/payment-api' : '')).trim();
export const paymentApiBaseUrl = rawPaymentBaseUrl.replace(/\/+$/, '');

export const routes = {
  login: buildAppHref('/'),
  dashboard: buildAppHref('/dashboard.html')
};

export const storageKeys = {
  mockSession: 'tmo:admin:web:session',
  authState: 'tmo:admin:web:auth'
};

export const modeLabel = isDevMode ? 'dev' : 'mock';
