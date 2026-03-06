import { useEffect, useMemo, useState } from 'react';

import { fetchAdminSummary, fetchInquiries, fetchOrders, fetchProductRequests } from '../../../lib/api';
import { getCurrentSession } from '../../../lib/auth';
import { ensureProtectedPage } from '../../../lib/guard';
import { hasPermission, normalizePermissionMap, resolveAccessTier } from '../../../lib/permissions';
import { AdminTopbar } from '../../layout/AdminTopbar';

type PageContext = {
  mode: 'dev' | 'mock';
  session?: {
    currentRole?: string;
    permissions?: {
      items?: Array<{ code?: string; scope?: string }>;
    };
    user?: {
      roles?: string[];
    };
  };
} | null;

type SummaryPayload = {
  featureFlags?: {
    paymentEnabled?: boolean;
    wechatPayEnabled?: boolean;
    alipayPayEnabled?: boolean;
  };
  generatedAt?: string;
  metrics?: {
    inquiriesOpen?: number;
    inquiriesTotal?: number;
    ordersPending?: number;
    ordersTotal?: number;
    productsTotal?: number;
  };
  warningLabels?: string[];
  warnings?: string[];
};

type ActivityRow = {
  action: string;
  status: string;
  time: string;
  user: string;
};

type SummaryCard = {
  key: string;
  label: string;
  value: string | number;
};

type TieredSummaryCard = SummaryCard & {
  tiers: string[];
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const STATUS_BADGE_CLASS: Record<string, string> = {
  CANCELLED: 'bg-red-100 text-red-700',
  CLOSED: 'bg-slate-200 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  OPEN: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  RESPONDED: 'bg-emerald-100 text-emerald-700',
  RUNNING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-cyan-100 text-cyan-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  SUCCEEDED: 'bg-emerald-100 text-emerald-700'
};

const STATUS_LABELS: Record<string, string> = {
  CANCELLED: '已取消',
  CLOSED: '已关闭',
  CONFIRMED: '已确认',
  DELIVERED: '已送达',
  FAILED: '失败',
  OPEN: '开放',
  PAID: '已支付',
  PENDING: '待处理',
  RESPONDED: '已回复',
  RUNNING: '运行中',
  SHIPPED: '已发货',
  SUBMITTED: '已提交',
  SUCCEEDED: '成功',
  UNKNOWN: '未知'
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleString('zh-CN');
};

const safeText = (value: unknown, fallback = '--') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
};

const buildRows = (orders: unknown[], inquiries: unknown[], requests: unknown[]): ActivityRow[] => {
  const rows: ActivityRow[] = [];

  for (const item of orders.slice(0, 4)) {
    const order = item as {
      address?: { receiverName?: string };
      createdAt?: string;
      createdByUserId?: string;
      id?: string;
      status?: string;
      updatedAt?: string;
    };
    rows.push({
      action: `Order ${safeText(order.id)} status update`,
      user: safeText(order.address?.receiverName || order.createdByUserId, 'Customer'),
      time: String(order.updatedAt || order.createdAt || ''),
      status: safeText(order.status, 'UNKNOWN')
    });
  }

  for (const item of inquiries.slice(0, 3)) {
    const inquiry = item as {
      createdByUserId?: string;
      id?: string;
      status?: string;
      updatedAt?: string;
      createdAt?: string;
    };
    rows.push({
      action: `Inquiry ${safeText(inquiry.id)} follow-up`,
      user: safeText(inquiry.createdByUserId, 'Customer'),
      time: String(inquiry.updatedAt || inquiry.createdAt || ''),
      status: safeText(inquiry.status, 'OPEN')
    });
  }

  for (const item of requests.slice(0, 3)) {
    const request = item as {
      createdAt?: string;
      createdByUserId?: string;
      id?: string;
    };
    rows.push({
      action: `Product request ${safeText(request.id)}`,
      user: safeText(request.createdByUserId, 'Customer'),
      time: String(request.createdAt || ''),
      status: 'SUBMITTED'
    });
  }

  return rows.slice(0, 8);
};

const getWarningLabels = (summary: SummaryPayload | null) => {
  if (Array.isArray(summary?.warnings)) {
    return summary.warnings;
  }
  if (Array.isArray(summary?.warningLabels)) {
    return summary.warningLabels;
  }
  return [];
};

const buildSummaryCards = (summary: SummaryPayload | null, tier: string): SummaryCard[] => {
  if (!summary) {
    return [];
  }
  const metrics = summary.metrics || {};
  const flags = summary.featureFlags || {};
  const cards: TieredSummaryCard[] = [
    { key: 'products', label: 'Products', value: metrics.productsTotal ?? 0, tiers: ['boss'] },
    { key: 'orders', label: 'Orders', value: metrics.ordersTotal ?? 0, tiers: ['boss', 'manager', 'sales'] },
    { key: 'pendingOrders', label: 'Pending Orders', value: metrics.ordersPending ?? 0, tiers: ['boss', 'manager', 'sales'] },
    { key: 'inquiriesTotal', label: 'Inquiries Total', value: metrics.inquiriesTotal ?? 0, tiers: ['boss', 'manager'] },
    { key: 'inquiriesOpen', label: 'Inquiries Open', value: metrics.inquiriesOpen ?? 0, tiers: ['boss', 'manager', 'sales'] }
  ];

  const filtered = cards.filter((item) => item.tiers.includes(tier)).map(({ tiers, ...item }) => item);
  if (tier === 'boss') {
    filtered.push({
      key: 'featureFlags',
      label: 'Feature Flags',
      value: `pay:${flags.paymentEnabled ? 'on' : 'off'} wx:${flags.wechatPayEnabled ? 'on' : 'off'} ali:${flags.alipayPayEnabled ? 'on' : 'off'}`
    });
  }
  return filtered;
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = safeText(status, 'UNKNOWN').toUpperCase();
  const className = STATUS_BADGE_CLASS[normalized] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {STATUS_LABELS[normalized] || normalized}
    </span>
  );
};

const DashboardSkeleton = () => {
  return (
    <div className="mx-auto max-w-7xl animate-pulse" data-testid="dashboard-page-loading">
      <div className="mb-8 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800" key={`dashboard-skeleton-card-${index}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-96 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-96 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
};

const LiveDashboardView = ({
  activityRows,
  errorMessage,
  loadState,
  summary,
  tier
}: {
  activityRows: ActivityRow[];
  errorMessage: string;
  loadState: LoadState;
  summary: SummaryPayload | null;
  tier: string;
}) => {
  const summaryCards = useMemo(() => buildSummaryCards(summary, tier), [summary, tier]);
  const warnings = useMemo(() => getWarningLabels(summary), [summary]);

  return (
    <div className="mx-auto max-w-7xl" data-testid="dashboard-page-live">
      <section className="mb-6">
        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <h3 className="text-sm font-semibold text-red-800">请求错误</h3>
            <p className="mt-2 text-sm">{errorMessage}</p>
            <p className="mt-1 text-xs text-red-600">请求失败，请稍后重试。</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Live Dashboard Summary</h2>
            <p className="text-sm text-slate-500">All values are from backend endpoints in dev mode.</p>
          </div>
          <p className="text-xs text-slate-500">updated: {formatDateTime(summary?.generatedAt)}</p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {summaryCards.length > 0 ? summaryCards.map((item) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={item.key}>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`${item.key === 'featureFlags' ? 'mt-1 text-xs font-semibold text-slate-800' : 'mt-1 text-lg font-bold text-slate-900'}`}>
                {item.value}
              </p>
            </div>
          )) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700 sm:col-span-2 xl:col-span-6">
              <h3 className="text-sm font-semibold text-slate-900">Summary unavailable</h3>
              <p className="mt-2 text-sm text-slate-500">
                {loadState === 'error' ? 'Summary endpoint failed.' : '暂无实时数据。'}
              </p>
            </div>
          )}
        </div>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Warnings</p>
            <p className="mt-1">{warnings.join(', ')}</p>
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="text-base font-semibold text-slate-900">Recent Activity (Live)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityRows.length > 0 ? activityRows.map((row, index) => (
                  <tr className="hover:bg-slate-50" key={`${row.action}-${row.time}-${index}`}>
                    <td className="px-6 py-4 font-medium text-slate-900">{row.action}</td>
                    <td className="px-6 py-4">{row.user}</td>
                    <td className="px-6 py-4">{formatDateTime(row.time)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td className="px-6 py-5" colSpan={4}>No live records available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
            <h3 className="text-sm font-semibold text-slate-900">Role-based Access</h3>
            <p className="mt-2 text-sm text-slate-500">
              No dedicated RBAC analytics endpoint is wired for dashboard cards in dev mode.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
            <h3 className="text-sm font-semibold text-slate-900">Pending Import Tasks</h3>
            <p className="mt-2 text-sm text-slate-500">
              Use the Logistics page to query real import jobs by job ID.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

const StaticDashboardView = () => {
  return (
    <div className="mx-auto max-w-7xl" data-testid="dashboard-page-static">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">System Overview</h2>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <span className="material-symbols-outlined text-[20px]">download</span>
            Export Report
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Task
          </button>
        </div>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <span className="material-symbols-outlined">shopping_bag</span>
            </div>
            <span className="flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">+2.5%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">$48,294</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">+1.2%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Active Users</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">2,405</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <span className="flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">-0.4%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Pending Orders</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">142</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <span className="material-symbols-outlined">verified</span>
            </div>
            <span className="flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">+8.1%</span>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed Tasks</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">89%</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">System Audit Logs</h3>
              <a className="text-sm font-medium text-primary hover:text-primary/80" href="#">View all</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3" scope="col">Action</th>
                    <th className="px-6 py-3" scope="col">User</th>
                    <th className="px-6 py-3" scope="col">Date</th>
                    <th className="px-6 py-3" scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Updated Pricing Rules</td>
                    <td className="px-6 py-4">Sarah J.</td>
                    <td className="px-6 py-4">Oct 24, 2023</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">Success</span></td>
                  </tr>
                  <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Bulk Product Import</td>
                    <td className="px-6 py-4">Mike R.</td>
                    <td className="px-6 py-4">Oct 24, 2023</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400">Pending</span></td>
                  </tr>
                  <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">Deleted User #4022</td>
                    <td className="px-6 py-4">Alex M.</td>
                    <td className="px-6 py-4">Oct 23, 2023</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400">Success</span></td>
                  </tr>
                  <tr className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">API Key Regeneration</td>
                    <td className="px-6 py-4">System</td>
                    <td className="px-6 py-4">Oct 23, 2023</td>
                    <td className="px-6 py-4"><span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10 dark:bg-red-900/20 dark:text-red-400">Failed</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Pending Import Tasks</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary dark:bg-blue-900/30 dark:text-blue-400">
                  <span className="material-symbols-outlined">table_chart</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900 dark:text-white">Q3 Product Catalog Update.csv</h4>
                    <span className="text-xs text-slate-500">2 mins ago</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Parsing 2,400 rows. Estimated time: 45s</p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full w-[65%] rounded-full bg-primary" />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <span className="material-symbols-outlined">imagesmode</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900 dark:text-white">Supplier_Images_Batch_2.zip</h4>
                    <span className="text-xs text-slate-500">15 mins ago</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Queued for processing.</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex h-2 w-2 rounded-full bg-yellow-400" />
                    Waiting for worker node
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-white">Role-based Access</h3>
            <div className="relative flex items-center justify-center py-6">
              <div className="relative h-48 w-48 rounded-full border-[16px] border-slate-100 dark:border-slate-800">
                <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path className="text-primary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="70, 100" strokeWidth={3} />
                  <path className="text-purple-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="20, 100" strokeDashoffset={-70} strokeWidth={3} />
                  <path className="text-teal-400" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="10, 100" strokeDashoffset={-90} strokeWidth={3} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">124</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Total Roles</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Administrators</span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">70%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-purple-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vendors</span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">20%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-teal-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Viewers</span>
                </div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">10%</span>
              </div>
            </div>
            <button className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
              Manage Permissions
            </button>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-primary to-blue-700 p-6 text-white shadow-lg">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <span className="material-symbols-outlined">support_agent</span>
            </div>
            <h3 className="text-lg font-bold">Need Help?</h3>
            <p className="mt-2 text-sm text-blue-100">Contact our support team for assistance with roles or imports.</p>
            <button className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-blue-50">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage = () => {
  const [context, setContext] = useState<PageContext>(null);
  const [ready, setReady] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void ensureProtectedPage().then((resolved) => {
      if (cancelled) {
        return;
      }
      setContext((resolved || null) as PageContext);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const session = context?.session || getCurrentSession() || null;
  const permissionMap = useMemo(() => normalizePermissionMap(session?.permissions), [session?.permissions]);
  const tier = useMemo(() => resolveAccessTier(session), [session]);
  const canReadOrders = hasPermission(permissionMap, 'order:read');
  const canReadInquiries = hasPermission(permissionMap, 'inquiry:read') || hasPermission(permissionMap, 'inquiry:manage');
  const canReadRequests = hasPermission(permissionMap, 'product_request:read');

  useEffect(() => {
    if (!context || context.mode !== 'dev') {
      return;
    }

    let cancelled = false;

    const loadLiveDashboard = async () => {
      setLoadState('loading');
      setErrorMessage('');

      const [summaryResult, ordersResult, inquiriesResult, requestsResult] = await Promise.allSettled([
        fetchAdminSummary(),
        canReadOrders ? fetchOrders({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } }),
        canReadInquiries ? fetchInquiries({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } }),
        canReadRequests ? fetchProductRequests({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } })
      ]);

      if (cancelled) {
        return;
      }

      const summaryResp = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
      const ordersResp = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const inquiriesResp = inquiriesResult.status === 'fulfilled' ? inquiriesResult.value : null;
      const requestsResp = requestsResult.status === 'fulfilled' ? requestsResult.value : null;

      if (summaryResp?.status === 200 && summaryResp.data) {
        setSummary(summaryResp.data as SummaryPayload);
        setLoadState('ready');
      } else {
        setSummary(null);
        setLoadState('error');
        setErrorMessage('Failed to load /bff/admin/summary');
      }

      const orders = ordersResp?.status === 200 && Array.isArray((ordersResp.data as { items?: unknown[] })?.items)
        ? ((ordersResp.data as { items?: unknown[] }).items as unknown[])
        : [];
      const inquiries = inquiriesResp?.status === 200 && Array.isArray((inquiriesResp.data as { items?: unknown[] })?.items)
        ? ((inquiriesResp.data as { items?: unknown[] }).items as unknown[])
        : [];
      const requests = requestsResp?.status === 200 && Array.isArray((requestsResp.data as { items?: unknown[] })?.items)
        ? ((requestsResp.data as { items?: unknown[] }).items as unknown[])
        : [];
      setActivityRows(buildRows(orders, inquiries, requests));
    };

    void loadLiveDashboard();

    return () => {
      cancelled = true;
    };
  }, [canReadInquiries, canReadOrders, canReadRequests, context]);

  return (
    <>
      <div>
        <AdminTopbar
          searchPlaceholder="搜索订单、商品..."
          leftSlot={<div className="text-sm font-semibold text-slate-900 dark:text-white">Dashboard</div>}
        />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background-light p-6 dark:bg-background-dark">
          {!ready ? <DashboardSkeleton /> : context?.mode === 'dev'
            ? <LiveDashboardView activityRows={activityRows} errorMessage={errorMessage} loadState={loadState} summary={summary} tier={tier} />
            : <StaticDashboardView />}
        </main>
      </div>
    </>
  );
};
