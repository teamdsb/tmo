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
  procurement: '采购',
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

const buildLegacyMockSession = (username, role) => {
  const normalizedRole = String(role || 'ADMIN').trim().toUpperCase() || 'ADMIN';
  return {
    mode: 'mock',
    username: String(username || '').trim(),
    role: normalizedRole.toLowerCase(),
    currentRole: normalizedRole,
    user: {
      id: '',
      displayName: String(username || '').trim(),
      userType: normalizedRole === 'BOSS' || normalizedRole === 'ADMIN' ? 'admin' : 'staff',
      roles: [normalizedRole],
      createdAt: new Date().toISOString()
    },
    permissions: null,
    featureFlags: null
  };
};

const buildMockSessionFromAccount = (account) => {
  const normalizedRole = String(account.role || '').trim().toUpperCase();
  const normalizedUsername = String(account.username || '').trim();
  const normalizedDisplayName = String(account.displayName || '').trim();
  const userType = String(account.userType || (normalizedRole === 'BOSS' || normalizedRole === 'ADMIN' ? 'admin' : 'staff')).trim();
  const permissionItems = Array.isArray(account?.permissions?.items)
    ? account.permissions.items.map((item) => ({
      code: String(item?.code || '').trim(),
      scope: String(item?.scope || 'SELF').trim().toUpperCase()
    })).filter((item) => Boolean(item.code))
    : [];

  return {
    mode: 'mock',
    username: normalizedUsername,
    role: normalizedRole.toLowerCase(),
    currentRole: normalizedRole,
    user: {
      id: String(account.userId || normalizedUsername || normalizedRole).trim(),
      displayName: normalizedDisplayName || normalizedUsername || '管理员用户',
      userType: userType || 'admin',
      roles: [normalizedRole],
      createdAt: '2026-01-01T00:00:00Z'
    },
    permissions: {
      items: permissionItems
    },
    featureFlags: null
  };
};

export const loginMock = (input, role) => {
  let sessionPayload = null;
  if (input && typeof input === 'object' && typeof input.username === 'string' && typeof input.role === 'string') {
    sessionPayload = buildMockSessionFromAccount(input);
  } else {
    sessionPayload = buildLegacyMockSession(input, role);
  }

  saveMockSession({
    ...sessionPayload,
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
  const priority = ['BOSS', 'MANAGER', 'ADMIN', 'SALES', 'PROCUREMENT', 'CS', 'CUSTOMER'];
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
    const name = (
      (typeof session?.user?.displayName === 'string' && session.user.displayName.trim()) ||
      (typeof session.username === 'string' && session.username.trim()) ||
      '管理员用户'
    );
    const role = session?.currentRole || session?.role || 'admin';
    return {
      name,
      role: getRoleLabel(role)
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
