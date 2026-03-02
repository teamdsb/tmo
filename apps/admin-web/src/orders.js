import { fetchOrders } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, formatCurrencyFen, formatDate, safeText, toStatusBadge } from './lib/render';

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

const renderOrders = (payload) => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-5 text-sm text-slate-500">No orders found in backend.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((order) => {
    const customerName = safeText(order?.address?.receiverName, 'Customer');
    const amount = formatCurrencyFen(calcAmountFen(order));

    return `
      <tr class="group hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors">
        <td class="px-6 py-4 font-medium text-text-main dark:text-text-main-dark">#${escape(safeText(order.id))}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="size-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">${escape(initials(customerName))}</div>
            <p class="text-text-main dark:text-text-main-dark font-medium">${escape(customerName)}</p>
          </div>
        </td>
        <td class="px-6 py-4 text-text-sub dark:text-text-sub-dark">${escape(formatDate(order.createdAt))}</td>
        <td class="px-6 py-4 font-medium text-text-main dark:text-text-main-dark">${escape(amount)}</td>
        <td class="px-6 py-4">${toStatusBadge(order.status || 'UNKNOWN')}</td>
        <td class="px-6 py-4 text-right"><button class="text-text-sub dark:text-text-sub-dark hover:text-primary font-medium text-sm">View</button></td>
      </tr>
    `;
  }).join('');

  const summary = document.querySelector('.border-t.border-border-light.dark\\:border-border-dark.pt-4 p.text-sm.text-text-sub');
  if (summary) {
    summary.innerHTML = `Showing <span class="font-medium text-text-main dark:text-text-main-dark">1</span> to <span class="font-medium text-text-main dark:text-text-main-dark">${items.length}</span> of <span class="font-medium text-text-main dark:text-text-main-dark">${payload.total || items.length}</span> results`;
  }
};

const initOrders = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const response = await fetchOrders({ page: 1, pageSize: 10 });
  if (response.status !== 200) {
    return;
  }

  renderOrders(response.data);
};

void initOrders();
