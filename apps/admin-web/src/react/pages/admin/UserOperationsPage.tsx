import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  fetchAdminCustomers,
  fetchAdminCustomerTags,
  fetchAdminSalesUsers,
  fetchAdminUsers,
  fetchStaffUsers,
  patchStaffRoles,
  patchStaffStatus,
  promoteAdminCustomerToSales
} from '../../../lib/api';
import { isMockMode } from '../../../lib/env';
import { listMockAccounts } from '../../../lib/mock-accounts';
import { AdminTopbar } from '../../layout/AdminTopbar';

type UserOperationsTab = 'customers' | 'staff' | 'admins';

type SalesUser = {
  id: string;
  displayName: string;
  phone: string;
  status: string;
  roles: string[];
};

type CustomerTag = {
  id: string;
  name: string;
  color: string;
  sort: number;
  active: boolean;
};

type CustomerOwner = {
  id: string;
  displayName: string;
  phone: string;
};

type AdminCustomer = {
  id: string;
  displayName: string;
  phone: string;
  ownerSalesUserId: string;
  ownerSales: CustomerOwner | null;
  tags: CustomerTag[];
  createdAt: string;
};

type StaffUser = {
  id: string;
  displayName: string;
  roles: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AdminUser = {
  id: string;
  displayName: string;
  roles: string[];
  status: string;
  userType: string;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_TAG_COLOR = '#64748B';
const SALES_ROLE = 'SALES';

const mockSalesSeed: SalesUser[] = [
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    displayName: '张销售',
    phone: '13800138000',
    status: 'active',
    roles: ['SALES']
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    displayName: '李销售',
    phone: '13900139000',
    status: 'active',
    roles: ['SALES']
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    displayName: '王销售',
    phone: '13700137000',
    status: 'active',
    roles: ['SALES']
  }
];

const mockTagSeed: CustomerTag[] = [
  {
    id: '8ed6e30f-e4f4-49f9-a8f3-a9c4530f4f42',
    name: '重点客户',
    color: '#F97316',
    sort: 10,
    active: true
  },
  {
    id: 'c2215f84-089d-4329-b7b7-5ad3da4cb0a0',
    name: '待回访',
    color: '#2563EB',
    sort: 20,
    active: true
  }
];

const mockCustomerSeed: AdminCustomer[] = [
  {
    id: 'ab90d8ef-5de1-4f24-b4af-b3dde9e64610',
    displayName: '上海宏业贸易',
    phone: '13800138000',
    ownerSalesUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ownerSales: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      displayName: '张销售',
      phone: '13800138000'
    },
    tags: [mockTagSeed[0]],
    createdAt: '2026-02-22T09:10:11Z'
  },
  {
    id: '7ce1f6d1-4e6d-45bc-8c25-a27be9c98480',
    displayName: '苏州精工制造',
    phone: '13900139000',
    ownerSalesUserId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    ownerSales: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      displayName: '李销售',
      phone: '13900139000'
    },
    tags: [mockTagSeed[1]],
    createdAt: '2026-02-24T09:10:11Z'
  },
  {
    id: '515eb8de-6457-48f0-9e91-227b55f667e9',
    displayName: '宁波远航供应链',
    phone: '13700137000',
    ownerSalesUserId: '',
    ownerSales: null,
    tags: [],
    createdAt: '2026-02-26T09:10:11Z'
  }
];

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const formatDateTime = (raw: string) => {
  if (!raw) {
    return '-';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
};

const hasRole = (roles: string[], role: string) => {
  const target = role.toUpperCase();
  return roles.some((item) => item.toUpperCase() === target);
};

const appendRole = (roles: string[], role: string) => {
  if (hasRole(roles, role)) {
    return roles;
  }
  return [...roles, role];
};

const removeRole = (roles: string[], role: string) => {
  const target = role.toUpperCase();
  return roles.filter((item) => item.toUpperCase() !== target);
};

const normalizeRoleList = (roles: unknown): string[] => {
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles.filter((role): role is string => typeof role === 'string');
};

const normalizeSalesUsers = (data: unknown): SalesUser[] => {
  const items = (data as { items?: unknown[] })?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const record = item as {
        id?: string;
        displayName?: string;
        phone?: string | null;
        status?: string;
        roles?: unknown[];
      };
      if (!record.id) {
        return null;
      }
      const roles = Array.isArray(record.roles) ? record.roles.filter((role): role is string => typeof role === 'string') : [];
      return {
        id: record.id,
        displayName: safeText(record.displayName, '未命名业务员'),
        phone: safeText(record.phone, '-'),
        status: safeText(record.status, 'active').toLowerCase(),
        roles
      } as SalesUser;
    })
    .filter(Boolean) as SalesUser[];
};

const normalizeTags = (data: unknown): CustomerTag[] => {
  const items = Array.isArray((data as { items?: unknown[] })?.items)
    ? ((data as { items?: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => {
      const record = item as {
        id?: string;
        name?: string;
        color?: string;
        sort?: number;
        active?: boolean;
      };
      if (!record.id) {
        return null;
      }
      return {
        id: record.id,
        name: safeText(record.name, '未命名标签'),
        color: safeText(record.color, DEFAULT_TAG_COLOR),
        sort: Number.isFinite(record.sort) ? Number(record.sort) : 0,
        active: Boolean(record.active)
      } as CustomerTag;
    })
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort) as CustomerTag[];
};

const normalizeCustomers = (data: unknown): { items: AdminCustomer[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          displayName?: string;
          phone?: string | null;
          ownerSalesUserId?: string | null;
          ownerSales?: { id?: string; displayName?: string; phone?: string | null } | null;
          tags?: unknown[];
          createdAt?: string;
        };
        if (!record.id) {
          return null;
        }
        const owner = record.ownerSales;
        const normalizedTags = Array.isArray(record.tags)
          ? normalizeTags({ items: record.tags })
          : [];

        return {
          id: record.id,
          displayName: safeText(record.displayName, '未命名客户'),
          phone: safeText(record.phone, '-'),
          ownerSalesUserId: safeText(record.ownerSalesUserId, ''),
          ownerSales: owner?.id
            ? {
                id: owner.id,
                displayName: safeText(owner.displayName, '未命名业务员'),
                phone: safeText(owner.phone, '-')
              }
            : null,
          tags: normalizedTags,
          createdAt: safeText(record.createdAt, '')
        } as AdminCustomer;
      })
      .filter(Boolean) as AdminCustomer[],
    total: Number.isFinite(payload?.total) ? Number(payload.total) : 0
  };
};

const normalizeStaffUsers = (data: unknown): { items: StaffUser[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items)
    ? (payload.items as unknown[])
    : [];

  const normalizedItems = items
    .map((item) => {
      const record = item as {
        id?: string;
        displayName?: string;
        roles?: unknown[];
        status?: string;
        createdAt?: string;
        updatedAt?: string;
      };

      if (!record.id) {
        return null;
      }

      const roles = Array.isArray(record.roles)
        ? record.roles.filter((role): role is string => typeof role === 'string')
        : [];

      return {
        id: record.id,
        displayName: safeText(record.displayName, '未命名员工'),
        roles,
        status: safeText(record.status, 'active').toLowerCase(),
        createdAt: safeText(record.createdAt, ''),
        updatedAt: safeText(record.updatedAt, '')
      } as StaffUser;
    })
    .filter(Boolean) as StaffUser[];

  return {
    items: normalizedItems,
    total: Number.isFinite(payload?.total) ? Number(payload.total) : normalizedItems.length
  };
};

const normalizeAdminUsers = (data: unknown): { items: AdminUser[]; total: number } => {
  const payload = data as { items?: unknown[]; total?: number };
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items: items
      .map((item) => {
        const record = item as {
          id?: string;
          displayName?: string;
          roles?: unknown[];
          status?: string;
          userType?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        if (!record.id) {
          return null;
        }
        const roles = Array.isArray(record.roles)
          ? record.roles.filter((role): role is string => typeof role === 'string')
          : [];
        return {
          id: record.id,
          displayName: safeText(record.displayName, '未命名管理员'),
          roles,
          status: safeText(record.status, 'active').toLowerCase(),
          userType: safeText(record.userType, 'admin').toLowerCase(),
          createdAt: safeText(record.createdAt, ''),
          updatedAt: safeText(record.updatedAt, '')
        } as AdminUser;
      })
      .filter(Boolean) as AdminUser[],
    total: Number.isFinite(payload?.total) ? Number(payload.total) : 0
  };
};

const buildMockStaffSeed = (): StaffUser[] => {
  const now = new Date().toISOString();
  return listMockAccounts()
    .filter((account) => account.userType === 'staff')
    .map((account) => ({
      id: account.userId,
      displayName: account.displayName || account.username,
      roles: account.role ? [String(account.role).toUpperCase()] : [],
      status: 'active',
      createdAt: now,
      updatedAt: now
    }));
};

type CustomerRowProps = {
  customer: AdminCustomer;
  isPending: boolean;
  isSales: boolean;
  onPromoteToSales: (customer: AdminCustomer) => void;
};

const CustomerRow = memo(({ customer, isPending, isSales, onPromoteToSales }: CustomerRowProps) => {
  return (
    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30" data-testid={`customer-row-${customer.id}`}>
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{customer.displayName}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{customer.phone || '-'}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-text-primary-light dark:text-text-primary-dark">{customer.ownerSales?.displayName || '未分配'}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{customer.ownerSales?.phone || '-'}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {customer.tags.length > 0 ? (
            customer.tags.map((tag) => (
              <span
                key={`${customer.id}-${tag.id}`}
                className="rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
              >
                {tag.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">无标签</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(customer.createdAt)}</td>
      <td className="px-4 py-3">
        <button
          className="rounded border border-primary px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
          data-testid={`promote-to-sales-${customer.id}`}
          disabled={isPending || isSales}
          onClick={() => onPromoteToSales(customer)}
          type="button"
        >
          {isSales ? '已是业务员' : isPending ? '处理中...' : '设为业务员'}
        </button>
      </td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

type StaffRowProps = {
  staff: StaffUser;
  isPending: boolean;
  onGrantSales: (staff: StaffUser) => void;
  onRevokeSales: (staff: StaffUser) => void;
  onToggleStatus: (staff: StaffUser) => void;
};

const StaffRow = memo(({ staff, isPending, onGrantSales, onRevokeSales, onToggleStatus }: StaffRowProps) => {
  const includesSalesRole = hasRole(staff.roles, SALES_ROLE);
  const canRevokeSalesRole = includesSalesRole && staff.roles.length > 1;
  const isActive = staff.status === 'active';

  return (
    <tr className="border-b border-border-light transition-colors hover:bg-gray-50 dark:border-border-dark dark:hover:bg-gray-800/40">
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{staff.displayName}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{staff.id}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {staff.roles.length > 0 ? (
            staff.roles.map((role) => (
              <span
                key={`${staff.id}-${role}`}
                className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-blue-900/30 dark:text-blue-300"
              >
                {role}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">未设置角色</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{staff.status}</td>
      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(staff.updatedAt || staff.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            className="rounded border border-primary px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
            disabled={isPending || includesSalesRole}
            onClick={() => onGrantSales(staff)}
            type="button"
          >
            授予业务员
          </button>
          <button
            className="rounded border border-orange-500 px-2 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100/80 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:hover:bg-orange-900/30 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
            disabled={isPending || !canRevokeSalesRole}
            onClick={() => onRevokeSales(staff)}
            type="button"
            title={!canRevokeSalesRole && includesSalesRole ? '该员工仅剩 SALES 角色，无法直接移除' : undefined}
          >
            移除业务员
          </button>
          <button
            className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            disabled={isPending}
            onClick={() => onToggleStatus(staff)}
            type="button"
          >
            {isActive ? '禁用账号' : '启用账号'}
          </button>
        </div>
      </td>
    </tr>
  );
});

StaffRow.displayName = 'StaffRow';

export const UserOperationsPage = () => {
  const [activeTab, setActiveTab] = useState<UserOperationsTab>('customers');

  const [customerQueryInput, setCustomerQueryInput] = useState('');
  const [appliedCustomerQuery, setAppliedCustomerQuery] = useState('');
  const [ownerSalesFilter, setOwnerSalesFilter] = useState('');
  const [customerTagFilters, setCustomerTagFilters] = useState<string[]>([]);

  const [staffQueryInput, setStaffQueryInput] = useState('');
  const [appliedStaffQuery, setAppliedStaffQuery] = useState('');

  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [tags, setTags] = useState<CustomerTag[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminTotal, setAdminTotal] = useState(0);

  const [customerPage, setCustomerPage] = useState(1);
  const [customerPageSize] = useState(20);
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize] = useState(20);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize] = useState(20);

  const [mockTags] = useState<CustomerTag[]>(mockTagSeed);
  const [mockCustomers] = useState<AdminCustomer[]>(mockCustomerSeed);
  const [mockSalesUsers, setMockSalesUsers] = useState<SalesUser[]>(mockSalesSeed);
  const [mockStaffUsers, setMockStaffUsers] = useState<StaffUser[]>(buildMockStaffSeed);

  const [salesLoading, setSalesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingCustomerActions, setPendingCustomerActions] = useState<Record<string, boolean>>({});
  const [pendingStaffActions, setPendingStaffActions] = useState<Record<string, boolean>>({});
  const salesRequestVersion = useRef(0);
  const tagsRequestVersion = useRef(0);
  const customersRequestVersion = useRef(0);
  const staffRequestVersion = useRef(0);
  const adminRequestVersion = useRef(0);

  const activeTags = useMemo(() => tags.filter((tag) => tag.active), [tags]);
  const activeSalesUserIds = useMemo(() => new Set(salesUsers.map((item) => item.id)), [salesUsers]);

  const customerTotalPages = Math.max(1, Math.ceil(customerTotal / customerPageSize));
  const staffTotalPages = Math.max(1, Math.ceil(staffTotal / staffPageSize));
  const adminTotalPages = Math.max(1, Math.ceil(adminTotal / adminPageSize));

  const adminCountInMock = useMemo(() => {
    if (!isMockMode) {
      return null;
    }
    return listMockAccounts().filter((account) => account.userType === 'admin').length;
  }, []);

  const refreshSalesUsers = useCallback(async () => {
    const requestVersion = ++salesRequestVersion.current;
    setSalesLoading(true);
    try {
      if (isMockMode) {
        if (requestVersion !== salesRequestVersion.current) {
          return;
        }
        setSalesUsers(mockSalesUsers.filter((item) => item.status === 'active' && item.roles.includes('SALES')));
        return;
      }

      const response = await fetchAdminSalesUsers({ page: 1, pageSize: 200 });
      if (requestVersion !== salesRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setSalesUsers([]);
        setErrorMessage('加载业务员列表失败，请稍后重试。');
        return;
      }
      setSalesUsers(normalizeSalesUsers(response.data));
    } catch {
      if (requestVersion !== salesRequestVersion.current) {
        return;
      }
      setSalesUsers([]);
      setErrorMessage('加载业务员列表失败，请稍后重试。');
    } finally {
      if (requestVersion === salesRequestVersion.current) {
        setSalesLoading(false);
      }
    }
  }, [mockSalesUsers]);

  const refreshTags = useCallback(async () => {
    const requestVersion = ++tagsRequestVersion.current;
    setTagsLoading(true);
    try {
      if (isMockMode) {
        if (requestVersion !== tagsRequestVersion.current) {
          return;
        }
        setTags([...mockTags].sort((a, b) => a.sort - b.sort));
        return;
      }

      const response = await fetchAdminCustomerTags({ includeInactive: true });
      if (requestVersion !== tagsRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setTags([]);
        setErrorMessage('加载客户标签失败，请稍后重试。');
        return;
      }
      setTags(normalizeTags(response.data));
    } catch {
      if (requestVersion !== tagsRequestVersion.current) {
        return;
      }
      setTags([]);
      setErrorMessage('加载客户标签失败，请稍后重试。');
    } finally {
      if (requestVersion === tagsRequestVersion.current) {
        setTagsLoading(false);
      }
    }
  }, [mockTags]);

  const refreshCustomers = useCallback(async () => {
    const requestVersion = ++customersRequestVersion.current;
    setCustomersLoading(true);

    try {
      if (isMockMode) {
        let nextItems = [...mockCustomers];

        if (appliedCustomerQuery) {
          const keyword = appliedCustomerQuery.toLowerCase();
          nextItems = nextItems.filter((customer) => {
            return (
              customer.displayName.toLowerCase().includes(keyword)
              || customer.phone.includes(keyword)
              || customer.id.toLowerCase().includes(keyword)
            );
          });
        }

        if (ownerSalesFilter) {
          nextItems = nextItems.filter((customer) => customer.ownerSalesUserId === ownerSalesFilter);
        }

        if (customerTagFilters.length > 0) {
          nextItems = nextItems.filter((customer) => customer.tags.some((tag) => customerTagFilters.includes(tag.id)));
        }

        const start = (customerPage - 1) * customerPageSize;
        const end = start + customerPageSize;
        const pagedItems = nextItems.slice(start, end);

        if (requestVersion !== customersRequestVersion.current) {
          return;
        }
        setCustomers(pagedItems);
        setCustomerTotal(nextItems.length);
        return;
      }

      const response = await fetchAdminCustomers({
        page: customerPage,
        pageSize: customerPageSize,
        q: appliedCustomerQuery || undefined,
        ownerSalesUserId: ownerSalesFilter || undefined,
        tagIds: customerTagFilters.length > 0 ? customerTagFilters : undefined
      });

      if (requestVersion !== customersRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setCustomers([]);
        setCustomerTotal(0);
        setErrorMessage('加载客户列表失败，请稍后重试。');
        return;
      }

      const normalized = normalizeCustomers(response.data);
      setCustomers(normalized.items);
      setCustomerTotal(normalized.total);
    } catch {
      if (requestVersion !== customersRequestVersion.current) {
        return;
      }
      setCustomers([]);
      setCustomerTotal(0);
      setErrorMessage('加载客户列表失败，请稍后重试。');
    } finally {
      if (requestVersion === customersRequestVersion.current) {
        setCustomersLoading(false);
      }
    }
  }, [
    appliedCustomerQuery,
    customerPage,
    customerPageSize,
    customerTagFilters,
    mockCustomers,
    ownerSalesFilter
  ]);

  const refreshStaffUsers = useCallback(async () => {
    const requestVersion = ++staffRequestVersion.current;
    setStaffLoading(true);

    try {
      if (isMockMode) {
        const keyword = appliedStaffQuery.trim().toLowerCase();
        const allItems = [...mockStaffUsers];
        const filtered = keyword
          ? allItems.filter((staff) => {
            return (
              staff.displayName.toLowerCase().includes(keyword)
              || staff.id.toLowerCase().includes(keyword)
              || staff.roles.some((role) => role.toLowerCase().includes(keyword))
            );
          })
          : allItems;

        const start = (staffPage - 1) * staffPageSize;
        const end = start + staffPageSize;
        const pagedItems = filtered.slice(start, end);

        if (requestVersion !== staffRequestVersion.current) {
          return;
        }
        setStaffUsers(pagedItems);
        setStaffTotal(filtered.length);
        return;
      }

      const response = await fetchStaffUsers({
        page: staffPage,
        pageSize: staffPageSize,
        q: appliedStaffQuery || undefined
      });
      if (requestVersion !== staffRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setStaffUsers([]);
        setStaffTotal(0);
        setErrorMessage('加载业务员权限列表失败，请稍后重试。');
        return;
      }
      const normalized = normalizeStaffUsers(response.data);
      setStaffUsers(normalized.items);
      setStaffTotal(normalized.total);
    } catch {
      if (requestVersion !== staffRequestVersion.current) {
        return;
      }
      setStaffUsers([]);
      setStaffTotal(0);
      setErrorMessage('加载业务员权限列表失败，请稍后重试。');
    } finally {
      if (requestVersion === staffRequestVersion.current) {
        setStaffLoading(false);
      }
    }
  }, [appliedStaffQuery, mockStaffUsers, staffPage, staffPageSize]);

  const refreshAdminUsers = useCallback(async () => {
    const requestVersion = ++adminRequestVersion.current;
    setAdminLoading(true);
    try {
      if (isMockMode) {
        const mockAdmins = listMockAccounts()
          .filter((account) => account.userType === 'admin')
          .map((account) => {
            const now = new Date().toISOString();
            return {
              id: account.userId,
              displayName: account.displayName || account.username,
              roles: account.role ? [String(account.role).toUpperCase()] : ['ADMIN'],
              status: 'active',
              userType: 'admin',
              createdAt: now,
              updatedAt: now
            } as AdminUser;
          });
        const start = (adminPage - 1) * adminPageSize;
        const end = start + adminPageSize;
        if (requestVersion !== adminRequestVersion.current) {
          return;
        }
        setAdminUsers(mockAdmins.slice(start, end));
        setAdminTotal(mockAdmins.length);
        return;
      }

      const response = await fetchAdminUsers({
        page: adminPage,
        pageSize: adminPageSize,
        role: 'ADMIN'
      });
      if (requestVersion !== adminRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setAdminUsers([]);
        setAdminTotal(0);
        setErrorMessage('加载管理员列表失败，请稍后重试。');
        return;
      }
      const normalized = normalizeAdminUsers(response.data);
      setAdminUsers(normalized.items);
      setAdminTotal(normalized.total);
    } catch {
      if (requestVersion !== adminRequestVersion.current) {
        return;
      }
      setAdminUsers([]);
      setAdminTotal(0);
      setErrorMessage('加载管理员列表失败，请稍后重试。');
    } finally {
      if (requestVersion === adminRequestVersion.current) {
        setAdminLoading(false);
      }
    }
  }, [adminPage, adminPageSize]);

  useEffect(() => {
    // Parallel requests avoid lookup waterfall on first load.
    void Promise.all([refreshSalesUsers(), refreshTags()]);
  }, [refreshSalesUsers, refreshTags]);

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

  useEffect(() => {
    void refreshStaffUsers();
  }, [refreshStaffUsers]);

  useEffect(() => {
    void refreshAdminUsers();
  }, [refreshAdminUsers]);

  const handleApplyCustomerSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      setCustomerPage(1);
      setAppliedCustomerQuery(customerQueryInput.trim());
    });
  };

  const handleApplyStaffSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(() => {
      setStaffPage(1);
      setAppliedStaffQuery(staffQueryInput.trim());
    });
  };

  const setCustomerPending = useCallback((customerId: string, pending: boolean) => {
    setPendingCustomerActions((current) => {
      if (pending) {
        return {
          ...current,
          [customerId]: true
        };
      }
      const next = { ...current };
      delete next[customerId];
      return next;
    });
  }, []);

  const setStaffPending = useCallback((staffId: string, pending: boolean) => {
    setPendingStaffActions((current) => {
      if (pending) {
        return {
          ...current,
          [staffId]: true
        };
      }
      const next = { ...current };
      delete next[staffId];
      return next;
    });
  }, []);

  const handlePromoteCustomerToSales = useCallback(async (customer: AdminCustomer) => {
    setErrorMessage('');
    setSuccessMessage('');
    setCustomerPending(customer.id, true);
    const previousSales = salesUsers.find((item) => item.id === customer.id);
    const previousStaff = staffUsers.find((item) => item.id === customer.id);

    try {
      if (isMockMode) {
        const now = new Date().toISOString();

        setMockStaffUsers((current) => {
          const found = current.find((item) => item.id === customer.id);
          if (found) {
            return current.map((item) => {
              if (item.id !== customer.id) {
                return item;
              }
              return {
                ...item,
                displayName: customer.displayName || item.displayName,
                roles: appendRole(item.roles, SALES_ROLE),
                status: 'active',
                updatedAt: now
              };
            });
          }
          return [
            {
              id: customer.id,
              displayName: customer.displayName,
              roles: ['CUSTOMER', SALES_ROLE],
              status: 'active',
              createdAt: now,
              updatedAt: now
            },
            ...current
          ];
        });

        setMockSalesUsers((current) => {
          const found = current.find((item) => item.id === customer.id);
          if (found) {
            return current.map((item) => {
              if (item.id !== customer.id) {
                return item;
              }
              return {
                ...item,
                displayName: customer.displayName || item.displayName,
                phone: customer.phone || item.phone,
                status: 'active',
                roles: appendRole(item.roles, SALES_ROLE)
              };
            });
          }
          return [
            {
              id: customer.id,
              displayName: customer.displayName,
              phone: customer.phone || '-',
              status: 'active',
              roles: [SALES_ROLE]
            },
            ...current
          ];
        });

        setSuccessMessage(`已将「${customer.displayName}」设置为业务员（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setSalesUsers((current) => {
        const found = current.find((item) => item.id === customer.id);
        if (found) {
          return current.map((item) => {
            if (item.id !== customer.id) {
              return item;
            }
            return {
              ...item,
              displayName: customer.displayName || item.displayName,
              phone: customer.phone || item.phone,
              status: 'active',
              roles: appendRole(item.roles, SALES_ROLE)
            };
          });
        }
        return [
          {
            id: customer.id,
            displayName: customer.displayName,
            phone: customer.phone || '-',
            status: 'active',
            roles: [SALES_ROLE]
          },
          ...current
        ];
      });
      setStaffUsers((current) => current.map((item) => {
        if (item.id !== customer.id) {
          return item;
        }
        return {
          ...item,
          displayName: customer.displayName || item.displayName,
          roles: appendRole(item.roles, SALES_ROLE),
          status: 'active',
          updatedAt: optimisticUpdatedAt
        };
      }));

      const response = await promoteAdminCustomerToSales(customer.id);
      if (response.status !== 200) {
        setSalesUsers((current) => {
          const filtered = current.filter((item) => item.id !== customer.id);
          if (!previousSales) {
            return filtered;
          }
          return [previousSales, ...filtered];
        });
        if (previousStaff) {
          setStaffUsers((current) => current.map((item) => (item.id === customer.id ? previousStaff : item)));
        }
        setErrorMessage('设置业务员权限失败，请稍后重试。');
        return;
      }

      const payload = (response.data || {}) as {
        status?: string;
        roles?: unknown;
        updatedAt?: string;
        promoted?: boolean;
      };
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedStatus = safeText(payload.status, 'active').toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, new Date().toISOString());

      setSalesUsers((current) => {
        const found = current.find((item) => item.id === customer.id);
        if (found) {
          return current.map((item) => {
            if (item.id !== customer.id) {
              return item;
            }
            return {
              ...item,
              displayName: customer.displayName || item.displayName,
              phone: customer.phone || item.phone,
              status: resolvedStatus,
              roles: resolvedRoles.length > 0 ? resolvedRoles : appendRole(item.roles, SALES_ROLE)
            };
          });
        }
        return [
          {
            id: customer.id,
            displayName: customer.displayName,
            phone: customer.phone || '-',
            status: resolvedStatus,
            roles: resolvedRoles.length > 0 ? resolvedRoles : [SALES_ROLE]
          },
          ...current
        ];
      });

      setStaffUsers((current) => current.map((item) => {
        if (item.id !== customer.id) {
          return item;
        }
        return {
          ...item,
          displayName: customer.displayName || item.displayName,
          roles: resolvedRoles.length > 0 ? resolvedRoles : appendRole(item.roles, SALES_ROLE),
          status: resolvedStatus,
          updatedAt: resolvedUpdatedAt
        };
      }));

      setSuccessMessage(`已将「${customer.displayName}」设置为业务员。`);
      if (payload.promoted) {
        void refreshStaffUsers();
      }
    } catch {
      setSalesUsers((current) => {
        const filtered = current.filter((item) => item.id !== customer.id);
        if (!previousSales) {
          return filtered;
        }
        return [previousSales, ...filtered];
      });
      if (previousStaff) {
        setStaffUsers((current) => current.map((item) => (item.id === customer.id ? previousStaff : item)));
      }
      setErrorMessage('设置业务员权限失败，请稍后重试。');
    } finally {
      setCustomerPending(customer.id, false);
    }
  }, [refreshStaffUsers, salesUsers, setCustomerPending, setMockSalesUsers, setMockStaffUsers, staffUsers]);

  const handleGrantSalesRole = useCallback(async (staff: StaffUser) => {
    if (hasRole(staff.roles, SALES_ROLE)) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setStaffPending(staff.id, true);
    const previousSales = salesUsers.find((item) => item.id === staff.id);

    try {
      const nextRoles = appendRole(staff.roles, SALES_ROLE);
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockStaffUsers((current) => current.map((item) => {
          if (item.id !== staff.id) {
            return item;
          }
          return {
            ...item,
            roles: nextRoles,
            updatedAt: now
          };
        }));
        setMockSalesUsers((current) => {
          const found = current.find((item) => item.id === staff.id);
          if (found) {
            return current.map((item) => {
              if (item.id !== staff.id) {
                return item;
              }
              return {
                ...item,
                displayName: staff.displayName || item.displayName,
                status: 'active',
                roles: appendRole(item.roles, SALES_ROLE)
              };
            });
          }
          return [
            {
              id: staff.id,
              displayName: staff.displayName,
              phone: '-',
              status: 'active',
              roles: [SALES_ROLE]
            },
            ...current
          ];
        });
        setSuccessMessage(`已授予「${staff.displayName}」业务员权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          roles: nextRoles,
          updatedAt: optimisticUpdatedAt
        };
      }));
      setSalesUsers((current) => {
        const found = current.find((item) => item.id === staff.id);
        if (found) {
          return current.map((item) => {
            if (item.id !== staff.id) {
              return item;
            }
            return {
              ...item,
              displayName: staff.displayName || item.displayName,
              status: staff.status,
              roles: appendRole(item.roles, SALES_ROLE)
            };
          });
        }
        return [
          {
            id: staff.id,
            displayName: staff.displayName,
            phone: '-',
            status: staff.status,
            roles: [SALES_ROLE]
          },
          ...current
        ];
      });

      const response = await patchStaffRoles(staff.id, nextRoles);
      if (response.status !== 200) {
        setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
        setSalesUsers((current) => {
          const filtered = current.filter((item) => item.id !== staff.id);
          if (!previousSales) {
            return filtered;
          }
          return [previousSales, ...filtered];
        });
        setErrorMessage('授予业务员权限失败，请稍后重试。');
        return;
      }

      const payload = (response.data || {}) as {
        status?: string;
        roles?: unknown;
        updatedAt?: string;
      };
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedStatus = safeText(payload.status, staff.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);

      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          roles: resolvedRoles.length > 0 ? resolvedRoles : nextRoles,
          status: resolvedStatus,
          updatedAt: resolvedUpdatedAt
        };
      }));

      setSalesUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          displayName: staff.displayName || item.displayName,
          status: resolvedStatus,
          roles: resolvedRoles.length > 0 ? resolvedRoles : appendRole(item.roles, SALES_ROLE)
        };
      }));

      setSuccessMessage(`已授予「${staff.displayName}」业务员权限。`);
    } catch {
      setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
      setSalesUsers((current) => {
        const filtered = current.filter((item) => item.id !== staff.id);
        if (!previousSales) {
          return filtered;
        }
        return [previousSales, ...filtered];
      });
      setErrorMessage('授予业务员权限失败，请稍后重试。');
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [salesUsers, setMockSalesUsers, setMockStaffUsers, setStaffPending]);

  const handleRevokeSalesRole = useCallback(async (staff: StaffUser) => {
    if (!hasRole(staff.roles, SALES_ROLE)) {
      return;
    }
    if (staff.roles.length <= 1) {
      setErrorMessage('该账号仅剩一个角色，无法直接移除业务员角色。');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setStaffPending(staff.id, true);
    const previousSales = salesUsers.find((item) => item.id === staff.id);

    try {
      const nextRoles = removeRole(staff.roles, SALES_ROLE);
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockStaffUsers((current) => current.map((item) => {
          if (item.id !== staff.id) {
            return item;
          }
          return {
            ...item,
            roles: nextRoles,
            updatedAt: now
          };
        }));
        setMockSalesUsers((current) => current.filter((item) => item.id !== staff.id));
        setSuccessMessage(`已移除「${staff.displayName}」业务员权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          roles: nextRoles,
          updatedAt: optimisticUpdatedAt
        };
      }));
      setSalesUsers((current) => current.filter((item) => item.id !== staff.id));

      const response = await patchStaffRoles(staff.id, nextRoles);
      if (response.status !== 200) {
        setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
        setSalesUsers((current) => {
          if (!previousSales) {
            return current;
          }
          const filtered = current.filter((item) => item.id !== staff.id);
          return [previousSales, ...filtered];
        });
        setErrorMessage('移除业务员权限失败，请稍后重试。');
        return;
      }

      const payload = (response.data || {}) as {
        status?: string;
        roles?: unknown;
        updatedAt?: string;
      };
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedStatus = safeText(payload.status, staff.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          roles: resolvedRoles.length > 0 ? resolvedRoles : nextRoles,
          status: resolvedStatus,
          updatedAt: resolvedUpdatedAt
        };
      }));

      setSuccessMessage(`已移除「${staff.displayName}」业务员权限。`);
    } catch {
      setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
      setSalesUsers((current) => {
        const filtered = current.filter((item) => item.id !== staff.id);
        if (!previousSales) {
          return filtered;
        }
        return [previousSales, ...filtered];
      });
      setErrorMessage('移除业务员权限失败，请稍后重试。');
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [salesUsers, setMockSalesUsers, setMockStaffUsers, setStaffPending]);

  const handleToggleStaffStatus = useCallback(async (staff: StaffUser) => {
    setErrorMessage('');
    setSuccessMessage('');
    setStaffPending(staff.id, true);

    try {
      const nextStatus = staff.status === 'active' ? 'disabled' : 'active';
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockStaffUsers((current) => current.map((item) => {
          if (item.id !== staff.id) {
            return item;
          }
          return {
            ...item,
            status: nextStatus,
            updatedAt: now
          };
        }));
        setMockSalesUsers((current) => current.map((item) => {
          if (item.id !== staff.id) {
            return item;
          }
          return {
            ...item,
            status: nextStatus
          };
        }));
        setSuccessMessage(nextStatus === 'active'
          ? `已启用「${staff.displayName}」账号（mock）。`
          : `已禁用「${staff.displayName}」账号（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          status: nextStatus,
          updatedAt: optimisticUpdatedAt
        };
      }));
      setSalesUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          status: nextStatus
        };
      }));

      const response = await patchStaffStatus(
        staff.id,
        nextStatus,
        nextStatus === 'disabled' ? '由用户运营中心禁用' : undefined
      );
      if (response.status !== 200) {
        setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
        setSalesUsers((current) => current.map((item) => {
          if (item.id !== staff.id) {
            return item;
          }
          return {
            ...item,
            status: staff.status
          };
        }));
        setErrorMessage('更新账号状态失败，请稍后重试。');
        return;
      }

      const payload = (response.data || {}) as {
        status?: string;
        roles?: unknown;
        updatedAt?: string;
      };
      const resolvedStatus = safeText(payload.status, nextStatus).toLowerCase();
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);

      setStaffUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          status: resolvedStatus,
          roles: resolvedRoles.length > 0 ? resolvedRoles : item.roles,
          updatedAt: resolvedUpdatedAt
        };
      }));
      setSalesUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          status: resolvedStatus,
          roles: resolvedRoles.length > 0 ? resolvedRoles : item.roles
        };
      }));

      setSuccessMessage(nextStatus === 'active' ? `已启用「${staff.displayName}」账号。` : `已禁用「${staff.displayName}」账号。`);
    } catch {
      setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
      setSalesUsers((current) => current.map((item) => {
        if (item.id !== staff.id) {
          return item;
        }
        return {
          ...item,
          status: staff.status
        };
      }));
      setErrorMessage('更新账号状态失败，请稍后重试。');
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [setMockSalesUsers, setMockStaffUsers, setStaffPending]);

  const renderCustomerPanel = () => {
    return (
      <section className="space-y-4">
        <form className="grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark lg:grid-cols-[1.5fr_1fr_1fr_auto]" onSubmit={handleApplyCustomerSearch}>
          <input
            className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => setCustomerQueryInput(event.currentTarget.value)}
            placeholder="搜索客户名称、手机号或 ID"
            value={customerQueryInput}
          />
          <select
            className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => {
              setOwnerSalesFilter(event.currentTarget.value);
              setCustomerPage(1);
            }}
            value={ownerSalesFilter}
          >
            <option value="">全部业务员</option>
            {salesUsers.map((sales) => (
              <option key={sales.id} value={sales.id}>{sales.displayName}</option>
            ))}
          </select>
          <select
            className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            multiple
            onChange={(event) => {
              const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
              setCustomerTagFilters(values);
              setCustomerPage(1);
            }}
            value={customerTagFilters}
          >
            {activeTags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={customersLoading}
            type="submit"
          >
            {customersLoading ? '查询中...' : '查询'}
          </button>
        </form>

        <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
            <div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">客户信息</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {customerTotal} 位客户</p>
            </div>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
              {isMockMode ? 'mock' : 'dev'}
            </span>
          </div>

          <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                <tr>
                  <th className="px-4 py-3">客户</th>
                  <th className="px-4 py-3">归属业务员</th>
                  <th className="px-4 py-3">标签</th>
                  <th className="px-4 py-3">创建时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {customers.map((customer) => (
                  <CustomerRow
                    customer={customer}
                    isPending={Boolean(pendingCustomerActions[customer.id])}
                    isSales={activeSalesUserIds.has(customer.id)}
                    key={customer.id}
                    onPromoteToSales={handlePromoteCustomerToSales}
                  />
                ))}

                {!customersLoading && customers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5} data-testid="customers-empty-state">
                      暂无客户数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border-light px-4 py-3 text-xs text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
            <span>
              第 {customerPage} / {customerTotalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                disabled={customerPage <= 1}
                onClick={() => setCustomerPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                disabled={customerPage >= customerTotalPages}
                onClick={() => setCustomerPage((current) => Math.min(customerTotalPages, current + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </section>
    );
  };

  const renderStaffPanel = () => {
    return (
      <section className="space-y-4">
        <form className="grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark lg:grid-cols-[1fr_auto]" onSubmit={handleApplyStaffSearch}>
          <input
            className="rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => setStaffQueryInput(event.currentTarget.value)}
            placeholder="搜索业务员姓名、ID 或角色"
            value={staffQueryInput}
          />
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={staffLoading}
            type="submit"
          >
            {staffLoading ? '查询中...' : '查询'}
          </button>
        </form>

        <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
            <div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">业务员与员工信息</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {staffTotal} 位员工</p>
            </div>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
              {isMockMode ? 'mock' : 'dev'}
            </span>
          </div>

          <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                <tr>
                  <th className="px-4 py-3">员工</th>
                  <th className="px-4 py-3">角色</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {staffUsers.map((staff) => (
                  <StaffRow
                    isPending={Boolean(pendingStaffActions[staff.id])}
                    key={staff.id}
                    onGrantSales={handleGrantSalesRole}
                    onRevokeSales={handleRevokeSalesRole}
                    onToggleStatus={handleToggleStaffStatus}
                    staff={staff}
                  />
                ))}
                {!staffLoading && staffUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5}>
                      暂无业务员数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border-light px-4 py-3 text-xs text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
            <span>
              第 {staffPage} / {staffTotalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                disabled={staffPage <= 1}
                onClick={() => setStaffPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
                disabled={staffPage >= staffTotalPages}
                onClick={() => setStaffPage((current) => Math.min(staffTotalPages, current + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </section>
    );
  };

  const renderAdminPanel = () => {
    return (
      <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
        <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
          <div>
            <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">管理员用户</p>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {adminTotal} 位管理员</p>
          </div>
          <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
            {isMockMode ? 'mock' : 'dev'}
          </span>
        </div>

        <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
              <tr>
                <th className="px-4 py-3">管理员</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">更新时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {adminUsers.map((admin) => (
                <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30" key={admin.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{admin.displayName}</p>
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{admin.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {admin.roles.length > 0 ? admin.roles.map((role) => (
                        <span
                          className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-blue-900/30 dark:text-blue-300"
                          key={`${admin.id}-${role}`}
                        >
                          {role}
                        </span>
                      )) : <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">未设置</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{admin.status}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(admin.updatedAt || admin.createdAt)}</td>
                </tr>
              ))}
              {!adminLoading && adminUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={4}>
                    暂无管理员数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border-light px-4 py-3 text-xs text-text-secondary-light dark:border-border-dark dark:text-text-secondary-dark">
          <span>
            第 {adminPage} / {adminTotalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
              disabled={adminPage <= 1}
              onClick={() => setAdminPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              上一页
            </button>
            <button
              className="rounded border border-border-light px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:hover:bg-gray-800"
              disabled={adminPage >= adminTotalPages}
              onClick={() => setAdminPage((current) => Math.min(adminTotalPages, current + 1))}
              type="button"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    );
  };

  return (
    <main className="flex h-screen flex-1 flex-col overflow-hidden bg-background-light dark:bg-background-dark" data-testid="user-operations-page">
      <AdminTopbar
        leftSlot={(
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">用户运营中心</h1>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              支持客户提权为业务员，并支持业务员角色与状态管理
            </p>
          </div>
        )}
        searchPlaceholder="搜索客户或业务员"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
          可在客户页将客户设置为业务员；在业务员页可授予/移除业务员角色并启用或禁用账号。
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-surface-light p-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">客户总量</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{customerTotal}</p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-light p-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">业务员/员工总量</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{staffTotal}</p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-light p-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">管理员总量</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{adminTotal || adminCountInMock || 0}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border-light bg-surface-light p-2 dark:border-border-dark dark:bg-surface-dark">
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'customers' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="tab-customers"
            onClick={() => setActiveTab('customers')}
            type="button"
          >
            客户
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'staff' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="tab-staff"
            onClick={() => setActiveTab('staff')}
            type="button"
          >
            业务员
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
            data-testid="tab-admins"
            onClick={() => setActiveTab('admins')}
            type="button"
          >
            管理员
          </button>
        </div>

        {errorMessage ? <p className="mb-3 text-sm text-red-600" data-testid="user-operations-error">{errorMessage}</p> : null}
        {successMessage ? <p className="mb-3 text-sm text-emerald-600" data-testid="user-operations-success">{successMessage}</p> : null}

        {activeTab === 'customers'
          ? renderCustomerPanel()
          : activeTab === 'staff'
            ? renderStaffPanel()
            : renderAdminPanel()}
      </div>
    </main>
  );
};
