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

const salesPermissionItems = [
  { code: 'catalog:read', scope: 'ALL' },
  { code: 'order:read', scope: 'OWNED' },
  { code: 'tracking:read', scope: 'OWNED' },
  { code: 'inquiry:manage', scope: 'OWNED' },
  { code: 'product_request:read', scope: 'OWNED' },
  { code: 'after_sales:manage', scope: 'OWNED' },
  { code: 'customer:read', scope: 'OWNED' }
];

const customerPermissionItems = [
  { code: 'catalog:read', scope: 'ALL' },
  { code: 'wishlist:manage', scope: 'SELF' },
  { code: 'cart:manage', scope: 'SELF' },
  { code: 'order:create', scope: 'SELF' },
  { code: 'order:read', scope: 'SELF' },
  { code: 'tracking:read', scope: 'SELF' },
  { code: 'product_request:create', scope: 'SELF' },
  { code: 'product_request:read', scope: 'SELF' },
  { code: 'after_sales:create', scope: 'SELF' },
  { code: 'after_sales:read', scope: 'SELF' },
  { code: 'inquiry:create', scope: 'SELF' },
  { code: 'inquiry:read', scope: 'SELF' }
];

const rolePermissionItems = {
  ADMIN: fullAccessPermissionCodes.map((code) => ({ code, scope: 'ALL' })),
  BOSS: fullAccessPermissionCodes.map((code) => ({ code, scope: 'ALL' })),
  MANAGER: managerPermissionItems,
  CS: csPermissionItems,
  SALES: salesPermissionItems,
  CUSTOMER: customerPermissionItems
};

const clonePermissionItems = (items) => {
  return items.map((item) => ({
    code: String(item.code),
    scope: String(item.scope).toUpperCase()
  }));
};

export const buildPermissionListForRole = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  const items = rolePermissionItems[normalized] || [];
  return {
    items: clonePermissionItems(items)
  };
};

export const adminWebMockAccounts = [
  {
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    username: 'admin',
    password: 'admin123',
    displayName: 'Admin',
    role: 'ADMIN',
    userType: 'admin'
  },
  {
    userId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    username: 'boss',
    password: 'boss123',
    displayName: 'Boss',
    role: 'BOSS',
    userType: 'admin'
  },
  {
    userId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    username: 'manager',
    password: 'manager123',
    displayName: 'Manager',
    role: 'MANAGER',
    userType: 'staff'
  },
  {
    userId: '99999999-9999-9999-9999-999999999999',
    username: 'cs',
    password: 'cs123',
    displayName: 'CS',
    role: 'CS',
    userType: 'staff'
  }
];

export const miniMockIdentityFixtures = {
  mock_customer_001: {
    userId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    displayName: 'Customer Dev',
    userType: 'customer',
    roles: ['CUSTOMER'],
    ownerSalesDisplayName: 'Sales Dev'
  },
  mock_sales_001: {
    userId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    displayName: 'Sales Dev',
    userType: 'staff',
    roles: ['SALES']
  },
  mock_multi_001: {
    userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    displayName: 'Multi Role',
    userType: 'customer',
    roles: ['CUSTOMER', 'SALES'],
    ownerSalesDisplayName: 'Sales Dev'
  }
};

export const resolveMiniMockIdentityFixture = (code) => {
  const normalized = String(code || '').trim();
  return miniMockIdentityFixtures[normalized] || miniMockIdentityFixtures.mock_customer_001;
};
