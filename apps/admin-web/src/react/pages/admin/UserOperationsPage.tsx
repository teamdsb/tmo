import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import {
  fetchAdminCustomers,
  fetchAdminCustomerTags,
  fetchAdminSalesUsers,
  fetchAdminUsers,
  fetchStaffUsers,
  patchAdminUser,
  patchStaffRoles,
  patchStaffStatus,
  promoteAdminCustomerToSales
} from '../../../lib/api';
import { getCurrentSession } from '../../../lib/auth';
import { isMockMode } from '../../../lib/env';
import { listMockAccounts } from '../../../lib/mock-accounts';
import { hasPermission, normalizePermissionMap } from '../../../lib/permissions';
import { AdminTopbar } from '../../layout/AdminTopbar';

type UserOperationsTab = 'customers' | 'staff' | 'admins';
type TabMessage = { error: string; success: string };

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
  phone: string;
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
const CS_ROLE = 'CS';
const MANAGER_ROLE = 'MANAGER';
const ADMIN_ROLE = 'ADMIN';
const BOSS_ROLE = 'BOSS';
const STAFF_ROLE_BLOCKS = [SALES_ROLE, CS_ROLE, MANAGER_ROLE] as const;
const ADMIN_ROLE_BLOCKS = [ADMIN_ROLE, BOSS_ROLE] as const;

const ROLE_LABELS: Record<string, string> = {
  [SALES_ROLE]: '小程序业务员',
  [CS_ROLE]: '客服',
  [MANAGER_ROLE]: '经理',
  [ADMIN_ROLE]: '管理员',
  [BOSS_ROLE]: '老板'
};

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

const normalizeAdminRoles = (roles: string[]) => {
  const normalized = normalizeRoleList(roles).map((role) => role.toUpperCase());
  if (normalized.includes(BOSS_ROLE) && !normalized.includes(ADMIN_ROLE)) {
    normalized.push(ADMIN_ROLE);
  }
  return Array.from(new Set(normalized)).sort();
};

const appendAdminRole = (roles: string[], role: string) => {
  const nextRoles = appendRole(roles, role);
  if (String(role || '').toUpperCase() === BOSS_ROLE) {
    return normalizeAdminRoles(appendRole(nextRoles, ADMIN_ROLE));
  }
  return normalizeAdminRoles(nextRoles);
};

const removeAdminRole = (roles: string[], role: string) => {
  const target = String(role || '').toUpperCase();
  if (target === BOSS_ROLE) {
    return normalizeAdminRoles([ADMIN_ROLE]);
  }
  return normalizeAdminRoles(removeRole(roles, target));
};

const getRoleLabel = (role: string) => {
  return ROLE_LABELS[String(role || '').toUpperCase()] || role;
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
        phone?: string | null;
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
        phone: safeText(record.phone, '-'),
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
          roles: normalizeAdminRoles(roles),
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
      phone: account.phone || '-',
      roles: account.role ? [String(account.role).toUpperCase()] : [],
      status: 'active',
      createdAt: now,
      updatedAt: now
    }));
};

const buildMockAdminSeed = (): AdminUser[] => {
  const now = new Date().toISOString();
  return listMockAccounts()
    .filter((account) => account.userType === 'admin')
    .map((account) => ({
      id: account.userId,
      displayName: account.displayName || account.username,
      roles: normalizeAdminRoles(account.role ? [String(account.role).toUpperCase()] : [ADMIN_ROLE]),
      status: 'active',
      userType: 'admin',
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
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{customer.id}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">customer · CUSTOMER</p>
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
          {isSales ? '已是小程序业务员' : isPending ? '处理中...' : '设为小程序业务员'}
        </button>
      </td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

type StaffRowProps = {
  staff: StaffUser;
  isPending: boolean;
  canManageRoles: boolean;
  canToggleStatus: boolean;
  onGrantRole: (staff: StaffUser, role: string) => void;
  onRevokeRole: (staff: StaffUser, role: string) => void;
  onToggleStatus: (staff: StaffUser) => void;
};

type RoleActionBlockProps = {
  role: string;
  hasRoleAssigned: boolean;
  canGrant: boolean;
  canRemove: boolean;
  canToggleStatus: boolean;
  isPending: boolean;
  statusLabel: string;
  onGrant: () => void;
  onRemove: () => void;
  onToggleStatus: () => void;
  removeTitle?: string;
  toggleTitle?: string;
};

const RoleActionBlock = ({
  role,
  hasRoleAssigned,
  canGrant,
  canRemove,
  canToggleStatus,
  isPending,
  statusLabel,
  onGrant,
  onRemove,
  onToggleStatus,
  removeTitle,
  toggleTitle
}: RoleActionBlockProps) => {
  const roleLabel = getRoleLabel(role);

  return (
    <div className="min-w-[220px] rounded-lg border border-border-light bg-white p-3 dark:border-border-dark dark:bg-slate-900/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">{roleLabel}</span>
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${hasRoleAssigned ? 'bg-blue-100 text-primary dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
          {hasRoleAssigned ? '已拥有' : '未拥有'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          className="rounded border border-primary px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
          disabled={isPending || !canGrant}
          onClick={onGrant}
          type="button"
        >
          {hasRoleAssigned ? `已是${roleLabel}` : isPending ? '处理中...' : `给予${roleLabel}`}
        </button>
        <button
          className="rounded border border-orange-500 px-2 py-1 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-100/80 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 dark:hover:bg-orange-900/30 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
          disabled={isPending || !canRemove}
          onClick={onRemove}
          title={removeTitle}
          type="button"
        >
          移除
        </button>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          disabled={isPending || !canToggleStatus}
          onClick={onToggleStatus}
          title={toggleTitle}
          type="button"
        >
          {statusLabel}
        </button>
      </div>
    </div>
  );
};

const StaffRow = memo(({ staff, isPending, canManageRoles, canToggleStatus, onGrantRole, onRevokeRole, onToggleStatus }: StaffRowProps) => {
  const isActive = staff.status === 'active';
  const disableLabel = isActive ? '禁用账号' : '启用账号';

  return (
    <tr className="border-b border-border-light transition-colors hover:bg-gray-50 dark:border-border-dark dark:hover:bg-gray-800/40">
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{staff.displayName}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{staff.phone || '-'}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{staff.id}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">staff</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {staff.roles.length > 0 ? (
            staff.roles.map((role) => (
              <span
                key={`${staff.id}-${role}`}
                className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-blue-900/30 dark:text-blue-300"
              >
                {getRoleLabel(role)}
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
        <div className="flex flex-wrap gap-2">
          {STAFF_ROLE_BLOCKS.map((role) => {
            const assigned = hasRole(staff.roles, role);
            const canRemove = canManageRoles && assigned && staff.roles.length > 1;
            const removeTitle = assigned && staff.roles.length <= 1
              ? '该账号仅剩一个角色，无法直接移除'
              : undefined;

            return (
              <RoleActionBlock
                canGrant={canManageRoles && !assigned}
                canRemove={canRemove}
                canToggleStatus={canToggleStatus}
                hasRoleAssigned={assigned}
                isPending={isPending}
                key={`${staff.id}-${role}-block`}
                onGrant={() => onGrantRole(staff, role)}
                onRemove={() => onRevokeRole(staff, role)}
                onToggleStatus={() => onToggleStatus(staff)}
                removeTitle={removeTitle}
                role={role}
                statusLabel={disableLabel}
              />
            );
          })}
        </div>
      </td>
    </tr>
  );
});

StaffRow.displayName = 'StaffRow';

type AdminRowProps = {
  admin: AdminUser;
  isPending: boolean;
  canManageRoles: boolean;
  onGrantRole: (admin: AdminUser, role: string) => void;
  onRevokeRole: (admin: AdminUser, role: string) => void;
  onToggleStatus: (admin: AdminUser) => void;
};

const AdminRow = memo(({ admin, isPending, canManageRoles, onGrantRole, onRevokeRole, onToggleStatus }: AdminRowProps) => {
  const effectiveRoles = normalizeAdminRoles(admin.roles);
  const isActive = admin.status === 'active';
  const isBossAccount = hasRole(effectiveRoles, BOSS_ROLE);
  const disableLabel = isActive ? '禁用账号' : '启用账号';

  return (
    <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30">
      <td className="px-4 py-3">
        <p className="font-medium text-text-primary-light dark:text-text-primary-dark">{admin.displayName}</p>
        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{admin.id}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {effectiveRoles.length > 0 ? effectiveRoles.map((role) => (
            <span
              className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-blue-900/30 dark:text-blue-300"
              key={`${admin.id}-${role}`}
            >
              {getRoleLabel(role)}
            </span>
          )) : <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">未设置</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{admin.status}</td>
      <td className="px-4 py-3 text-xs text-text-secondary-light dark:text-text-secondary-dark">{formatDateTime(admin.updatedAt || admin.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {ADMIN_ROLE_BLOCKS.map((role) => {
            const assigned = hasRole(effectiveRoles, role);
            const canGrant = canManageRoles && !assigned;
            const canRemove = role === BOSS_ROLE && canManageRoles && assigned;
            const removeTitle = role === ADMIN_ROLE ? '管理员是基础角色，不能直接移除' : undefined;
            const canToggle = canManageRoles && !isBossAccount;
            const toggleTitle = isBossAccount ? '老板账号不可禁用' : undefined;

            return (
              <RoleActionBlock
                canGrant={canGrant}
                canRemove={canRemove}
                canToggleStatus={canToggle}
                hasRoleAssigned={assigned}
                isPending={isPending}
                key={`${admin.id}-${role}-block`}
                onGrant={() => onGrantRole(admin, role)}
                onRemove={() => onRevokeRole(admin, role)}
                onToggleStatus={() => onToggleStatus(admin)}
                removeTitle={removeTitle}
                role={role}
                statusLabel={disableLabel}
                toggleTitle={toggleTitle}
              />
            );
          })}
        </div>
      </td>
    </tr>
  );
});

AdminRow.displayName = 'AdminRow';

type TableSkeletonBodyProps = {
  cols: number;
  rows?: number;
};

const TableSkeletonBody = ({ cols, rows = 5 }: TableSkeletonBodyProps) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr className="border-b border-border-light dark:border-border-dark" key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: cols }).map((__, colIndex) => (
            <td className="px-4 py-3" key={`skeleton-cell-${rowIndex}-${colIndex}`}>
              <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const UserOperationsPage = () => {
  const [activeTab, setActiveTab] = useState<UserOperationsTab>('customers');

  const [customerQueryInput, setCustomerQueryInput] = useState('');
  const [appliedCustomerQuery, setAppliedCustomerQuery] = useState('');
  const [ownerSalesFilter, setOwnerSalesFilter] = useState('');
  const [customerTagFilters, setCustomerTagFilters] = useState<string[]>([]);
  const [customerTagFilterOpen, setCustomerTagFilterOpen] = useState(false);
  const [customerTagFilterKeyword, setCustomerTagFilterKeyword] = useState('');

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
  const [mockAdminUsers, setMockAdminUsers] = useState<AdminUser[]>(buildMockAdminSeed);

  const [salesLoading, setSalesLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  const [tabMessages, setTabMessages] = useState<Record<UserOperationsTab, TabMessage>>({
    customers: { error: '', success: '' },
    staff: { error: '', success: '' },
    admins: { error: '', success: '' }
  });
  const [pendingCustomerActions, setPendingCustomerActions] = useState<Record<string, boolean>>({});
  const [pendingStaffActions, setPendingStaffActions] = useState<Record<string, boolean>>({});
  const [pendingAdminActions, setPendingAdminActions] = useState<Record<string, boolean>>({});
  const salesRequestVersion = useRef(0);
  const tagsRequestVersion = useRef(0);
  const customersRequestVersion = useRef(0);
  const staffRequestVersion = useRef(0);
  const adminRequestVersion = useRef(0);
  const customerTagFilterRef = useRef<HTMLDivElement | null>(null);

  const activeTags = useMemo(() => tags.filter((tag) => tag.active), [tags]);
  const currentSession = getCurrentSession();
  const permissionMap = normalizePermissionMap(currentSession?.permissions);
  const canManageRoles = hasPermission(permissionMap, 'rbac:manage', 'ALL');
  const canManageStaffStatus = hasPermission(permissionMap, 'staff:status_manage', 'ALL') || canManageRoles;
  const selectedCustomerTags = useMemo(
    () => tags.filter((tag) => customerTagFilters.includes(tag.id)),
    [customerTagFilters, tags]
  );
  const filteredTagOptions = useMemo(() => {
    const keyword = customerTagFilterKeyword.trim().toLowerCase();
    if (!keyword) {
      return activeTags;
    }
    return activeTags.filter((tag) => tag.name.toLowerCase().includes(keyword));
  }, [activeTags, customerTagFilterKeyword]);
  const activeSalesUserIds = useMemo(() => new Set(salesUsers.map((item) => item.id)), [salesUsers]);
  const customerInitialLoading = customersLoading && customers.length === 0;
  const staffInitialLoading = staffLoading && staffUsers.length === 0;
  const adminInitialLoading = adminLoading && adminUsers.length === 0;
  const customerRefreshing = customersLoading && customers.length > 0;
  const staffRefreshing = staffLoading && staffUsers.length > 0;
  const adminRefreshing = adminLoading && adminUsers.length > 0;

  const customerTotalPages = Math.max(1, Math.ceil(customerTotal / customerPageSize));
  const staffTotalPages = Math.max(1, Math.ceil(staffTotal / staffPageSize));
  const adminTotalPages = Math.max(1, Math.ceil(adminTotal / adminPageSize));

  const adminCountInMock = useMemo(() => {
    if (!isMockMode) {
      return null;
    }
    return mockAdminUsers.length;
  }, [mockAdminUsers]);

  const clearTabMessage = useCallback((tab: UserOperationsTab) => {
    setTabMessages((current) => ({
      ...current,
      [tab]: { error: '', success: '' }
    }));
  }, []);

  const setTabError = useCallback((tab: UserOperationsTab, message: string) => {
    setTabMessages((current) => ({
      ...current,
      [tab]: { error: message, success: '' }
    }));
  }, []);

  const setTabSuccess = useCallback((tab: UserOperationsTab, message: string) => {
    setTabMessages((current) => ({
      ...current,
      [tab]: { error: '', success: message }
    }));
  }, []);

  const toggleCustomerTagFilter = useCallback((tagId: string) => {
    setCustomerTagFilters((current) => {
      if (current.includes(tagId)) {
        return current.filter((item) => item !== tagId);
      }
      return [...current, tagId];
    });
    setCustomerPage(1);
  }, []);

  const clearCustomerTagFilters = useCallback(() => {
    setCustomerTagFilters([]);
    setCustomerPage(1);
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
        setTabError('customers', '加载小程序业务员列表失败，请稍后重试。');
        return;
      }
      setSalesUsers(normalizeSalesUsers(response.data));
    } catch {
      if (requestVersion !== salesRequestVersion.current) {
        return;
      }
      setSalesUsers([]);
      setTabError('customers', '加载小程序业务员列表失败，请稍后重试。');
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
        setTabError('customers', '加载客户标签失败，请稍后重试。');
        return;
      }
      setTags(normalizeTags(response.data));
    } catch {
      if (requestVersion !== tagsRequestVersion.current) {
        return;
      }
      setTags([]);
      setTabError('customers', '加载客户标签失败，请稍后重试。');
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
        setTabError('customers', '加载客户列表失败，请稍后重试。');
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
      setTabError('customers', '加载客户列表失败，请稍后重试。');
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
        setTabError('staff', '加载员工角色列表失败，请稍后重试。');
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
      setTabError('staff', '加载员工角色列表失败，请稍后重试。');
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
      if (!isMockMode && !canManageRoles) {
        if (requestVersion !== adminRequestVersion.current) {
          return;
        }
        setAdminUsers([]);
        setAdminTotal(0);
        return;
      }

      if (isMockMode) {
        const start = (adminPage - 1) * adminPageSize;
        const end = start + adminPageSize;
        if (requestVersion !== adminRequestVersion.current) {
          return;
        }
        setAdminUsers(mockAdminUsers.slice(start, end));
        setAdminTotal(mockAdminUsers.length);
        return;
      }

      const response = await fetchAdminUsers({
        page: adminPage,
        pageSize: adminPageSize
      });
      if (requestVersion !== adminRequestVersion.current) {
        return;
      }
      if (response.status !== 200) {
        setAdminUsers([]);
        setAdminTotal(0);
        setTabError('admins', '加载管理员列表失败，请稍后重试。');
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
      setTabError('admins', '加载管理员列表失败，请稍后重试。');
    } finally {
      if (requestVersion === adminRequestVersion.current) {
        setAdminLoading(false);
      }
    }
  }, [adminPage, adminPageSize, canManageRoles, mockAdminUsers]);

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

  useEffect(() => {
    if (!customerTagFilterOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (customerTagFilterRef.current?.contains(target)) {
        return;
      }
      setCustomerTagFilterOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [customerTagFilterOpen]);

  useEffect(() => {
    if (activeTab !== 'customers') {
      setCustomerTagFilterOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'admins' && !canManageRoles) {
      setActiveTab('staff');
    }
  }, [activeTab, canManageRoles]);

  useEffect(() => {
    if (!customerTagFilterOpen) {
      setCustomerTagFilterKeyword('');
    }
  }, [customerTagFilterOpen]);

  const handleApplyCustomerSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerTagFilterOpen(false);
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

  const setAdminPending = useCallback((adminId: string, pending: boolean) => {
    setPendingAdminActions((current) => {
      if (pending) {
        return {
          ...current,
          [adminId]: true
        };
      }
      const next = { ...current };
      delete next[adminId];
      return next;
    });
  }, []);

  const handlePromoteCustomerToSales = useCallback(async (customer: AdminCustomer) => {
    clearTabMessage('customers');
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
              phone: customer.phone || '-',
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

        setTabSuccess('customers', `已将「${customer.displayName}」设置为小程序业务员（mock）。`);
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
        setTabError('customers', '设置小程序业务员权限失败，请稍后重试。');
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

      setTabSuccess('customers', `已将「${customer.displayName}」设置为小程序业务员。`);
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
      setTabError('customers', '设置小程序业务员权限失败，请稍后重试。');
    } finally {
      setCustomerPending(customer.id, false);
    }
  }, [clearTabMessage, refreshStaffUsers, salesUsers, setCustomerPending, setMockSalesUsers, setMockStaffUsers, setTabError, setTabSuccess, staffUsers]);

  const handleGrantStaffRole = useCallback(async (staff: StaffUser, role: string) => {
    if (hasRole(staff.roles, role)) {
      return;
    }

    clearTabMessage('staff');
    setStaffPending(staff.id, true);
    const previousSales = salesUsers.find((item) => item.id === staff.id);
    const roleLabel = getRoleLabel(role);
    const nextRoles = appendRole(staff.roles, role);

    try {
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockStaffUsers((current) => current.map((item) => (
          item.id === staff.id
            ? { ...item, roles: nextRoles, updatedAt: now }
            : item
        )));
        if (role === SALES_ROLE) {
          setMockSalesUsers((current) => {
            const found = current.find((item) => item.id === staff.id);
            if (found) {
              return current.map((item) => (
                item.id === staff.id
                  ? { ...item, displayName: staff.displayName || item.displayName, status: 'active', roles: appendRole(item.roles, SALES_ROLE) }
                  : item
              ));
            }
            return [{
              id: staff.id,
              displayName: staff.displayName,
              phone: staff.phone || '-',
              status: 'active',
              roles: [SALES_ROLE]
            }, ...current];
          });
        }
        setTabSuccess('staff', `已授予「${staff.displayName}」${roleLabel}权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setStaffUsers((current) => current.map((item) => (
        item.id === staff.id ? { ...item, roles: nextRoles, updatedAt: optimisticUpdatedAt } : item
      )));
      if (role === SALES_ROLE) {
        setSalesUsers((current) => {
          const found = current.find((item) => item.id === staff.id);
          if (found) {
            return current.map((item) => (
              item.id === staff.id
                ? { ...item, displayName: staff.displayName || item.displayName, phone: staff.phone || item.phone, status: staff.status, roles: appendRole(item.roles, SALES_ROLE) }
                : item
            ));
          }
          return [{
            id: staff.id,
            displayName: staff.displayName,
            phone: staff.phone || '-',
            status: staff.status,
            roles: [SALES_ROLE]
          }, ...current];
        });
      }

      const response = await patchStaffRoles(staff.id, nextRoles);
      if (response.status !== 200) {
        setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
        if (role === SALES_ROLE) {
          setSalesUsers((current) => {
            const filtered = current.filter((item) => item.id !== staff.id);
            if (!previousSales) {
              return filtered;
            }
            return [previousSales, ...filtered];
          });
        }
        setTabError('staff', `授予${roleLabel}权限失败，请稍后重试。`);
        return;
      }

      const payload = (response.data || {}) as { status?: string; roles?: unknown; updatedAt?: string };
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedStatus = safeText(payload.status, staff.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setStaffUsers((current) => current.map((item) => (
        item.id === staff.id
          ? { ...item, roles: resolvedRoles.length > 0 ? resolvedRoles : nextRoles, status: resolvedStatus, updatedAt: resolvedUpdatedAt }
          : item
      )));

      if (role === SALES_ROLE) {
        setSalesUsers((current) => current.map((item) => (
          item.id === staff.id
            ? { ...item, displayName: staff.displayName || item.displayName, status: resolvedStatus, roles: resolvedRoles.length > 0 ? resolvedRoles : appendRole(item.roles, SALES_ROLE) }
            : item
        )));
      }

      setTabSuccess('staff', `已授予「${staff.displayName}」${roleLabel}权限。`);
    } catch {
      setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
      if (role === SALES_ROLE) {
        setSalesUsers((current) => {
          const filtered = current.filter((item) => item.id !== staff.id);
          if (!previousSales) {
            return filtered;
          }
          return [previousSales, ...filtered];
        });
      }
      setTabError('staff', `授予${roleLabel}权限失败，请稍后重试。`);
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [clearTabMessage, salesUsers, setMockSalesUsers, setMockStaffUsers, setStaffPending, setTabError, setTabSuccess]);

  const handleRevokeStaffRole = useCallback(async (staff: StaffUser, role: string) => {
    if (!hasRole(staff.roles, role)) {
      return;
    }
    if (staff.roles.length <= 1) {
      setTabError('staff', `该账号仅剩一个角色，无法直接移除${getRoleLabel(role)}。`);
      return;
    }

    clearTabMessage('staff');
    setStaffPending(staff.id, true);
    const previousSales = salesUsers.find((item) => item.id === staff.id);
    const roleLabel = getRoleLabel(role);
    const nextRoles = removeRole(staff.roles, role);

    try {
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockStaffUsers((current) => current.map((item) => (
          item.id === staff.id
            ? { ...item, roles: nextRoles, updatedAt: now }
            : item
        )));
        if (role === SALES_ROLE) {
          setMockSalesUsers((current) => current.filter((item) => item.id !== staff.id));
        }
        setTabSuccess('staff', `已移除「${staff.displayName}」${roleLabel}权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setStaffUsers((current) => current.map((item) => (
        item.id === staff.id ? { ...item, roles: nextRoles, updatedAt: optimisticUpdatedAt } : item
      )));
      if (role === SALES_ROLE) {
        setSalesUsers((current) => current.filter((item) => item.id !== staff.id));
      }

      const response = await patchStaffRoles(staff.id, nextRoles);
      if (response.status !== 200) {
        setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
        if (role === SALES_ROLE) {
          setSalesUsers((current) => {
            const filtered = current.filter((item) => item.id !== staff.id);
            if (!previousSales) {
              return filtered;
            }
            return [previousSales, ...filtered];
          });
        }
        setTabError('staff', `移除${roleLabel}权限失败，请稍后重试。`);
        return;
      }

      const payload = (response.data || {}) as { status?: string; roles?: unknown; updatedAt?: string };
      const resolvedRoles = normalizeRoleList(payload.roles);
      const resolvedStatus = safeText(payload.status, staff.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setStaffUsers((current) => current.map((item) => (
        item.id === staff.id
          ? { ...item, roles: resolvedRoles.length > 0 ? resolvedRoles : nextRoles, status: resolvedStatus, updatedAt: resolvedUpdatedAt }
          : item
      )));
      setTabSuccess('staff', `已移除「${staff.displayName}」${roleLabel}权限。`);
    } catch {
      setStaffUsers((current) => current.map((item) => (item.id === staff.id ? staff : item)));
      if (role === SALES_ROLE) {
        setSalesUsers((current) => {
          const filtered = current.filter((item) => item.id !== staff.id);
          if (!previousSales) {
            return filtered;
          }
          return [previousSales, ...filtered];
        });
      }
      setTabError('staff', `移除${roleLabel}权限失败，请稍后重试。`);
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [clearTabMessage, salesUsers, setMockSalesUsers, setMockStaffUsers, setStaffPending, setTabError, setTabSuccess]);

  const handleToggleStaffStatus = useCallback(async (staff: StaffUser) => {
    clearTabMessage('staff');
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
        setTabSuccess('staff', nextStatus === 'active'
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
        setTabError('staff', '更新账号状态失败，请稍后重试。');
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

      setTabSuccess('staff', nextStatus === 'active' ? `已启用「${staff.displayName}」账号。` : `已禁用「${staff.displayName}」账号。`);
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
      setTabError('staff', '更新账号状态失败，请稍后重试。');
    } finally {
      setStaffPending(staff.id, false);
    }
  }, [clearTabMessage, setMockSalesUsers, setMockStaffUsers, setStaffPending, setTabError, setTabSuccess]);

  const handleGrantAdminRole = useCallback(async (admin: AdminUser, role: string) => {
    if (hasRole(admin.roles, role)) {
      return;
    }

    clearTabMessage('admins');
    setAdminPending(admin.id, true);
    const roleLabel = getRoleLabel(role);
    const nextRoles = appendAdminRole(admin.roles, role);

    try {
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockAdminUsers((current) => current.map((item) => (
          item.id === admin.id ? { ...item, roles: nextRoles, updatedAt: now } : item
        )));
        setTabSuccess('admins', `已授予「${admin.displayName}」${roleLabel}权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id ? { ...item, roles: nextRoles, updatedAt: optimisticUpdatedAt } : item
      )));
      const response = await patchAdminUser(admin.id, { roles: nextRoles });
      if (response.status !== 200) {
        setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
        setTabError('admins', `授予${roleLabel}权限失败，请稍后重试。`);
        return;
      }

      const payload = (response.data || {}) as { status?: string; roles?: unknown; updatedAt?: string };
      const resolvedRoles = normalizeAdminRoles(normalizeRoleList(payload.roles).length > 0 ? normalizeRoleList(payload.roles) : nextRoles);
      const resolvedStatus = safeText(payload.status, admin.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id
          ? { ...item, roles: resolvedRoles, status: resolvedStatus, updatedAt: resolvedUpdatedAt }
          : item
      )));
      setTabSuccess('admins', `已授予「${admin.displayName}」${roleLabel}权限。`);
    } catch {
      setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
      setTabError('admins', `授予${roleLabel}权限失败，请稍后重试。`);
    } finally {
      setAdminPending(admin.id, false);
    }
  }, [clearTabMessage, setAdminPending, setTabError, setTabSuccess]);

  const handleRevokeAdminRole = useCallback(async (admin: AdminUser, role: string) => {
    if (!hasRole(admin.roles, role)) {
      return;
    }

    clearTabMessage('admins');
    setAdminPending(admin.id, true);
    const roleLabel = getRoleLabel(role);
    const nextRoles = removeAdminRole(admin.roles, role);

    try {
      if (isMockMode) {
        const now = new Date().toISOString();
        setMockAdminUsers((current) => current.map((item) => (
          item.id === admin.id ? { ...item, roles: nextRoles, updatedAt: now } : item
        )));
        setTabSuccess('admins', `已移除「${admin.displayName}」${roleLabel}权限（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id ? { ...item, roles: nextRoles, updatedAt: optimisticUpdatedAt } : item
      )));
      const response = await patchAdminUser(admin.id, { roles: nextRoles });
      if (response.status !== 200) {
        setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
        setTabError('admins', `移除${roleLabel}权限失败，请稍后重试。`);
        return;
      }

      const payload = (response.data || {}) as { status?: string; roles?: unknown; updatedAt?: string };
      const resolvedRoles = normalizeAdminRoles(normalizeRoleList(payload.roles).length > 0 ? normalizeRoleList(payload.roles) : nextRoles);
      const resolvedStatus = safeText(payload.status, admin.status).toLowerCase();
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id
          ? { ...item, roles: resolvedRoles, status: resolvedStatus, updatedAt: resolvedUpdatedAt }
          : item
      )));
      setTabSuccess('admins', `已移除「${admin.displayName}」${roleLabel}权限。`);
    } catch {
      setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
      setTabError('admins', `移除${roleLabel}权限失败，请稍后重试。`);
    } finally {
      setAdminPending(admin.id, false);
    }
  }, [clearTabMessage, setAdminPending, setTabError, setTabSuccess]);

  const handleToggleAdminStatus = useCallback(async (admin: AdminUser) => {
    clearTabMessage('admins');
    setAdminPending(admin.id, true);

    try {
      const nextStatus = admin.status === 'active' ? 'disabled' : 'active';
      if (isMockMode) {
        if (hasRole(admin.roles, BOSS_ROLE)) {
          setTabError('admins', '老板账号不可禁用。');
          return;
        }
        const now = new Date().toISOString();
        setMockAdminUsers((current) => current.map((item) => (
          item.id === admin.id ? { ...item, status: nextStatus, updatedAt: now } : item
        )));
        setTabSuccess('admins', nextStatus === 'active' ? `已启用「${admin.displayName}」账号（mock）。` : `已禁用「${admin.displayName}」账号（mock）。`);
        return;
      }

      const optimisticUpdatedAt = new Date().toISOString();
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id ? { ...item, status: nextStatus, updatedAt: optimisticUpdatedAt } : item
      )));
      const response = await patchAdminUser(admin.id, {
        status: nextStatus,
        disabledReason: nextStatus === 'disabled' ? '由用户运营中心禁用' : null
      });
      if (response.status !== 200) {
        setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
        setTabError('admins', '更新管理员账号状态失败，请稍后重试。');
        return;
      }

      const payload = (response.data || {}) as { status?: string; roles?: unknown; updatedAt?: string };
      const resolvedStatus = safeText(payload.status, nextStatus).toLowerCase();
      const resolvedRoles = normalizeAdminRoles(normalizeRoleList(payload.roles).length > 0 ? normalizeRoleList(payload.roles) : admin.roles);
      const resolvedUpdatedAt = safeText(payload.updatedAt, optimisticUpdatedAt);
      setAdminUsers((current) => current.map((item) => (
        item.id === admin.id
          ? { ...item, status: resolvedStatus, roles: resolvedRoles, updatedAt: resolvedUpdatedAt }
          : item
      )));
      setTabSuccess('admins', nextStatus === 'active' ? `已启用「${admin.displayName}」账号。` : `已禁用「${admin.displayName}」账号。`);
    } catch {
      setAdminUsers((current) => current.map((item) => (item.id === admin.id ? admin : item)));
      setTabError('admins', '更新管理员账号状态失败，请稍后重试。');
    } finally {
      setAdminPending(admin.id, false);
    }
  }, [clearTabMessage, setAdminPending, setTabError, setTabSuccess]);

  const customersMessage = tabMessages.customers;
  const staffMessage = tabMessages.staff;
  const adminsMessage = tabMessages.admins;

  const renderCustomerPanel = () => {
    return (
      <section className="space-y-4">
        <form className="grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark lg:grid-cols-[minmax(260px,1.2fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto]" onSubmit={handleApplyCustomerSearch}>
          <input
            className="h-11 rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => setCustomerQueryInput(event.currentTarget.value)}
            placeholder="搜索客户名称、手机号或 ID"
            value={customerQueryInput}
          />
          <select
            className="h-11 rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => {
              setOwnerSalesFilter(event.currentTarget.value);
              setCustomerPage(1);
            }}
            value={ownerSalesFilter}
          >
            <option value="">全部小程序业务员</option>
            {salesUsers.map((sales) => (
              <option key={sales.id} value={sales.id}>{sales.displayName}</option>
            ))}
          </select>
          <div className="relative" ref={customerTagFilterRef}>
            <button
              className="flex h-11 w-full items-center justify-between rounded-lg border border-border-light bg-background-light px-3 text-sm text-text-primary-light transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
              onClick={() => setCustomerTagFilterOpen((current) => !current)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                {selectedCustomerTags.length === 0 ? (
                  <span className="truncate text-text-secondary-light dark:text-text-secondary-dark">全部标签</span>
                ) : (
                  selectedCustomerTags.slice(0, 2).map((tag) => (
                    <span
                      className="max-w-[80px] truncate rounded px-2 py-0.5 text-xs font-medium text-white"
                      key={`selected-tag-${tag.id}`}
                      style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }}
                    >
                      {tag.name}
                    </span>
                  ))
                )}
                {selectedCustomerTags.length > 2 ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-text-secondary-light dark:bg-slate-700 dark:text-text-secondary-dark">
                    +{selectedCustomerTags.length - 2}
                  </span>
                ) : null}
              </span>
              <span className="ml-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">{customerTagFilterOpen ? '收起' : '展开'}</span>
            </button>

            {customerTagFilterOpen ? (
              <div className="absolute z-30 mt-2 w-full min-w-[240px] rounded-lg border border-border-light bg-surface-light p-3 shadow-lg dark:border-border-dark dark:bg-surface-dark">
                <input
                  className="mb-2 h-9 w-full rounded border-border-light bg-background-light px-2 text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
                  onChange={(event) => setCustomerTagFilterKeyword(event.currentTarget.value)}
                  placeholder="搜索标签"
                  value={customerTagFilterKeyword}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {tagsLoading ? <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">标签加载中...</p> : null}
                  {!tagsLoading && filteredTagOptions.length === 0 ? (
                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">未匹配到标签</p>
                  ) : null}
                  {!tagsLoading ? filteredTagOptions.map((tag) => (
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-text-primary-light hover:bg-gray-100 dark:text-text-primary-dark dark:hover:bg-gray-800/60" key={`tag-option-${tag.id}`}>
                      <input
                        checked={customerTagFilters.includes(tag.id)}
                        onChange={() => toggleCustomerTagFilter(tag.id)}
                        type="checkbox"
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color || DEFAULT_TAG_COLOR }} />
                      <span className="truncate">{tag.name}</span>
                    </label>
                  )) : null}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    className="text-xs text-text-secondary-light transition-colors hover:text-primary dark:text-text-secondary-dark dark:hover:text-blue-300"
                    onClick={clearCustomerTagFilters}
                    type="button"
                  >
                    清空筛选
                  </button>
                  <button
                    className="text-xs text-text-secondary-light transition-colors hover:text-primary dark:text-text-secondary-dark dark:hover:text-blue-300"
                    onClick={() => setCustomerTagFilterOpen(false)}
                    type="button"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <button
            className="h-11 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 lg:w-12 lg:min-w-12 lg:px-0"
            disabled={customersLoading}
            type="submit"
          >
            {customersLoading ? '...' : '查询'}
          </button>
        </form>

        {customersMessage.error ? <p className="text-sm text-red-600" data-testid="user-operations-error">{customersMessage.error}</p> : null}
        {customersMessage.success ? <p className="text-sm text-emerald-600" data-testid="user-operations-success">{customersMessage.success}</p> : null}

        <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
            <div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">客户信息</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {customerTotal} 位客户</p>
            </div>
            <div className="flex items-center gap-2">
              {customerRefreshing ? <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">刷新中...</span> : null}
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
                {isMockMode ? 'mock' : 'dev'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
                <tr>
                  <th className="px-4 py-3">客户</th>
                  <th className="px-4 py-3">归属小程序业务员</th>
                  <th className="px-4 py-3">标签</th>
                  <th className="px-4 py-3">创建时间</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {customerInitialLoading ? <TableSkeletonBody cols={5} /> : customers.map((customer) => (
                  <CustomerRow
                    customer={customer}
                    isPending={Boolean(pendingCustomerActions[customer.id])}
                    isSales={activeSalesUserIds.has(customer.id)}
                    key={customer.id}
                    onPromoteToSales={handlePromoteCustomerToSales}
                  />
                ))}

                {!customerInitialLoading && !customersLoading && customers.length === 0 ? (
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
        <form className="grid grid-cols-1 gap-3 rounded-xl border border-border-light bg-surface-light p-4 dark:border-border-dark dark:bg-surface-dark lg:grid-cols-[minmax(320px,1fr)_auto]" onSubmit={handleApplyStaffSearch}>
          <input
            className="h-11 rounded-lg border-border-light bg-background-light text-sm text-text-primary-light focus:border-primary focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-text-primary-dark"
            onChange={(event) => setStaffQueryInput(event.currentTarget.value)}
            placeholder="搜索员工姓名、手机号、ID 或角色"
            value={staffQueryInput}
          />
          <button
            className="h-11 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 lg:w-12 lg:min-w-12 lg:px-0"
            disabled={staffLoading}
            type="submit"
          >
            {staffLoading ? '...' : '查询'}
          </button>
        </form>

        {staffMessage.error ? <p className="text-sm text-red-600" data-testid="staff-operations-error">{staffMessage.error}</p> : null}
        {staffMessage.success ? <p className="text-sm text-emerald-600" data-testid="staff-operations-success">{staffMessage.success}</p> : null}

        <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
            <div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">员工角色与账号信息</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {staffTotal} 位员工</p>
            </div>
            <div className="flex items-center gap-2">
              {staffRefreshing ? <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">刷新中...</span> : null}
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
                {isMockMode ? 'mock' : 'dev'}
              </span>
            </div>
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
                {staffInitialLoading ? <TableSkeletonBody cols={5} /> : staffUsers.map((staff) => (
                  <StaffRow
                    canManageRoles={canManageRoles}
                    canToggleStatus={canManageStaffStatus}
                    isPending={Boolean(pendingStaffActions[staff.id])}
                    key={staff.id}
                    onGrantRole={handleGrantStaffRole}
                    onRevokeRole={handleRevokeStaffRole}
                    onToggleStatus={handleToggleStaffStatus}
                    staff={staff}
                  />
                ))}
                {!staffInitialLoading && !staffLoading && staffUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5}>
                      暂无员工数据
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
      <section className="space-y-3">
        {adminsMessage.error ? <p className="text-sm text-red-600" data-testid="admin-operations-error">{adminsMessage.error}</p> : null}
        {adminsMessage.success ? <p className="text-sm text-emerald-600" data-testid="admin-operations-success">{adminsMessage.success}</p> : null}

        <section className="overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm dark:border-border-dark dark:bg-surface-dark">
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark">
            <div>
              <p className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">管理员用户</p>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">共 {adminTotal} 位管理员</p>
            </div>
            <div className="flex items-center gap-2">
              {adminRefreshing ? <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">刷新中...</span> : null}
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-primary dark:bg-blue-900/40 dark:text-blue-300">
                {isMockMode ? 'mock' : 'dev'}
              </span>
            </div>
          </div>

        <div className="overflow-x-auto" style={{ contentVisibility: 'auto' }}>
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border-light bg-gray-50 text-xs font-semibold text-text-secondary-light dark:border-border-dark dark:bg-gray-800/60 dark:text-text-secondary-dark">
              <tr>
                <th className="px-4 py-3">管理员</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {adminInitialLoading ? <TableSkeletonBody cols={5} /> : adminUsers.map((admin) => (
                <AdminRow
                  admin={admin}
                  canManageRoles={canManageRoles}
                  isPending={Boolean(pendingAdminActions[admin.id])}
                  key={admin.id}
                  onGrantRole={handleGrantAdminRole}
                  onRevokeRole={handleRevokeAdminRole}
                  onToggleStatus={handleToggleAdminStatus}
                />
              ))}
              {!adminInitialLoading && !adminLoading && adminUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark" colSpan={5}>
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
              支持客户提权为小程序业务员，并支持员工角色与管理员能力管理
            </p>
          </div>
        )}
        searchPlaceholder="搜索客户或员工"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
          可在客户页将客户设置为小程序业务员；在员工角色页统一授予/移除 SALES、CS、MANAGER；在管理员页管理 ADMIN 与 BOSS。带有 BOSS 的账号不可禁用。
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border-light bg-surface-light p-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">客户总量</p>
            <p className="mt-1 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">{customerTotal}</p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-light p-3 text-sm dark:border-border-dark dark:bg-surface-dark">
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">员工总量</p>
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
            员工角色
          </button>
          {canManageRoles ? (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'admins' ? 'bg-primary text-white' : 'text-text-secondary-light hover:bg-gray-100 dark:text-text-secondary-dark dark:hover:bg-gray-800'}`}
              data-testid="tab-admins"
              onClick={() => setActiveTab('admins')}
              type="button"
            >
              管理员
            </button>
          ) : null}
        </div>

        {activeTab === 'customers'
          ? renderCustomerPanel()
          : activeTab === 'staff'
            ? renderStaffPanel()
            : renderAdminPanel()}
      </div>
    </main>
  );
};
