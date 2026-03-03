const rankScope = (scope) => {
  const normalized = String(scope || '').toUpperCase();
  if (normalized === 'ALL') return 3;
  if (normalized === 'OWNED') return 2;
  if (normalized === 'SELF') return 1;
  return 0;
};

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

export const resolveAccessTier = (session) => {
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles.map((x) => String(x).toUpperCase()) : [];
  if (roles.includes('BOSS') || roles.includes('ADMIN')) return 'boss';
  if (roles.includes('MANAGER')) return 'manager';
  if (roles.includes('SALES')) return 'sales';
  return 'unknown';
};

export const canAccessPath = (path, permissionMap) => {
  const currentPath = String(path || '/');
  if (currentPath === '/dashboard.html' || currentPath === '/') return true;
  if (currentPath === '/rbac.html') return hasPermission(permissionMap, 'rbac:manage', 'ALL');
  if (currentPath === '/settings.html') {
    return (
      hasPermission(permissionMap, 'config:feature_flags', 'ALL') ||
      hasPermission(permissionMap, 'staff:read', 'ALL') ||
      hasPermission(permissionMap, 'rbac:manage', 'ALL')
    );
  }
  if (currentPath === '/transfer.html' || currentPath === '/support.html') {
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
