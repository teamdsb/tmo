import { fetchAdminSummary, fetchInquiries, fetchOrders, fetchProductRequests } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, formatDateTime, safeText, toStatusBadge } from './lib/render';

const renderLiveSummary = (summary) => {
  const mainContainer = document.querySelector('main .mx-auto.max-w-7xl');
  if (!mainContainer || !summary) {
    return;
  }

  const metrics = summary.metrics || {};
  const flags = summary.featureFlags || {};

  const panel = document.createElement('section');
  panel.className = 'mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-slate-800';
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h3 class="text-sm font-semibold uppercase tracking-wide text-blue-700">Live Backend Summary</h3>
        <p class="text-xs text-slate-600">Data from gateway admin summary endpoint</p>
      </div>
      <div class="text-xs text-slate-600">updated: ${escape(formatDateTime(summary.generatedAt || new Date().toISOString()))}</div>
    </div>
    <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
      <div class="rounded-lg bg-white p-3"><p class="text-xs text-slate-500">Products</p><p class="text-lg font-bold">${escape(metrics.productsTotal ?? 0)}</p></div>
      <div class="rounded-lg bg-white p-3"><p class="text-xs text-slate-500">Orders</p><p class="text-lg font-bold">${escape(metrics.ordersTotal ?? 0)}</p></div>
      <div class="rounded-lg bg-white p-3"><p class="text-xs text-slate-500">Pending Orders</p><p class="text-lg font-bold">${escape(metrics.ordersPending ?? 0)}</p></div>
      <div class="rounded-lg bg-white p-3"><p class="text-xs text-slate-500">Inquiries Open</p><p class="text-lg font-bold">${escape(metrics.inquiriesOpen ?? 0)}</p></div>
      <div class="rounded-lg bg-white p-3"><p class="text-xs text-slate-500">Feature Flags</p><p class="text-xs font-semibold">pay:${flags.paymentEnabled ? 'on' : 'off'} wx:${flags.wechatPayEnabled ? 'on' : 'off'} ali:${flags.alipayPayEnabled ? 'on' : 'off'}</p></div>
    </div>
  `;

  mainContainer.prepend(panel);
};

const renderAuditRows = (rows) => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    tbody.innerHTML = `
      <tr><td class="px-6 py-4 text-sm text-slate-500" colspan="4">No live audit-like records available.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr class="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
      <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${escape(safeText(row.action))}</td>
      <td class="px-6 py-4">${escape(safeText(row.user))}</td>
      <td class="px-6 py-4">${escape(formatDateTime(row.time))}</td>
      <td class="px-6 py-4">${toStatusBadge(row.status)}</td>
    </tr>
  `).join('');
};

const buildRows = (orders, inquiries, requests) => {
  const rows = [];

  for (const order of orders.slice(0, 3)) {
    rows.push({
      action: `Order ${order.id} status check`,
      user: order.address?.receiverName || order.createdByUserId || 'Customer',
      time: order.updatedAt || order.createdAt,
      status: order.status || 'UNKNOWN'
    });
  }

  for (const inquiry of inquiries.slice(0, 2)) {
    rows.push({
      action: `Inquiry ${inquiry.id} follow-up`,
      user: inquiry.createdByUserId || 'Customer',
      time: inquiry.updatedAt || inquiry.createdAt,
      status: inquiry.status || 'OPEN'
    });
  }

  for (const request of requests.slice(0, 2)) {
    rows.push({
      action: `Product request ${request.id}`,
      user: request.createdByUserId || 'Customer',
      time: request.createdAt,
      status: 'SUBMITTED'
    });
  }

  return rows;
};

const initDashboard = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const [summaryResp, ordersResp, inquiriesResp, requestsResp] = await Promise.all([
    fetchAdminSummary(),
    fetchOrders({ page: 1, pageSize: 10 }),
    fetchInquiries({ page: 1, pageSize: 10 }),
    fetchProductRequests({ page: 1, pageSize: 10 })
  ]);

  if (summaryResp.status === 200 && summaryResp.data) {
    renderLiveSummary(summaryResp.data);
  }

  const orders = ordersResp.status === 200 && Array.isArray(ordersResp.data?.items) ? ordersResp.data.items : [];
  const inquiries = inquiriesResp.status === 200 && Array.isArray(inquiriesResp.data?.items) ? inquiriesResp.data.items : [];
  const requests = requestsResp.status === 200 && Array.isArray(requestsResp.data?.items) ? requestsResp.data.items : [];

  renderAuditRows(buildRows(orders, inquiries, requests));
};

void initDashboard();
