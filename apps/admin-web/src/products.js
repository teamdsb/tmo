import { fetchProducts } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, safeText, toStatusBadge } from './lib/render';

const renderProducts = (payload) => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-5 text-sm text-slate-500">No products found in backend.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((item) => {
    const image = safeText(item.coverImageUrl, '');
    const tag = Array.isArray(item.tags) && item.tags.length > 0 ? item.tags[0] : 'Uncategorized';
    const inventory = Math.floor(Math.random() * 1000) + 10;
    const tier = Array.isArray(item.tags) && item.tags.length > 1 ? item.tags[1] : 'Standard Tier';

    return `
      <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td class="px-6 py-4"><input class="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary bg-transparent" type="checkbox" /></td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-4">
            <div class="size-12 rounded bg-slate-200 dark:bg-slate-700 flex-shrink-0 bg-cover bg-center" style="${image ? `background-image:url('${escape(image)}')` : ''}"></div>
            <div>
              <div class="font-bold text-slate-900 dark:text-white">${escape(safeText(item.name))}</div>
              <div class="text-xs text-slate-500 font-mono mt-0.5">SPU ${escape(safeText(item.id))}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">${escape(safeText(tag))}</span></td>
        <td class="px-6 py-4"><span class="text-sm text-slate-600 dark:text-slate-300">${escape(safeText(tier))}</span></td>
        <td class="px-6 py-4 text-right"><span class="font-medium text-slate-900 dark:text-white">${escape(inventory)}</span></td>
        <td class="px-6 py-4 text-center">${toStatusBadge('ON_SHELF')}</td>
        <td class="px-6 py-4 text-right"><button class="text-slate-400 hover:text-primary transition-colors p-1"><span class="material-symbols-outlined">more_vert</span></button></td>
      </tr>
    `;
  }).join('');

  const summary = document.querySelector('.border-t.border-slate-200.dark\\:border-slate-800 .text-sm.text-slate-500');
  if (summary) {
    summary.innerHTML = `Showing <span class="font-semibold text-slate-900 dark:text-white">1</span> to <span class="font-semibold text-slate-900 dark:text-white">${items.length}</span> of <span class="font-semibold text-slate-900 dark:text-white">${payload.total || items.length}</span> results`;
  }
};

const initProducts = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const response = await fetchProducts({ page: 1, pageSize: 10 });
  if (response.status !== 200) {
    return;
  }

  renderProducts(response.data);
};

void initProducts();
