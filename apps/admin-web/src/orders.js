import { fetchOrders } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import {
  buildEmptyState,
  escape,
  formatCurrencyFen,
  formatDate,
  renderErrorState,
  safeText,
  toStatusBadge
} from './lib/render';

const calcAmountFen = (order) => {
  if (!Array.isArray(order?.items)) {
    return 0;
  }
  return order.items.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const unit = Number(item.unitPriceFen || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
      return sum;
    }
    return sum + qty * unit;
  }, 0);
};

const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'NA';
  }
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const countByStatuses = (items, statuses) => {
  const set = new Set(statuses.map((status) => String(status).toUpperCase()));
  return items.filter((item) => set.has(String(item?.status || '').toUpperCase())).length;
};

const mountDevLayout = (main) => {
  main.innerHTML = `
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-bold text-slate-900">Orders (Live)</h1>
        <p class="mt-1 text-sm text-slate-500">Dev mode renders only backend order data.</p>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3" data-role="metrics"></div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-base font-semibold text-slate-900">Order List</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-6 py-3">Order ID</th>
                <th class="px-6 py-3">Customer</th>
                <th class="px-6 py-3">Date</th>
                <th class="px-6 py-3">Amount</th>
                <th class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100" data-role="orders-body"></tbody>
          </table>
        </div>
        <div class="border-t border-slate-200 px-6 py-4 text-sm text-slate-500" data-role="summary-text"></div>
      </section>

      <section data-role="logistics-placeholder"></section>
    </div>
  `;
};

const renderMetrics = (container, payload) => {
  if (!container) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  const pending = countByStatuses(items, ['SUBMITTED', 'CONFIRMED', 'PAY_PENDING', 'PENDING']);
  const delivered = countByStatuses(items, ['DELIVERED']);

  container.innerHTML = `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Total Orders</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(total)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Pending (Current Page)</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(pending)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Delivered (Current Page)</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(delivered)}</p></div>
  `;
};

const renderOrdersTable = (tbody, payload) => {
  if (!tbody) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-5">No orders found in backend.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((order) => {
    const customerName = safeText(order?.address?.receiverName, 'Customer');
    const amount = formatCurrencyFen(calcAmountFen(order));

    return `
      <tr class="hover:bg-slate-50">
        <td class="px-6 py-4 font-medium text-slate-900">#${escape(safeText(order.id))}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">${escape(initials(customerName))}</div>
            <span>${escape(customerName)}</span>
          </div>
        </td>
        <td class="px-6 py-4">${escape(formatDate(order.createdAt))}</td>
        <td class="px-6 py-4 font-medium text-slate-900">${escape(amount)}</td>
        <td class="px-6 py-4">${toStatusBadge(order.status || 'UNKNOWN')}</td>
      </tr>
    `;
  }).join('');
};

const renderSummaryText = (container, payload) => {
  if (!container) {
    return;
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  container.textContent = `Showing ${items.length} orders from current page, total ${total}.`;
};

const initOrders = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const main = document.querySelector('main');
  if (!main) {
    return;
  }

  mountDevLayout(main);

  const response = await fetchOrders({ page: 1, pageSize: 20 });
  if (response.status !== 200 || !response.data) {
    renderErrorState(main, 'Failed to load /orders');
    return;
  }

  const metrics = main.querySelector('[data-role="metrics"]');
  const tbody = main.querySelector('[data-role="orders-body"]');
  const summaryText = main.querySelector('[data-role="summary-text"]');
  const logisticsPlaceholder = main.querySelector('[data-role="logistics-placeholder"]');

  renderMetrics(metrics, response.data);
  renderOrdersTable(tbody, response.data);
  renderSummaryText(summaryText, response.data);

  if (logisticsPlaceholder) {
    logisticsPlaceholder.innerHTML = buildEmptyState(
      'Logistics Detail Panel',
      'No dedicated live logistics detail panel is wired for this page in dev mode.'
    );
  }
};

void initOrders();
