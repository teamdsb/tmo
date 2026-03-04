const fullAccessPermissionCodes = [
  'catalog:read',
  'product:manage',
  'order:read',
  'tracking:read',
  'inquiry:read',
  'inquiry:manage',
  'product_request:read',
  'product_request:export',
  'after_sales:manage',
  'customer:read',
  'customer:transfer',
  'customer:tag',
  'staff:read',
  'staff:status_manage',
  'import:product',
  'import:shipment',
  'shipment:manage',
  'payment:manage',
  'config:feature_flags',
  'rbac:manage'
];

const managerPermissionItems = [
  { code: 'catalog:read', scope: 'ALL' },
  { code: 'product:manage', scope: 'ALL' },
  { code: 'order:read', scope: 'ALL' },
  { code: 'tracking:read', scope: 'ALL' },
  { code: 'inquiry:read', scope: 'ALL' },
  { code: 'inquiry:manage', scope: 'ALL' },
  { code: 'product_request:read', scope: 'ALL' },
  { code: 'product_request:export', scope: 'ALL' },
  { code: 'after_sales:manage', scope: 'ALL' },
  { code: 'customer:read', scope: 'ALL' },
  { code: 'customer:transfer', scope: 'ALL' },
  { code: 'customer:tag', scope: 'ALL' },
  { code: 'staff:read', scope: 'ALL' },
  { code: 'staff:status_manage', scope: 'ALL' },
  { code: 'import:product', scope: 'ALL' },
  { code: 'import:shipment', scope: 'ALL' },
  { code: 'shipment:manage', scope: 'ALL' }
];

const csPermissionItems = [
  { code: 'after_sales:manage', scope: 'ALL' },
  { code: 'inquiry:read', scope: 'ALL' },
  { code: 'inquiry:manage', scope: 'ALL' },
  { code: 'order:read', scope: 'ALL' },
  { code: 'tracking:read', scope: 'ALL' },
  { code: 'product_request:read', scope: 'ALL' },
  { code: 'import:shipment', scope: 'ALL' },
  { code: 'shipment:manage', scope: 'ALL' }
];

const makePermissions = (items) => {
  return {
    items: items.map((item) => ({
      code: item.code,
      scope: item.scope
    }))
  };
};

const fullAccessPermissions = makePermissions(fullAccessPermissionCodes.map((code) => ({ code, scope: 'ALL' })));

const mockAccounts = [
  {
    userId: 'mock-admin-0001',
    username: 'admin',
    password: 'admin123',
    displayName: 'Admin',
    role: 'ADMIN',
    userType: 'admin',
    permissions: fullAccessPermissions
  },
  {
    userId: 'mock-boss-0001',
    username: 'boss',
    password: 'boss123',
    displayName: 'Boss',
    role: 'BOSS',
    userType: 'admin',
    permissions: fullAccessPermissions
  },
  {
    userId: 'mock-manager-0001',
    username: 'manager',
    password: 'manager123',
    displayName: 'Manager',
    role: 'MANAGER',
    userType: 'staff',
    permissions: makePermissions(managerPermissionItems)
  },
  {
    userId: 'mock-cs-0001',
    username: 'cs',
    password: 'cs123',
    displayName: 'CS',
    role: 'CS',
    userType: 'staff',
    permissions: makePermissions(csPermissionItems)
  }
];

const cloneMockAccount = (account) => {
  return {
    ...account,
    permissions: makePermissions(Array.isArray(account?.permissions?.items) ? account.permissions.items : [])
  };
};

export const listMockAccounts = () => {
  return mockAccounts.map((account) => cloneMockAccount(account));
};

export const resolveMockAccount = (username, password) => {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const rawPassword = String(password || '');
  if (!normalizedUsername || !rawPassword) {
    return null;
  }

  const matched = mockAccounts.find((account) => account.username === normalizedUsername && account.password === rawPassword);
  if (!matched) {
    return null;
  }
  return cloneMockAccount(matched);
};
