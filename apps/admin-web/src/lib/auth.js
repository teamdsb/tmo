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
  admin: '管理员',
  boss: '老板',
  manager: '管理员',
  sales: '业务员',
  support: '客服专员',
  logistics: '物流协调员',
  cs: '客服',
  customer: '客户'
};

const toDisplayName = (user) => {
  if (!user || typeof user !== 'object') {
    return '管理员用户';
  }
  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }
  return '管理员用户';
};

export const getRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase();
  return roleLabels[normalized] || role || '管理员';
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

const inferCurrentRole = (user, explicitRole) => {
  if (explicitRole) {
    return String(explicitRole).toUpperCase();
  }
  const roles = Array.isArray(user?.roles) ? user.roles.map((role) => String(role).toUpperCase()) : [];
  if (roles.length === 1) {
    return roles[0];
  }
  const priority = ['BOSS', 'MANAGER', 'ADMIN', 'CS', 'SALES', 'CUSTOMER'];
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return roles[0] || 'ADMIN';
};

export const loginDev = async (username, password, role) => {
  const response = await passwordLogin(username, password, role);
  if (response.status === 409) {
    return response;
  }
  if (response.status !== 200) {
    const message = response?.data?.message || 'Login failed';
    throw new Error(message);
  }

  const currentRole = inferCurrentRole(response.data.user, role);
  saveAuthState({
    mode: 'dev',
    accessToken: response.data.accessToken,
    user: response.data.user,
    currentRole,
    permissions: null,
    featureFlags: null,
    loginAt: new Date().toISOString()
  });

  return response;
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
      name: typeof session.username === 'string' && session.username.trim() ? session.username.trim() : '管理员用户',
      role: getRoleLabel(session.role || 'admin')
    };
  }

  const state = readAuthState();
  if (!state) {
    return null;
  }

  const roles = Array.isArray(state?.user?.roles) ? state.user.roles : [];
  const primaryRole = state?.currentRole || roles[0] || 'ADMIN';

  return {
    name: toDisplayName(state.user),
    role: getRoleLabel(primaryRole)
  };
};
