import { fetchInquiries } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import {
  buildEmptyState,
  escape,
  formatDateTime,
  renderErrorState,
  safeText,
  toStatusBadge
} from './lib/render';

const countOpenInquiries = (items) => {
  return items.filter((item) => String(item?.status || '').toUpperCase() === 'OPEN').length;
};

const mountDevLayout = (main) => {
  main.innerHTML = `
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-bold text-slate-900">Sourcing Inquiries (Live)</h1>
        <p class="mt-1 text-sm text-slate-500">Dev mode only shows backend inquiry records.</p>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3" data-role="metrics"></div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-base font-semibold text-slate-900">Inquiry List</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-6 py-3">Inquiry ID</th>
                <th class="px-6 py-3">Message</th>
                <th class="px-6 py-3">User</th>
                <th class="px-6 py-3">Created At</th>
                <th class="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100" data-role="inquiry-body"></tbody>
          </table>
        </div>
      </section>

      <section data-role="detail-placeholder"></section>
    </div>
  `;
};

const renderMetrics = (container, payload) => {
  if (!container) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  const open = countOpenInquiries(items);

  container.innerHTML = `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Total Inquiries</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(total)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Open (Current Page)</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(open)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">Loaded Records</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(items.length)}</p></div>
  `;
};

const renderInquiryRows = (tbody, payload) => {
  if (!tbody) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-5">No inquiries found in backend.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item) => {
    return `
      <tr class="hover:bg-slate-50">
        <td class="px-6 py-4 font-medium text-slate-900">${escape(safeText(item.id))}</td>
        <td class="px-6 py-4">${escape(safeText(item.message, 'No message'))}</td>
        <td class="px-6 py-4">${escape(safeText(item.createdByUserId, '--'))}</td>
        <td class="px-6 py-4">${escape(formatDateTime(item.createdAt))}</td>
        <td class="px-6 py-4">${toStatusBadge(item.status || 'OPEN')}</td>
      </tr>
    `;
  }).join('');
};

const initInquiries = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const main = document.querySelector('main');
  if (!main) {
    return;
  }

  mountDevLayout(main);

  const response = await fetchInquiries({ page: 1, pageSize: 20 });
  if (response.status !== 200 || !response.data) {
    renderErrorState(main, 'Failed to load /inquiries/price');
    return;
  }

  const metrics = main.querySelector('[data-role="metrics"]');
  const body = main.querySelector('[data-role="inquiry-body"]');
  const detailPlaceholder = main.querySelector('[data-role="detail-placeholder"]');

  renderMetrics(metrics, response.data);
  renderInquiryRows(body, response.data);

  if (detailPlaceholder) {
    detailPlaceholder.innerHTML = buildEmptyState(
      'Inquiry Detail Stream',
      'No dedicated live detail thread endpoint is wired for this page in dev mode.'
    );
  }
};

void initInquiries();
