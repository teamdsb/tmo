import { fetchAdminSummary, fetchInquiries, fetchOrders, fetchProductRequests } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { installZhLocalization } from './lib/i18n-zh';
import { normalizePermissionMap, resolveAccessTier } from './lib/permissions';
import {
  buildEmptyState,
  buildErrorState,
  escape,
  formatDateTime,
  safeText,
  toStatusBadge
} from './lib/render';

const buildRows = (orders, inquiries, requests) => {
  const rows = [];

  for (const order of orders.slice(0, 4)) {
    rows.push({
      action: `Order ${safeText(order.id)} status update`,
      user: order.address?.receiverName || order.createdByUserId || 'Customer',
      time: order.updatedAt || order.createdAt,
      status: order.status || 'UNKNOWN'
    });
  }

  for (const inquiry of inquiries.slice(0, 3)) {
    rows.push({
      action: `Inquiry ${safeText(inquiry.id)} follow-up`,
      user: inquiry.createdByUserId || 'Customer',
      time: inquiry.updatedAt || inquiry.createdAt,
      status: inquiry.status || 'OPEN'
    });
  }

  for (const request of requests.slice(0, 3)) {
    rows.push({
      action: `Product request ${safeText(request.id)}`,
      user: request.createdByUserId || 'Customer',
      time: request.createdAt,
      status: 'SUBMITTED'
    });
  }

  return rows.slice(0, 8);
};

const mountDevLayout = (root) => {
  root.innerHTML = `
    <section class="mb-6" data-role="status"></section>

    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-slate-900">Live Dashboard Summary</h2>
          <p class="text-sm text-slate-500">All values are from backend endpoints in dev mode.</p>
        </div>
        <p class="text-xs text-slate-500" data-role="updated-at">updated: --</p>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6" data-role="summary-cards"></div>
      <div class="mt-4" data-role="warnings"></div>
    </section>

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section class="xl:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-6 py-4">
          <h3 class="text-base font-semibold text-slate-900">Recent Activity (Live)</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-6 py-3">Action</th>
                <th class="px-6 py-3">User</th>
                <th class="px-6 py-3">Date</th>
                <th class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100" data-role="activity-body"></tbody>
          </table>
        </div>
      </section>

      <section class="space-y-4" data-role="extra-panels"></section>
    </div>
  `;
};

const renderSummaryCards = (container, summary, tier) => {
  if (!container || !summary) {
    return;
  }

  const metrics = summary.metrics || {};
  const flags = summary.featureFlags || {};
  const cards = [
    { key: 'products', label: 'Products', value: metrics.productsTotal ?? 0, tiers: ['boss'] },
    { key: 'orders', label: 'Orders', value: metrics.ordersTotal ?? 0, tiers: ['boss', 'manager', 'sales'] },
    { key: 'pendingOrders', label: 'Pending Orders', value: metrics.ordersPending ?? 0, tiers: ['boss', 'manager', 'sales'] },
    { key: 'inquiriesTotal', label: 'Inquiries Total', value: metrics.inquiriesTotal ?? 0, tiers: ['boss', 'manager'] },
    { key: 'inquiriesOpen', label: 'Inquiries Open', value: metrics.inquiriesOpen ?? 0, tiers: ['boss', 'manager', 'sales'] }
  ];

  const filtered = cards.filter((item) => item.tiers.includes(tier));
  if (tier === 'boss') {
    filtered.push({
      key: 'featureFlags',
      label: 'Feature Flags',
      value: `pay:${flags.paymentEnabled ? 'on' : 'off'} wx:${flags.wechatPayEnabled ? 'on' : 'off'} ali:${flags.alipayPayEnabled ? 'on' : 'off'}`
    });
  }

  container.innerHTML = filtered.map((item) => {
    const valueHtml = item.key === 'featureFlags'
      ? `<p class="mt-1 text-xs font-semibold text-slate-800">${escape(item.value)}</p>`
      : `<p class="mt-1 text-lg font-bold text-slate-900">${escape(item.value)}</p>`;
    return `<div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">${escape(item.label)}</p>${valueHtml}</div>`;
  }).join('');
};

const renderWarnings = (container, summary) => {
  if (!container) {
    return;
  }
  const warnings = Array.isArray(summary?.warnings)
    ? summary.warnings
    : (Array.isArray(summary?.warningLabels) ? summary.warningLabels : []);

  if (warnings.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <p class="font-semibold">Warnings</p>
      <p class="mt-1">${escape(warnings.join(', '))}</p>
    </div>
  `;
};

const renderActivityRows = (tbody, rows) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td class="px-6 py-5" colspan="4">No live records available.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr class="hover:bg-slate-50">
      <td class="px-6 py-4 font-medium text-slate-900">${escape(safeText(row.action))}</td>
      <td class="px-6 py-4">${escape(safeText(row.user))}</td>
      <td class="px-6 py-4">${escape(formatDateTime(row.time))}</td>
      <td class="px-6 py-4">${toStatusBadge(row.status)}</td>
    </tr>
  `).join('');
};

const renderExtraPanels = (container) => {
  if (!container) {
    return;
  }

  container.innerHTML = [
    buildEmptyState('Role-based Access', 'No dedicated RBAC analytics endpoint is wired for dashboard cards in dev mode.'),
    buildEmptyState('Pending Import Tasks', 'Use the Logistics page to query real import jobs by job ID.')
  ].join('');
};

const initDashboard = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const root = document.querySelector('main .mx-auto.max-w-7xl');
  if (!root) {
    return;
  }

  mountDevLayout(root);

  const statusContainer = root.querySelector('[data-role="status"]');
  const updatedAt = root.querySelector('[data-role="updated-at"]');
  const summaryCards = root.querySelector('[data-role="summary-cards"]');
  const warningsContainer = root.querySelector('[data-role="warnings"]');
  const activityBody = root.querySelector('[data-role="activity-body"]');
  const extraPanels = root.querySelector('[data-role="extra-panels"]');

  const permissionMap = normalizePermissionMap(context.session?.permissions);
  const tier = resolveAccessTier(context.session);
  const canReadOrders = permissionMap.get('order:read');
  const canReadInquiries = permissionMap.get('inquiry:read') || permissionMap.get('inquiry:manage');
  const canReadRequests = permissionMap.get('product_request:read');

  const [summaryResult, ordersResult, inquiriesResult, requestsResult] = await Promise.allSettled([
    fetchAdminSummary(),
    canReadOrders ? fetchOrders({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } }),
    canReadInquiries ? fetchInquiries({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } }),
    canReadRequests ? fetchProductRequests({ page: 1, pageSize: 10 }) : Promise.resolve({ status: 200, data: { items: [] } })
  ]);

  const summaryResp = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const ordersResp = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
  const inquiriesResp = inquiriesResult.status === 'fulfilled' ? inquiriesResult.value : null;
  const requestsResp = requestsResult.status === 'fulfilled' ? requestsResult.value : null;

  if (summaryResp?.status === 200 && summaryResp.data) {
    renderSummaryCards(summaryCards, summaryResp.data, tier);
    renderWarnings(warningsContainer, summaryResp.data);
    if (updatedAt) {
      updatedAt.textContent = `updated: ${formatDateTime(summaryResp.data.generatedAt)}`;
    }
  } else {
    statusContainer.innerHTML = buildErrorState('Failed to load /bff/admin/summary');
    if (summaryCards) {
      summaryCards.innerHTML = buildEmptyState('Summary unavailable', 'Summary endpoint failed.');
    }
  }

  const orders = ordersResp?.status === 200 && Array.isArray(ordersResp.data?.items) ? ordersResp.data.items : [];
  const inquiries = inquiriesResp?.status === 200 && Array.isArray(inquiriesResp.data?.items) ? inquiriesResp.data.items : [];
  const requests = requestsResp?.status === 200 && Array.isArray(requestsResp.data?.items) ? requestsResp.data.items : [];

  renderActivityRows(activityBody, buildRows(orders, inquiries, requests));
  renderExtraPanels(extraPanels);
};

void initDashboard();
installZhLocalization();
