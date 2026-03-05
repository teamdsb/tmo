import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { getCurrentSession, getDisplayProfile, logout } from '../../lib/auth';
import { UserAvatar } from './UserAvatar';
import { resolveAvatarModel } from './avatar';

type AdminTopbarProps = {
  leftSlot: ReactNode;
  searchPlaceholder?: string;
  headerClassName?: string;
  innerClassName?: string;
};

// 拼接 className，忽略空值。
const joinClasses = (...classes: Array<string | undefined>) => {
  return classes.filter(Boolean).join(' ');
};

// 后台顶部栏（搜索、用户菜单、退出）。
export const AdminTopbar = ({
  leftSlot,
  searchPlaceholder = '搜索...',
  headerClassName,
  innerClassName
}: AdminTopbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const session = getCurrentSession();
  const displayProfile = getDisplayProfile();
  const sessionUser = (session?.user && typeof session.user === 'object') ? session.user : null;
  const profileName = displayProfile?.name || '管理员用户';
  const profileRole = displayProfile?.role || '管理员';
  const avatar = resolveAvatarModel(sessionUser || { displayName: profileName });

  useEffect(() => {
    if (!isMenuOpen) {
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
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleMenuToggle = () => {
    setIsMenuOpen((prevIsMenuOpen) => !prevIsMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsMenuOpen(false);
    logout();
  };

  return (
    <header
      className={joinClasses(
        'sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80',
        headerClassName
      )}
    >
      <div className={joinClasses('flex items-center justify-between gap-4', innerClassName)}>
        <div className="flex min-w-0 flex-1 items-center gap-8">{leftSlot}</div>
        <div className="flex items-center gap-4">
          <div className="hidden h-10 w-64 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 transition-all focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 sm:flex">
            <span className="material-symbols-outlined text-[20px] text-slate-400 dark:text-slate-500">search</span>
            <input
              className="w-full border-none bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-400"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
          <button
            className="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
          </button>
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
    </header>
  );
};
