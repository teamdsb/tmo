import { isDevMode, isMockMode } from './env';
import {
  getCurrentSession,
  getDisplayProfile,
  goToLogin,
  logout,
  refreshBootstrap
} from './auth';

let isLogoutDelegated = false;

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

  return {
    mode: isDevMode ? 'dev' : 'mock',
    session,
    bootstrap: bootstrapPayload
  };
};
