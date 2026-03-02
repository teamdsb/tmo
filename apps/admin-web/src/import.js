import {
  createAdminProductImportJob,
  createAdminProductRequestExportJob,
  createShipmentImportJob,
  getAdminImportJob,
  getFeatureFlags,
  patchFeatureFlags
} from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, formatDateTime, safeText, toStatusBadge } from './lib/render';

const pickFile = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.addEventListener('change', () => {
      resolve(input.files && input.files[0] ? input.files[0] : null);
    });
    input.click();
  });
};

const renderResult = (container, title, payload) => {
  container.innerHTML = `
    <h4 class="text-sm font-semibold text-slate-800">${escape(title)}</h4>
    <pre class="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">${escape(JSON.stringify(payload, null, 2))}</pre>
  `;
};

const renderFeatureFlags = (container, flags) => {
  container.innerHTML = `
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="paymentEnabled" ${flags.paymentEnabled ? 'checked' : ''} /> paymentEnabled</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="wechatPayEnabled" ${flags.wechatPayEnabled ? 'checked' : ''} /> wechatPayEnabled</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="alipayPayEnabled" ${flags.alipayPayEnabled ? 'checked' : ''} /> alipayPayEnabled</label>
  `;
};

const initImportTools = async () => {
  const context = await ensureProtectedPage();
  if (!context || context.mode !== 'dev') {
    return;
  }

  const main = document.querySelector('main');
  if (!main) {
    return;
  }

  const panel = document.createElement('section');
  panel.className = 'mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4';
  panel.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-blue-700">Live Import Jobs (Dev Mode)</h3>
        <p class="text-xs text-slate-600">Create and query real backend import/export jobs</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button data-action="product-import" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Product Import</button>
        <button data-action="shipment-import" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Shipment Import</button>
        <button data-action="request-export" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Request Export</button>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <input data-field="job-id" class="rounded border border-slate-300 px-2 py-1 text-xs" placeholder="Import job UUID" />
      <button data-action="query-job" class="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">Query Job</button>
    </div>
    <div class="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <h4 class="text-sm font-semibold text-slate-800">Feature Flags</h4>
      <div data-role="flags" class="mt-2 flex flex-wrap gap-4"></div>
      <button data-action="save-flags" class="mt-2 rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">Save Flags</button>
      <p class="mt-1 text-xs text-slate-500" data-role="flags-updated"></p>
    </div>
    <div data-role="result" class="mt-3"></div>
  `;

  main.prepend(panel);

  const resultContainer = panel.querySelector('[data-role="result"]');
  const flagsContainer = panel.querySelector('[data-role="flags"]');
  const flagsUpdated = panel.querySelector('[data-role="flags-updated"]');

  let currentFlags = {
    paymentEnabled: false,
    wechatPayEnabled: false,
    alipayPayEnabled: false
  };

  const flagsResponse = await getFeatureFlags();
  if (flagsResponse.status === 200 && flagsResponse.data) {
    currentFlags = {
      ...currentFlags,
      ...flagsResponse.data
    };
  }
  renderFeatureFlags(flagsContainer, currentFlags);

  panel.addEventListener('click', async (event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) {
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action) {
      return;
    }

    try {
      target.disabled = true;

      if (action === 'product-import') {
        const excelFile = await pickFile();
        if (!excelFile) {
          return;
        }
        const response = await createAdminProductImportJob(excelFile);
        renderResult(resultContainer, 'Product Import Response', response);
        return;
      }

      if (action === 'shipment-import') {
        const excelFile = await pickFile();
        if (!excelFile) {
          return;
        }
        const response = await createShipmentImportJob(excelFile);
        renderResult(resultContainer, 'Shipment Import Response', response);
        return;
      }

      if (action === 'request-export') {
        const response = await createAdminProductRequestExportJob({});
        renderResult(resultContainer, 'Product Request Export Response', response);
        return;
      }

      if (action === 'query-job') {
        const input = panel.querySelector('[data-field="job-id"]');
        const jobId = safeText(input?.value, '');
        if (!jobId || jobId === '--') {
          window.alert('Please input a job id.');
          return;
        }
        const response = await getAdminImportJob(jobId);
        renderResult(resultContainer, 'Import Job Query', response);
        return;
      }

      if (action === 'save-flags') {
        const payload = {
          paymentEnabled: Boolean(panel.querySelector('input[data-flag="paymentEnabled"]')?.checked),
          wechatPayEnabled: Boolean(panel.querySelector('input[data-flag="wechatPayEnabled"]')?.checked),
          alipayPayEnabled: Boolean(panel.querySelector('input[data-flag="alipayPayEnabled"]')?.checked)
        };
        const response = await patchFeatureFlags(payload);
        renderResult(resultContainer, 'Feature Flags Update', response);
        if (response.status === 200) {
          flagsUpdated.textContent = `Updated at ${formatDateTime(new Date().toISOString())}`;
          renderFeatureFlags(flagsContainer, response.data || payload);
        }
        return;
      }
    } catch (error) {
      renderResult(resultContainer, 'Request Error', {
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      target.disabled = false;
    }
  });
};

void initImportTools();
