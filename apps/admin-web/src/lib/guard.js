import { isDevMode, isMockMode } from './env';
import { hasAllowedAdminWebRole } from './admin-role-policy';
import {
  getCurrentSession,
  getDisplayProfile,
  goToLogin,
  logout,
  refreshBootstrap
} from './auth';
import { canAccessPath, normalizePermissionMap } from './permissions';

let isLogoutDelegated = false;
const legacyMockPermissionNoticeKey = 'tmo:admin:web:mock:legacy-permissions-notice';
const unsupportedRoleNoticeKey = 'tmo:admin:web:unsupported-role-notice';

// 绑定全局退出事件（只绑定一次，避免重复监听）。
const bindLogoutActions = () => {
  if (isLogoutDelegated) {
    return;
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const logoutTrigger = target.closest('#logout-btn, #logout-link');
    if (!logoutTrigger) {
      return;
    }

    event.preventDefault();
    logout();
  });

  isLogoutDelegated = true;
};

// 将登录用户展示信息写入侧边栏。
const applyProfile = (profile) => {
  if (!profile) {
    return;
  }

  const nameElements = document.querySelectorAll('#user-name');
  nameElements.forEach((nameElement) => {
    nameElement.textContent = profile.name;
  });

  const roleElements = document.querySelectorAll('#user-role');
  roleElements.forEach((roleElement) => {
    roleElement.textContent = profile.role;
  });
};

// 判断会话是否携带新权限结构。
const hasPermissionItems = (session) => {
  return Array.isArray(session?.permissions?.items);
};

// 提示旧版 mock 会话需要重新登录以启用分级权限。
const notifyLegacyMockSession = () => {
  try {
    if (sessionStorage.getItem(legacyMockPermissionNoticeKey) === '1') {
      return;
    }
    sessionStorage.setItem(legacyMockPermissionNoticeKey, '1');
  } catch {
    // ignore storage read/write errors
  }
  window.alert('检测到旧版 mock 会话，权限分级尚未生效。请重新登录以启用 ADMIN / BOSS / CS 分级权限。');
};

const notifyUnsupportedRoleSession = () => {
  try {
    if (sessionStorage.getItem(unsupportedRoleNoticeKey) === '1') {
      return;
    }
    sessionStorage.setItem(unsupportedRoleNoticeKey, '1');
  } catch {
    // ignore storage read/write errors
  }
  window.alert('该账号角色不受 admin-web 支持（仅支持 ADMIN / BOSS / CS）。');
};

// 页面守卫：校验登录态、刷新 bootstrap、执行路径级权限拦截。
export const ensureProtectedPage = async () => {
  const session = getCurrentSession();
  if (!session) {
    goToLogin();
    return null;
  }

  let bootstrapPayload = null;
  if (isDevMode) {
    try {
      bootstrapPayload = await refreshBootstrap();
    } catch {
      logout();
      return null;
    }
  }

  if (isMockMode && !session) {
    goToLogin();
    return null;
  }

  bindLogoutActions();

  const latestSession = getCurrentSession() || session;
  if (!hasAllowedAdminWebRole(latestSession)) {
    notifyUnsupportedRoleSession();
    logout();
    return null;
  }
  applyProfile(getDisplayProfile());

  const permissionMap = normalizePermissionMap(latestSession?.permissions);
  if (isDevMode && !canAccessPath(window.location.pathname, permissionMap)) {
    window.location.href = '/dashboard.html';
    return null;
  }
  if (isMockMode) {
    if (hasPermissionItems(latestSession)) {
      if (!canAccessPath(window.location.pathname, permissionMap)) {
        window.location.href = '/dashboard.html';
        return null;
      }
    } else {
      notifyLegacyMockSession();
    }
  }

  return {
    mode: isDevMode ? 'dev' : 'mock',
    session: latestSession,
    bootstrap: bootstrapPayload
  };
};
