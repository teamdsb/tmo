import { bootstrap, debugSwitchRole, passwordLogin } from './api';
import { filterAllowedAdminWebRoles, isAllowedAdminWebRole, normalizeRole } from './admin-role-policy';
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
  cs: '客服',
  manager: '经理'
};

// 统一提取展示名，避免空值导致 UI 显示异常。
const toDisplayName = (user) => {
  if (!user || typeof user !== 'object') {
    return '管理员用户';
  }
  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }
  return '管理员用户';
};

// 将角色 code 映射为中文展示名。
export const getRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase();
  return roleLabels[normalized] || role || '管理员';
};

const normalizeSessionUserRoles = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }
  const allowedRoles = filterAllowedAdminWebRoles(user.roles);
  return {
    ...user,
    roles: allowedRoles
  };
};

// 跳转登录页。
export const goToLogin = () => {
  window.location.href = routes.login;
};

// 跳转后台首页。
export const goToDashboard = () => {
  window.location.href = routes.dashboard;
};

// 退出登录并清理所有会话状态。
export const logout = () => {
  clearAllSessions();
  goToLogin();
};

// 清理本地保存的登录状态，但不触发跳转。
export const clearSavedSession = () => {
  clearAllSessions();
};

// 兼容旧 mock 登录入口，构造最小会话结构。
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

// 使用共享 mock 账号结构构造完整 mock 会话。
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

// mock 登录：兼容旧参数与新账号对象两种输入。
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

// 从显式选择或用户角色列表中推断当前角色。
const inferCurrentRole = (user, explicitRole) => {
  const reportedCurrentRole = normalizeRole(user?.currentRole);
  if (isAllowedAdminWebRole(reportedCurrentRole)) {
    return reportedCurrentRole;
  }
  if (explicitRole) {
    const normalizedExplicit = normalizeRole(explicitRole);
    return isAllowedAdminWebRole(normalizedExplicit) ? normalizedExplicit : '';
  }
  const roles = filterAllowedAdminWebRoles(user?.roles);
  if (roles.length === 0) {
    return '';
  }
  if (roles.length === 1) {
    return roles[0];
  }
  const priority = ['BOSS', 'ADMIN', 'MANAGER', 'CS'];
  for (const role of priority) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return '';
};

// real(dev) 登录并写入 token + 当前角色。
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
  if (!currentRole) {
    throw new Error('该账号角色不受 admin-web 支持（仅支持 ADMIN / BOSS / CS / MANAGER）。');
  }
  saveAuthState({
    mode: 'dev',
    accessToken: response.data.accessToken,
    user: normalizeSessionUserRoles(response.data.user),
    currentRole,
    permissions: null,
    featureFlags: null,
    loginAt: new Date().toISOString()
  });

  return response;
};

// 刷新 bootstrap，更新 me/permissions/featureFlags。
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
    user: normalizeSessionUserRoles(response.data.me || previous.user || null),
    currentRole: normalizeRole(response.data?.me?.currentRole) || previous.currentRole || '',
    permissions: response.data.permissions || null,
    featureFlags: response.data.featureFlags || null,
    lastBootstrapAt: new Date().toISOString()
  });

  return response.data;
};

// 按当前模式读取会话（mock 或 dev）。
export const getCurrentSession = () => {
  if (isMockMode) {
    return readMockSession();
  }
  if (isDevMode) {
    return readAuthState();
  }
  return null;
};

// 判断是否已登录（模式感知）。
export const isLoggedIn = () => {
  if (isMockMode) {
    return Boolean(readMockSession());
  }
  return Boolean(getAccessToken());
};

// 供登录页展示当前缓存会话的基础信息。
export const getStoredSessionSummary = () => {
  const session = getCurrentSession();
  if (!session) {
    return null;
  }

  const displayProfile = getDisplayProfile();
  const username = typeof session?.username === 'string' && session.username.trim()
    ? session.username.trim()
    : '';

  return {
    mode: session?.mode || (isDevMode ? 'dev' : 'mock'),
    role: displayProfile?.role || '管理员',
    username: username || displayProfile?.name || '管理员用户'
  };
};

// 构造顶部栏需要的展示资料（昵称 + 角色名）。
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
  const allowedRoles = filterAllowedAdminWebRoles(roles);
  const normalizedCurrentRole = normalizeRole(state?.currentRole);
  const primaryRole = isAllowedAdminWebRole(normalizedCurrentRole)
    ? normalizedCurrentRole
    : (allowedRoles[0] || 'ADMIN');

  return {
    name: toDisplayName(state.user),
    role: getRoleLabel(primaryRole)
  };
};

export const switchDevRole = async (role) => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    throw new Error('invalid role');
  }

  const response = await debugSwitchRole(normalizedRole);
  if (response.status !== 200) {
    if (response.status === 404) {
      throw new Error('当前环境未启用调试切角色。');
    }
    if (response.status === 403) {
      throw new Error('该身份未分配所选角色。');
    }
    throw new Error(response?.data?.message || 'switch role failed');
  }

  const currentRole = inferCurrentRole(response.data.user, normalizedRole);
  if (!currentRole) {
    throw new Error('该账号角色不受 admin-web 支持（仅支持 ADMIN / BOSS / CS / MANAGER）。');
  }

  const previous = readAuthState() || {};
  saveAuthState({
    ...previous,
    mode: 'dev',
    accessToken: response.data.accessToken,
    user: normalizeSessionUserRoles(response.data.user),
    currentRole,
    permissions: previous.permissions || null,
    featureFlags: previous.featureFlags || null,
    lastRoleSwitchAt: new Date().toISOString()
  });

  await refreshBootstrap();
  return readAuthState();
};
