const rawMode = String(import.meta.env.VITE_ADMIN_WEB_MODE || 'mock').toLowerCase().trim();

export const appMode = rawMode === 'dev' ? 'dev' : 'mock';
export const isDevMode = appMode === 'dev';
export const isMockMode = !isDevMode;

const rawBaseUrl = String(import.meta.env.VITE_ADMIN_WEB_API_BASE_URL || (isDevMode ? '/api' : '')).trim();
export const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');

export const routes = {
  login: '/',
  dashboard: '/dashboard.html'
};

export const storageKeys = {
  mockSession: 'tmo:admin:web:session',
  authState: 'tmo:admin:web:auth'
};

export const modeLabel = isDevMode ? 'dev' : 'mock';
