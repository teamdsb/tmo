import { isDevMode } from '../../lib/env';
import { canAccessPath, normalizePermissionMap } from '../../lib/permissions';
import { readAuthState } from '../../lib/state';

export type AdminRouteKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'logistics'
  | 'sourcing'
  | 'users'
  | 'general'
  | 'security';

type NavItem = {
  key: Exclude<AdminRouteKey, 'general' | 'security'>;
  href: string;
  icon: string;
  label: string;
  badge?: string;
};

const navItems: NavItem[] = [
  { key: 'dashboard', href: '/dashboard.html', icon: 'dashboard', label: '仪表盘' },
  { key: 'products', href: '/products.html', icon: 'inventory_2', label: '商品' },
  { key: 'orders', href: '/orders.html', icon: 'shopping_cart', label: '订单', badge: isDevMode ? '' : '12' },
  { key: 'logistics', href: '/import.html', icon: 'local_shipping', label: '物流' },
  { key: 'sourcing', href: '/inquiries.html', icon: 'assignment', label: '在线客服' },
  { key: 'users', href: '/transfer.html', icon: 'group', label: '用户' }
];

const itemClass = (isActive: boolean) => {
  if (isActive) {
    return 'flex items-center gap-2.5 rounded-lg bg-primary/10 px-3 py-1.5 text-primary transition-colors';
  }
  return 'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors';
};

type AdminSidebarProps = {
  currentKey: Exclude<AdminRouteKey, 'general' | 'security'> | null;
  currentSettingKey: Extract<AdminRouteKey, 'general' | 'security'> | null;
};

export const AdminSidebar = ({ currentKey, currentSettingKey }: AdminSidebarProps) => {
  const authState = readAuthState();
  const permissionMap = normalizePermissionMap(authState?.permissions);
  const visibleNavItems = isDevMode ? navItems.filter((item) => canAccessPath(item.href, permissionMap)) : navItems;
  const showGeneralSetting = isDevMode ? canAccessPath('/settings.html', permissionMap) : true;
  const showSecuritySetting = isDevMode ? canAccessPath('/rbac.html', permissionMap) : true;

  return (
    <aside
      data-admin-unified-sidebar="true"
      className="hidden md:flex w-64 h-screen shrink-0 overflow-hidden flex-col border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800"
    >
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
          <span className="material-symbols-outlined text-xl">dataset</span>
        </div>
        <h1 className="text-base font-bold text-slate-900 dark:text-white">管理后台</h1>
      </div>
      <nav className="flex-1 overflow-hidden px-2 py-2 space-y-0.5">
        {visibleNavItems.map((item) => (
          <a key={item.key} className={itemClass(currentKey === item.key)} href={item.href}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
            {item.badge ? (
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {item.badge}
              </span>
            ) : null}
          </a>
        ))}
        <div className="my-2 border-t border-slate-200 dark:border-slate-800"></div>
        {(showGeneralSetting || showSecuritySetting) ? (
          <div className="px-3 py-1.5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">设置</p>
            {showGeneralSetting ? (
              <a className={itemClass(currentSettingKey === 'general')} href="/settings.html">
                <span className="material-symbols-outlined">settings</span>
                <span className="font-medium">通用</span>
              </a>
            ) : null}
            {showSecuritySetting ? (
              <a className={itemClass(currentSettingKey === 'security')} href="/rbac.html">
                <span className="material-symbols-outlined">security</span>
                <span className="font-medium">安全</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 bg-cover bg-center"></div>
          <div className="flex flex-col">
            <span id="user-name" className="text-sm font-semibold text-slate-900 dark:text-white">
              管理员用户
            </span>
            <span id="user-role" className="text-xs text-slate-500 dark:text-slate-400">
              管理员
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
