import { goToDashboard, isLoggedIn, loginDev, loginMock, refreshBootstrap } from './lib/auth';
import { isDevMode, isMockMode } from './lib/env';

const form = document.querySelector('#login-form');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const roleSelect = document.querySelector('#role');
const togglePasswordButton = document.querySelector('#toggle-password');
const togglePasswordIcon = document.querySelector('#toggle-password-icon');

const setFormPending = (pending) => {
  if (!form) {
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  const controls = form.querySelectorAll('input, select, button');
  controls.forEach((control) => {
    control.disabled = pending;
  });
  if (submitButton) {
    submitButton.textContent = pending ? 'Signing In...' : 'Sign In';
  }
};

const initSessionRedirect = async () => {
  if (!isLoggedIn()) {
    return;
  }

  if (isDevMode) {
    try {
      await refreshBootstrap();
      goToDashboard();
      return;
    } catch {
      // token invalid, remain on login
      return;
    }
  }

  if (isMockMode) {
    goToDashboard();
  }
};

if (togglePasswordButton && passwordInput && togglePasswordIcon) {
  togglePasswordButton.addEventListener('click', () => {
    const nextType = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = nextType;
    togglePasswordIcon.textContent = nextType === 'password' ? 'visibility_off' : 'visibility';
  });
}

if (form && usernameInput && passwordInput && roleSelect) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = String(usernameInput.value || '').trim();
    const password = String(passwordInput.value || '');
    const role = String(roleSelect.value || '').trim();

    if (!username || !password) {
      window.alert('Please enter username and password.');
      return;
    }

    try {
      setFormPending(true);

      if (isMockMode) {
        loginMock(username, role || 'admin');
        goToDashboard();
        return;
      }

      if (role && role.toLowerCase() !== 'admin') {
        window.alert('Dev mode currently supports Administrator login only.');
        return;
      }

      await loginDev(username, password);
      await refreshBootstrap();
      goToDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Please retry.';
      window.alert(message);
    } finally {
      setFormPending(false);
    }
  });
}

void initSessionRedirect();
