import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { getCurrentSession, getDisplayProfile, logout, switchDevRole } from '../../lib/auth';
import { filterAllowedAdminWebRoles } from '../../lib/admin-role-policy';
import { isDevMode } from '../../lib/env';
import {
  dismissAdminSupportToast,
  useAdminSupportNotifications
} from '../support/adminSupportNotifications';
import { formatSupportRelativeTime } from '../pages/admin/supportWorkspaceData';
import { UserAvatar } from './UserAvatar';
import { resolveAvatarModel } from './avatar';

type AdminTopbarProps = {
  leftSlot?: ReactNode;
  searchPlaceholder?: string;
  headerClassName?: string;
  innerClassName?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
};

// 拼接 className，忽略空值。
const joinClasses = (...classes: Array<string | undefined>) => {
  return classes.filter(Boolean).join(' ');
};

const buildSupportConversationHref = (conversationId: string) => {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) {
    return '/support.html';
  }
  return `/support.html?conversationId=${encodeURIComponent(normalizedConversationId)}`;
};

// 后台顶部栏（搜索、用户菜单、退出）。
export const AdminTopbar = ({
  leftSlot,
  searchPlaceholder = '搜索...',
  headerClassName,
  innerClassName,
  title,
  subtitle,
  actions
}: AdminTopbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const menuId = useId();
  const notificationId = useId();
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const notificationContainerRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const session = getCurrentSession();
  const displayProfile = getDisplayProfile();
  const sessionUser = (session?.user && typeof session.user === 'object') ? session.user : null;
  const profileName = displayProfile?.name || '管理员用户';
  const profileRole = displayProfile?.role || '管理员';
  const avatar = resolveAvatarModel(sessionUser || { displayName: profileName });
  const [switchingRole, setSwitchingRole] = useState('');
  const roleChoices = filterAllowedAdminWebRoles(session?.user?.roles);
  const currentRole = String(session?.currentRole || '').trim().toUpperCase();
  const canSwitchRole = isDevMode && roleChoices.length > 1;
  const supportNotifications = useAdminSupportNotifications();

  useEffect(() => {
    if (!isMenuOpen && !isNotificationOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (!menuContainerRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
      if (!notificationContainerRef.current?.contains(target)) {
        setIsNotificationOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setIsMenuOpen(false);
      setIsNotificationOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen, isNotificationOpen]);

  useEffect(() => {
    if (!supportNotifications.latestToast) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dismissAdminSupportToast();
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [supportNotifications.latestToast]);

  const handleMenuToggle = () => {
    setIsMenuOpen((prevIsMenuOpen) => !prevIsMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleNotificationToggle = () => {
    setIsNotificationOpen((previous) => !previous);
    setIsMenuOpen(false);
  };

  const closeNotification = () => {
    setIsNotificationOpen(false);
  };

  const navigateToSupportConversation = (conversationId: string) => {
    const href = buildSupportConversationHref(conversationId);
    dismissAdminSupportToast();
    closeNotification();
    if (window.location.pathname === '/support.html') {
      const url = new URL(window.location.href);
      url.searchParams.set('conversationId', conversationId);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      window.dispatchEvent(new CustomEvent('tmo:admin-support:navigate', {
        detail: { conversationId }
      }));
      return;
    }
    window.location.href = href;
  };

  const handleLogout = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsMenuOpen(false);
    logout();
  };

  const handleSwitchRole = async (role: string) => {
    if (!role || role === currentRole || switchingRole) {
      return;
    }
    setSwitchingRole(role);
    try {
      await switchDevRole(role);
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '切换角色失败。');
    } finally {
      setSwitchingRole('');
    }
  };

  const resolvedLeftSlot = leftSlot || (
    <div className="min-w-0">
      {title ? <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div> : null}
      {subtitle ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
    </div>
  );

  return (
    <header
      className={joinClasses(
        'sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80',
        headerClassName
      )}
    >
        <div className={joinClasses('flex items-center justify-between gap-4', innerClassName)}>
        <div className="flex min-w-0 flex-1 items-center gap-8">{resolvedLeftSlot}</div>
        <div className="flex items-center gap-4">
          {actions ? <div className="hidden lg:block">{actions}</div> : null}
          <div className="hidden h-10 w-64 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition-all focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <span className="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500">search</span>
            <input
              className="w-full border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-400"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
          <div className="relative" ref={notificationContainerRef}>
            <button
              aria-label="客服通知"
              aria-controls={notificationId}
              aria-expanded={isNotificationOpen}
              aria-haspopup="dialog"
              className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              data-testid="admin-support-notification-button"
              onClick={handleNotificationToggle}
              ref={notificationButtonRef}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {supportNotifications.unreadCount > 0 ? (
                <span
                  className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-slate-900"
                  data-testid="admin-support-notification-badge"
                >
                  {supportNotifications.unreadCount > 99 ? '99+' : supportNotifications.unreadCount}
                </span>
              ) : null}
            </button>
            {isNotificationOpen ? (
              <div
                aria-label="客服通知列表"
                className="absolute right-0 top-full z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900"
                data-testid="admin-support-notification-panel"
                id={notificationId}
                role="dialog"
              >
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">客服新消息</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {supportNotifications.unreadCount > 0 ? `当前待处理 ${supportNotifications.unreadCount} 条消息` : '当前没有待处理的新消息'}
                      </p>
                    </div>
                    <button
                      className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      onClick={closeNotification}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {supportNotifications.items.length > 0 ? supportNotifications.items.map((item) => (
                    <button
                      className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 last:border-b-0 dark:border-slate-800 dark:hover:bg-slate-800/80"
                      data-testid={`admin-support-notification-item-${item.id}`}
                      key={item.id}
                      onClick={() => {
                        navigateToSupportConversation(item.id);
                      }}
                      type="button"
                    >
                      <span className="mt-1 inline-flex size-2.5 shrink-0 rounded-full bg-red-500" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {item.customerDisplayName || '未命名客户'}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {formatSupportRelativeTime(item.lastMessageAt)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {item.lastMessagePreview || '你有一条新的客服消息'}
                        </span>
                        <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                          待回复 {item.staffUnreadCount}
                        </span>
                      </span>
                    </button>
                  )) : (
                    <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">当前没有未读客服消息。</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative" ref={menuContainerRef}>
            <button
              aria-label="账户菜单"
              aria-controls={menuId}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              className="size-10 overflow-hidden rounded-full border border-slate-200 shadow-sm transition-opacity hover:opacity-90 dark:border-slate-700"
              onClick={handleMenuToggle}
              ref={menuButtonRef}
              type="button"
            >
              <UserAvatar
                avatarUrl={avatar.avatarUrl}
                className="size-full rounded-full"
                fallbackLetter={avatar.fallbackLetter}
              />
            </button>
            {isMenuOpen ? (
              <div
                className="absolute right-0 top-full z-40 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900"
                id={menuId}
                role="menu"
              >
                <div className="mb-1 border-b border-slate-100 px-2 pb-2 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white" id="user-name">
                    {profileName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400" id="user-role">
                    {profileRole}
                  </p>
                </div>
                {canSwitchRole ? (
                  <div className="mb-1 border-b border-slate-100 px-2 pb-2 dark:border-slate-800">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">调试角色</p>
                    <div className="flex flex-wrap gap-2">
                      {roleChoices.map((role) => {
                        const active = role === currentRole;
                        return (
                          <button
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                            }`}
                            disabled={Boolean(switchingRole)}
                            key={role}
                            onClick={() => void handleSwitchRole(role)}
                            type="button"
                          >
                            {switchingRole === role ? '切换中...' : role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <a
                  className="block rounded px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
                  href="/profile.html"
                  onClick={closeMenu}
                  role="menuitem"
                >
                  个人资料
                </a>
                <button
                  className="block rounded px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800"
                  id="logout-link"
                  onClick={handleLogout}
                  role="menuitem"
                  type="button"
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {supportNotifications.latestToast ? (
        <div
          className="pointer-events-none fixed right-6 top-24 z-50"
          data-testid="admin-support-notification-toast"
        >
          <div
            className="pointer-events-auto flex w-[22rem] items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-2xl ring-1 ring-black/5 transition hover:border-blue-200 hover:shadow-[0_20px_50px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900"
            onClick={() => navigateToSupportConversation(supportNotifications.latestToast?.conversationId || '')}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigateToSupportConversation(supportNotifications.latestToast?.conversationId || '');
              }
            }}
          >
            <span className="mt-1 inline-flex size-2.5 shrink-0 rounded-full bg-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {supportNotifications.latestToast.title} 发来新消息
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {supportNotifications.latestToast.preview}
              </p>
            </div>
            <button
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              onClick={(event) => {
                event.stopPropagation();
                dismissAdminSupportToast();
              }}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
};
