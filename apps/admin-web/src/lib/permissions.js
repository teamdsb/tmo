import { normalizeAppPath } from './env';

// 权限作用域权重：ALL > OWNED > SELF。
const rankScope = (scope) => {
  const normalized = String(scope || '').toUpperCase();
  if (normalized === 'ALL') return 3;
  if (normalized === 'OWNED') return 2;
  if (normalized === 'SELF') return 1;
  return 0;
};

// 将权限列表归并成 Map<code, strongestScope>。
export const normalizePermissionMap = (permissions) => {
  const map = new Map();
  const items = Array.isArray(permissions?.items) ? permissions.items : [];
  for (const item of items) {
    const code = String(item?.code || '').trim();
    if (!code) continue;
    const scope = String(item?.scope || 'SELF').toUpperCase();
    const current = map.get(code);
    if (!current || rankScope(scope) > rankScope(current)) {
      map.set(code, scope);
    }
  }
  return map;
};

// 校验是否具备某权限且作用域满足要求。
export const hasPermission = (permissionMap, code, requiredScope = 'SELF') => {
  if (!(permissionMap instanceof Map)) {
    return false;
  }
  const actual = permissionMap.get(code);
  if (!actual) {
    return false;
  }
  return rankScope(actual) >= rankScope(requiredScope);
};

// 从会话角色推断页面展示层级（boss/manager/sales）。
export const resolveAccessTier = (session) => {
  const currentRole = String(session?.currentRole || '').trim().toUpperCase();
  if (currentRole === 'BOSS' || currentRole === 'ADMIN') return 'boss';
  if (currentRole === 'CS') return 'sales';
  if (currentRole === 'MANAGER') return 'manager';
  if (currentRole === 'SALES') return 'sales';

  const roles = Array.isArray(session?.user?.roles) ? session.user.roles.map((x) => String(x).toUpperCase()) : [];
  if (roles.includes('BOSS') || roles.includes('ADMIN')) return 'boss';
  if (roles.includes('CS')) return 'sales';
  if (roles.includes('MANAGER')) return 'manager';
  if (roles.includes('SALES')) return 'sales';
  return 'unknown';
};

// 路径级访问控制，作为菜单和守卫的统一判定入口。
export const canAccessPath = (path, permissionMap) => {
  const currentPath = normalizeAppPath(path);
  if (currentPath === '/dashboard.html' || currentPath === '/') return true;
  if (currentPath === '/profile.html') return true;
  if (currentPath === '/rbac.html') return hasPermission(permissionMap, 'rbac:manage', 'ALL');
  if (currentPath === '/settings.html') {
    return (
      hasPermission(permissionMap, 'config:feature_flags', 'ALL') ||
      hasPermission(permissionMap, 'staff:read', 'ALL') ||
      hasPermission(permissionMap, 'rbac:manage', 'ALL')
    );
  }
  if (currentPath === '/transfer.html') {
    return hasPermission(permissionMap, 'customer:read', 'ALL') || hasPermission(permissionMap, 'customer:transfer', 'ALL');
  }
  if (currentPath === '/user-operations.html') {
    return (
      hasPermission(permissionMap, 'customer:read', 'ALL') ||
      hasPermission(permissionMap, 'customer:transfer', 'ALL') ||
      hasPermission(permissionMap, 'staff:read', 'ALL') ||
      hasPermission(permissionMap, 'rbac:manage', 'ALL')
    );
  }
  if (currentPath === '/support.html') {
    return hasPermission(permissionMap, 'customer:read', 'SELF');
  }
  if (currentPath === '/orders.html') return hasPermission(permissionMap, 'order:read', 'SELF');
  if (currentPath === '/products.html') {
    return hasPermission(permissionMap, 'catalog:read', 'SELF') || hasPermission(permissionMap, 'product:manage', 'SELF');
  }
  if (currentPath === '/payments.html') return hasPermission(permissionMap, 'payment:manage', 'SELF');
  if (currentPath === '/import.html') {
    return (
      hasPermission(permissionMap, 'import:product', 'SELF') ||
      hasPermission(permissionMap, 'import:shipment', 'SELF') ||
      hasPermission(permissionMap, 'product_request:export', 'SELF') ||
      hasPermission(permissionMap, 'config:feature_flags', 'ALL')
    );
  }
  if (currentPath === '/exports.html') return hasPermission(permissionMap, 'product_request:export', 'SELF');
  if (currentPath === '/inquiries.html' || currentPath === '/quote-workflow.html' || currentPath === '/suppliers.html') {
    return (
      hasPermission(permissionMap, 'inquiry:read', 'SELF') ||
      hasPermission(permissionMap, 'inquiry:manage', 'SELF') ||
      hasPermission(permissionMap, 'product_request:read', 'SELF')
    );
  }
  return true;
};
