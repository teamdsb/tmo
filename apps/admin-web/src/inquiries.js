import { fetchInquiries } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, formatDateTime, safeText, toStatusBadge } from './lib/render';

const renderLiveInquiriesPanel = (payload) => {
  const root = document.querySelector('main');
  if (!root) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const panel = document.createElement('section');
  panel.className = 'mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4';

  if (items.length === 0) {
    panel.innerHTML = '<h3 class="text-sm font-semibold text-blue-700">Live Inquiry Feed</h3><p class="mt-2 text-sm text-slate-600">No inquiries available from backend.</p>';
    root.prepend(panel);
    return;
  }

  panel.innerHTML = `
    <h3 class="text-sm font-semibold text-blue-700">Live Inquiry Feed</h3>
    <div class="mt-3 space-y-2">
      ${items.slice(0, 5).map((item) => `
        <div class="rounded-lg bg-white px-3 py-2 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-slate-800">${escape(safeText(item.id))}</span>
            ${toStatusBadge(item.status || 'OPEN')}
          </div>
          <p class="mt-1 text-slate-700">${escape(safeText(item.message, 'No message'))}</p>
          <p class="mt-1 text-xs text-slate-500">createdBy: ${escape(safeText(item.createdByUserId))} · ${escape(formatDateTime(item.createdAt))}</p>
        </div>
      `).join('')}
    </div>
  `;

  root.prepend(panel);
};

const initInquiries = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const response = await fetchInquiries({ page: 1, pageSize: 10 });
  if (response.status !== 200) {
    return;
  }

  renderLiveInquiriesPanel(response.data);
};

void initInquiries();
