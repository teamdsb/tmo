import { bootstrap, passwordLogin } from './api';
import { isDevMode, isMockMode, routes } from './env';
import {
  clearAllSessions,
  clearAuthState,
  getAccessToken,
  readAuthState,
  readMockSession,
  saveAuthState,
  saveMockSession
} from './state';

const roleLabels = {
  admin: 'Administrator',
  sales: 'Sales Manager',
  support: 'Customer Service',
  logistics: 'Logistics Coordinator'
};

const toDisplayName = (user) => {
  if (!user || typeof user !== 'object') {
    return 'Admin User';
  }
  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }
  return 'Admin User';
};

export const getRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase();
  return roleLabels[normalized] || role || 'Admin';
};

export const goToLogin = () => {
  window.location.href = routes.login;
};

export const goToDashboard = () => {
  window.location.href = routes.dashboard;
};

export const logout = () => {
  clearAllSessions();
  goToLogin();
};

export const loginMock = (username, role) => {
  saveMockSession({
    mode: 'mock',
    username,
    role,
    loginAt: new Date().toISOString()
  });
};

export const loginDev = async (username, password) => {
  const response = await passwordLogin(username, password);
  if (response.status !== 200) {
    const message = response?.data?.message || 'Login failed';
    throw new Error(message);
  }

  saveAuthState({
    mode: 'dev',
    accessToken: response.data.accessToken,
    user: response.data.user,
    permissions: null,
    featureFlags: null,
    loginAt: new Date().toISOString()
  });

  return response.data;
};

export const refreshBootstrap = async () => {
  if (!isDevMode) {
    return null;
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('missing token');
  }

  const response = await bootstrap();
  if (response.status !== 200) {
    if (response.status === 401) {
      clearAuthState();
      throw new Error('unauthorized');
    }
    const message = response?.data?.message || 'bootstrap failed';
    throw new Error(message);
  }

  const previous = readAuthState() || {};
  saveAuthState({
    ...previous,
    mode: 'dev',
    user: response.data.me || previous.user || null,
    permissions: response.data.permissions || null,
    featureFlags: response.data.featureFlags || null,
    lastBootstrapAt: new Date().toISOString()
  });

  return response.data;
};

export const getCurrentSession = () => {
  if (isMockMode) {
    return readMockSession();
  }
  if (isDevMode) {
    return readAuthState();
  }
  return null;
};

export const isLoggedIn = () => {
  if (isMockMode) {
    return Boolean(readMockSession());
  }
  return Boolean(getAccessToken());
};

export const getDisplayProfile = () => {
  if (isMockMode) {
    const session = readMockSession();
    if (!session) {
      return null;
    }
    return {
      name: typeof session.username === 'string' && session.username.trim() ? session.username.trim() : 'Admin User',
      role: getRoleLabel(session.role || 'admin')
    };
  }

  const state = readAuthState();
  if (!state) {
    return null;
  }

  const roles = Array.isArray(state?.user?.roles) ? state.user.roles : [];
  const primaryRole = roles[0] || 'ADMIN';

  return {
    name: toDisplayName(state.user),
    role: getRoleLabel(primaryRole)
  };
};
