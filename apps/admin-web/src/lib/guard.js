import { isDevMode, isMockMode } from './env';
import {
  getCurrentSession,
  getDisplayProfile,
  goToLogin,
  logout,
  refreshBootstrap
} from './auth';

const bindLogoutActions = () => {
  const selectors = ['#logout-btn', '#logout-link'];
  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => element.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    }));
  });
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
