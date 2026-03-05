import { goToDashboard, isLoggedIn, loginDev, loginMock, refreshBootstrap } from './lib/auth';
import { filterAllowedAdminWebRoles } from './lib/admin-role-policy';
import { isDevMode, isMockMode } from './lib/env';
import { installZhLocalization } from './lib/i18n-zh';
import { resolveMockAccount } from './lib/mock-accounts';

const form = document.querySelector('#login-form');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const togglePasswordButton = document.querySelector('#toggle-password');
const togglePasswordIcon = document.querySelector('#toggle-password-icon');
const loginError = document.querySelector('#login-error');
const roleSelectModal = document.querySelector('#role-select-modal');
const roleSelectOptions = document.querySelector('#role-select-options');
const roleSelectCancel = document.querySelector('#role-select-cancel');

const ROLE_LABELS = {
  BOSS: '老板',
  ADMIN: '管理员',
  CS: '客服'
};

// 归一化角色列表（去空、转大写、去重）。
const normalizeRoles = (input) => {
  return filterAllowedAdminWebRoles(input);
};

// 登录失败提示（优先页面内提示，兜底 alert）。
const showError = (message) => {
  if (!loginError) {
    window.alert(message);
    return;
  }
  loginError.textContent = message;
  loginError.classList.remove('hidden');
};

// 清空错误提示。
const clearError = () => {
  if (!loginError) return;
  loginError.textContent = '';
  loginError.classList.add('hidden');
};

// 多角色冲突时展示角色选择弹窗。
const showRoleModal = (roles) => {
  const normalized = normalizeRoles(roles);
  if (!roleSelectModal || !roleSelectOptions || normalized.length === 0) {
    return Promise.resolve(null);
  }
  roleSelectOptions.innerHTML = normalized
    .map(
      (role) => `
      <button type="button" data-role="${role}" class="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-primary hover:bg-blue-50 hover:text-primary">
        ${ROLE_LABELS[role] || role}
      </button>
    `
    )
    .join('');

  roleSelectModal.classList.remove('hidden');
  roleSelectModal.classList.add('flex');

  return new Promise((resolve) => {
    const cleanup = () => {
      roleSelectModal.classList.add('hidden');
      roleSelectModal.classList.remove('flex');
      roleSelectOptions.innerHTML = '';
      roleSelectOptions.removeEventListener('click', onClickOption);
      roleSelectCancel?.removeEventListener('click', onCancel);
    };

    const onClickOption = (event) => {
      const target = event.target.closest('button[data-role]');
      if (!target) return;
      const role = String(target.getAttribute('data-role') || '').toUpperCase();
      cleanup();
      resolve(role || null);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    roleSelectOptions.addEventListener('click', onClickOption);
    roleSelectCancel?.addEventListener('click', onCancel);
  });
};

// 控制登录表单 pending 态，避免重复提交。
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
    submitButton.textContent = pending ? '登录中...' : '登录';
  }
};

// 已登录场景直接跳转并尝试刷新 bootstrap。
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

if (form && usernameInput && passwordInput) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = String(usernameInput.value || '').trim();
    const password = String(passwordInput.value || '');
    clearError();

    if (!username || !password) {
      showError('请输入用户名和密码。');
      return;
    }

    try {
      setFormPending(true);

      if (isMockMode) {
        const mockAccount = resolveMockAccount(username, password);
        if (!mockAccount) {
          throw new Error('invalid credentials');
        }
        loginMock(mockAccount);
        goToDashboard();
        return;
      }

      const firstAttempt = await loginDev(username, password);
      if (firstAttempt?.status === 409) {
        const availableRoles = normalizeRoles(firstAttempt?.data?.details?.availableRoles);
        if (availableRoles.length === 0) {
          showError('该账号角色不受 admin-web 支持（仅支持 ADMIN / BOSS / CS）。');
          return;
        }
        const selectedRole = await showRoleModal(availableRoles);
        if (!selectedRole) {
          showError('已取消角色选择。');
          return;
        }
        const secondAttempt = await loginDev(username, password, selectedRole);
        if (secondAttempt?.status !== 200) {
          throw new Error(secondAttempt?.data?.message || 'Login failed. Please retry.');
        }
      }

      await refreshBootstrap();
      goToDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败，请稍后重试。';
      showError(message === 'invalid credentials' ? '账号或密码错误。' : message);
    } finally {
      setFormPending(false);
    }
  });
}

void initSessionRedirect();
installZhLocalization();
