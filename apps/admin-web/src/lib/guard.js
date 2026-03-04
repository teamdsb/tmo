import { isDevMode, isMockMode } from './env';
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

const hasPermissionItems = (session) => {
  return Array.isArray(session?.permissions?.items);
};

const notifyLegacyMockSession = () => {
  try {
    if (sessionStorage.getItem(legacyMockPermissionNoticeKey) === '1') {
      return;
    }
    sessionStorage.setItem(legacyMockPermissionNoticeKey, '1');
  } catch {
    // ignore storage read/write errors
  }
  window.alert('检测到旧版 mock 会话，权限分级尚未生效。请重新登录以启用老板/管理/业务员分级权限。');
};

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
  applyProfile(getDisplayProfile());

  const latestSession = getCurrentSession() || session;
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
