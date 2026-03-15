import { useEffect, useState, type FormEvent } from 'react';

import { filterAllowedAdminWebRoles } from '../../lib/admin-role-policy';
import {
  clearSavedSession,
  getStoredSessionSummary,
  goToDashboard,
  loginDev,
  loginMock,
  refreshBootstrap
} from '../../lib/auth';
import { isDevMode, isMockMode } from '../../lib/env';
import { installZhLocalization } from '../../lib/i18n-zh';
import { resolveMockAccount } from '../../lib/mock-accounts';

const ROLE_LABELS: Record<string, string> = {
  BOSS: '老板',
  ADMIN: '管理员',
  CS: '客服',
  MANAGER: '经理'
};

type PendingRoleSelection = {
  password: string;
  username: string;
};

type StoredSessionSummary = {
  mode: string;
  role: string;
  username: string;
};

const normalizeRoles = (input: unknown): string[] => {
  return filterAllowedAdminWebRoles(input);
};

const normalizeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '登录失败，请稍后重试。';
  if (message === 'invalid credentials') {
    return '账号或密码错误。';
  }
  return message;
};

// 登录页壳组件与登录逻辑。保留现有 DOM id，兼容现有 Playwright 选择器。
export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roleChoices, setRoleChoices] = useState<string[]>([]);
  const [pendingRoleSelection, setPendingRoleSelection] = useState<PendingRoleSelection | null>(null);
  const [storedSession, setStoredSession] = useState<StoredSessionSummary | null>(() => getStoredSessionSummary());

  useEffect(() => {
    installZhLocalization();
  }, []);

  const closeRoleModal = () => {
    setRoleChoices([]);
    setPendingRoleSelection(null);
  };

  const handleDiscardStoredSession = () => {
    clearSavedSession();
    setStoredSession(null);
    setErrorMessage('');
    closeRoleModal();
  };

  const handleResumeStoredSession = async () => {
    if (!storedSession) {
      return;
    }

    setPending(true);
    setErrorMessage('');

    try {
      if (isDevMode) {
        await refreshBootstrap();
      }
      goToDashboard();
    } catch {
      clearSavedSession();
      setStoredSession(null);
      setErrorMessage('当前登录状态已失效，请重新输入账号和密码。');
    } finally {
      setPending(false);
    }
  };

  const attemptLogin = async (nextUsername: string, nextPassword: string, role?: string) => {
    setPending(true);
    setErrorMessage('');

    try {
      if (isMockMode) {
        const mockAccount = resolveMockAccount(nextUsername, nextPassword);
        if (!mockAccount) {
          throw new Error('invalid credentials');
        }
        loginMock(mockAccount);
        setStoredSession(getStoredSessionSummary());
        closeRoleModal();
        goToDashboard();
        return;
      }

      const firstAttempt = await loginDev(nextUsername, nextPassword, role);
      if (firstAttempt?.status === 409) {
        const availableRoles = normalizeRoles(firstAttempt?.data?.details?.availableRoles);
        if (availableRoles.length === 0) {
          setErrorMessage('该账号角色不受 admin-web 支持（仅支持 ADMIN / BOSS / CS / MANAGER）。');
          closeRoleModal();
          return;
        }
        setRoleChoices(availableRoles);
        setPendingRoleSelection({ username: nextUsername, password: nextPassword });
        return;
      }

      await refreshBootstrap();
      setStoredSession(getStoredSessionSummary());
      closeRoleModal();
      goToDashboard();
    } catch (error) {
      setErrorMessage(normalizeErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUsername = username.trim();
    const rawPassword = password;
    setErrorMessage('');

    if (!normalizedUsername || !rawPassword) {
      setErrorMessage('请输入用户名和密码。');
      return;
    }

    await attemptLogin(normalizedUsername, rawPassword);
  };

  const handleSelectRole = async (role: string) => {
    if (!pendingRoleSelection) {
      return;
    }
    await attemptLogin(pendingRoleSelection.username, pendingRoleSelection.password, role);
  };

  const passwordType = showPassword ? 'text' : 'password';
  const passwordIcon = showPassword ? 'visibility' : 'visibility_off';
  const roleModalVisible = roleChoices.length > 0;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        data-alt="Subtle abstract blue and white gradient background"
        style={{ backgroundImage: 'linear-gradient(135deg, rgba(20, 75, 184, 0.05) 0%, rgba(246, 246, 248, 1) 100%)' }}
      >
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="absolute top-1/2 right-0 h-[500px] w-[500px] translate-x-1/3 transform rounded-full bg-primary/5 blur-3xl"></div>
      </div>

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 py-8 md:flex-row">
        <div className="hidden max-w-lg flex-1 flex-col space-y-12 pr-8 md:flex">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Nexus Commerce</h1>
            </div>
            <p className="text-4xl font-black leading-tight tracking-[-0.033em] text-slate-900 dark:text-white">
              Simplicity is the ultimate sophistication.
            </p>
            <p className="text-lg leading-relaxed text-slate-500 dark:text-slate-400">
              Streamline your marketplace operations with our secure, unified management platform.
            </p>
          </div>
          <div className="group relative flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-white/60 bg-white/50 shadow-sm backdrop-blur-sm">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#144bb8_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="relative z-10 flex flex-col items-center gap-4 text-primary/80">
              <span className="material-symbols-outlined text-6xl opacity-50">hub</span>
              <p className="text-sm font-medium uppercase tracking-widest opacity-70">Unified Ecosystem</p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-[440px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="group absolute top-0 right-0 z-20 cursor-pointer p-4" title="Login with Mini-program">
            <div className="relative">
              <div className="pointer-events-none absolute top-1/2 right-full mr-3 -translate-y-1/2 whitespace-nowrap rounded bg-slate-900 px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                Scan QR Code
              </div>
              <div className="flex h-12 w-12 items-start justify-end text-primary/80 transition-colors hover:text-primary">
                <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="mb-8 flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome Back</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Please sign in to access your dashboard</p>
            </div>

            {storedSession ? (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">检测到本地登录会话</p>
                <p className="mt-1">
                  当前缓存账号为 <span className="font-semibold">{storedSession.username}</span>，角色为{' '}
                  <span className="font-semibold">{storedSession.role}</span>。
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  为避免共享设备自动登录，系统不会直接进入后台，请选择继续当前会话或清除后重新登录。
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={pending}
                    id="resume-session"
                    onClick={() => void handleResumeStoredSession()}
                    type="button"
                  >
                    继续当前会话
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={pending}
                    id="discard-session"
                    onClick={handleDiscardStoredSession}
                    type="button"
                  >
                    清除并重新登录
                  </button>
                </div>
              </div>
            ) : null}

            <form id="login-form" action="#" className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-900 dark:text-slate-200" htmlFor="username">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <input
                    id="username"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 pl-11 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    disabled={pending}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="name@company.com"
                    required
                    type="text"
                    value={username}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-900 dark:text-slate-200" htmlFor="password">
                    Password
                  </label>
                  <a className="text-xs font-medium text-primary hover:text-primary/80 hover:underline" href="#">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input
                    id="password"
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-3.5 pr-11 pl-11 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-primary dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    disabled={pending}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                    type={passwordType}
                    value={password}
                  />
                  <button
                    id="toggle-password"
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-slate-200"
                    disabled={pending}
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    <span id="toggle-password-icon" className="material-symbols-outlined text-[20px]">
                      {passwordIcon}
                    </span>
                  </button>
                </div>
              </div>

              <button
                className="group/btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-center text-sm font-medium text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 focus:ring-4 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={pending}
                type="submit"
              >
                {pending ? '登录中...' : 'Sign In'}
                <span className="material-symbols-outlined text-lg transition-transform group-hover/btn:translate-x-1">
                  arrow_forward
                </span>
              </button>

              <p
                id="login-error"
                className={`${errorMessage ? 'block' : 'hidden'} rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700`}
              >
                {errorMessage}
              </p>
            </form>

            <div
              aria-labelledby="role-select-title"
              aria-modal="true"
              className={`${roleModalVisible ? 'fixed flex' : 'hidden'} inset-0 z-[100] items-center justify-center bg-slate-900/50 px-4`}
              id="role-select-modal"
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
                <h3 className="text-base font-semibold text-slate-900" id="role-select-title">
                  选择本次登录身份
                </h3>
                <p className="mt-1 text-sm text-slate-500">该账号有多个可用身份，请选择后继续登录。</p>
                <div className="mt-4 space-y-2" id="role-select-options">
                  {roleChoices.map((role) => (
                    <button
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:border-primary hover:bg-blue-50 hover:text-primary"
                      data-role={role}
                      disabled={pending}
                      key={role}
                      onClick={() => void handleSelectRole(role)}
                      type="button"
                    >
                      {ROLE_LABELS[role] || role}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    id="role-select-cancel"
                    onClick={closeRoleModal}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400">
                Need help?{' '}
                <a className="text-primary hover:underline" href="#">
                  Contact Support
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-0 w-full text-center">
        <p className="text-xs text-slate-400/50 dark:text-slate-600">© 2026 Nexus Commerce Inc. All rights reserved.</p>
      </div>
    </div>
  );
};
