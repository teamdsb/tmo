import {
  createAdminProductImportJob,
  createAdminProductRequestExportJob,
  createShipmentImportJob,
  getAdminImportJob,
  getFeatureFlags,
  patchFeatureFlags
} from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { hasPermission, normalizePermissionMap } from './lib/permissions';
import {
  buildEmptyState,
  buildErrorState,
  escape,
  formatDateTime,
  safeText
} from './lib/render';

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
    <pre class="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">${escape(JSON.stringify(payload, null, 2))}</pre>
  `;
};

const renderFeatureFlags = (container, flags) => {
  container.innerHTML = `
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="paymentEnabled" ${flags.paymentEnabled ? 'checked' : ''} /> 支付开关（paymentEnabled）</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="wechatPayEnabled" ${flags.wechatPayEnabled ? 'checked' : ''} /> 微信支付（wechatPayEnabled）</label>
    <label class="flex items-center gap-2 text-sm"><input type="checkbox" data-flag="alipayPayEnabled" ${flags.alipayPayEnabled ? 'checked' : ''} /> 支付宝支付（alipayPayEnabled）</label>
  `;
};

const mountDevLayout = (main) => {
  main.innerHTML = `
    <div class="mx-auto w-full max-w-5xl space-y-6">
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-bold text-slate-900">导入任务（实时）</h1>
        <p class="mt-1 text-sm text-slate-500">Dev 模式下仅保留后端真实导入/导出与功能开关操作。</p>
      </section>

      <section class="rounded-xl border border-blue-200 bg-blue-50 p-5" data-role="tools-panel">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-blue-700">导入 / 导出操作</h3>
            <p class="text-xs text-slate-600">创建任务并查询后端真实任务状态。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button data-action="product-import" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">商品导入</button>
            <button data-action="shipment-import" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">物流导入</button>
            <button data-action="request-export" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">需求导出</button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <input data-field="job-id" class="rounded border border-slate-300 px-2 py-1 text-xs" placeholder="导入任务 UUID" />
          <button data-action="query-job" class="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">查询任务</button>
        </div>

        <div class="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <h4 class="text-sm font-semibold text-slate-800">功能开关</h4>
          <div data-role="flags" class="mt-2 flex flex-wrap gap-4"></div>
          <button data-action="save-flags" class="mt-2 rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900">保存开关</button>
          <p class="mt-1 text-xs text-slate-500" data-role="flags-updated"></p>
        </div>

        <div data-role="result" class="mt-4"></div>
      </section>

      <section data-role="placeholder"></section>
    </div>
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

  mountDevLayout(main);

  const panel = main.querySelector('[data-role="tools-panel"]');
  const resultContainer = main.querySelector('[data-role="result"]');
  const flagsContainer = main.querySelector('[data-role="flags"]');
  const flagsUpdated = main.querySelector('[data-role="flags-updated"]');
  const placeholder = main.querySelector('[data-role="placeholder"]');

  if (!panel || !resultContainer || !flagsContainer || !flagsUpdated) {
    return;
  }

  const permissionMap = normalizePermissionMap(context.session?.permissions);
  const canProductImport = hasPermission(permissionMap, 'import:product', 'SELF');
  const canShipmentImport = hasPermission(permissionMap, 'import:shipment', 'SELF');
  const canRequestExport = hasPermission(permissionMap, 'product_request:export', 'SELF');
  const canManageFlags = hasPermission(permissionMap, 'config:feature_flags', 'ALL');

  if (placeholder) {
    placeholder.innerHTML = buildEmptyState(
      '旧版解析预览已隐藏',
      'Dev 模式已隐藏静态解析进度与模拟候选行，请使用上方任务接口查看真实进度。'
    );
  }

  let currentFlags = {
    paymentEnabled: false,
    wechatPayEnabled: false,
    alipayPayEnabled: false
  };

  if (canManageFlags) {
    const flagsResponse = await getFeatureFlags();
    if (flagsResponse.status === 200 && flagsResponse.data) {
      currentFlags = {
        ...currentFlags,
        ...flagsResponse.data
      };
    } else {
      resultContainer.innerHTML = buildErrorState('加载 /admin/config/feature-flags 失败');
    }
    renderFeatureFlags(flagsContainer, currentFlags);
  } else {
    flagsContainer.innerHTML = buildEmptyState('无权限', '当前角色无权限修改支付开关。');
    const saveFlagsBtn = panel.querySelector('button[data-action="save-flags"]');
    if (saveFlagsBtn) {
      saveFlagsBtn.setAttribute('disabled', 'disabled');
      saveFlagsBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

  const disabledActions = [];
  if (!canProductImport) disabledActions.push('product-import');
  if (!canShipmentImport) disabledActions.push('shipment-import');
  if (!canRequestExport) disabledActions.push('request-export');
  for (const action of disabledActions) {
    const button = panel.querySelector(`button[data-action="${action}"]`);
    if (button) {
      button.setAttribute('disabled', 'disabled');
      button.classList.add('opacity-50', 'cursor-not-allowed');
    }
  }

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
        if (!canProductImport) return;
        const excelFile = await pickFile();
        if (!excelFile) {
          return;
        }
        const response = await createAdminProductImportJob(excelFile);
        renderResult(resultContainer, '商品导入响应', response);
        return;
      }

      if (action === 'shipment-import') {
        if (!canShipmentImport) return;
        const excelFile = await pickFile();
        if (!excelFile) {
          return;
        }
        const response = await createShipmentImportJob(excelFile);
        renderResult(resultContainer, '物流导入响应', response);
        return;
      }

      if (action === 'request-export') {
        if (!canRequestExport) return;
        const response = await createAdminProductRequestExportJob({});
        renderResult(resultContainer, '需求导出响应', response);
        return;
      }

      if (action === 'query-job') {
        const input = panel.querySelector('[data-field="job-id"]');
        const jobId = safeText(input?.value, '');
        if (!jobId || jobId === '--') {
          window.alert('请输入任务 ID。');
          return;
        }
        const response = await getAdminImportJob(jobId);
        renderResult(resultContainer, '导入任务查询', response);
        return;
      }

      if (action === 'save-flags') {
        if (!canManageFlags) return;
        const payload = {
          paymentEnabled: Boolean(panel.querySelector('input[data-flag="paymentEnabled"]')?.checked),
          wechatPayEnabled: Boolean(panel.querySelector('input[data-flag="wechatPayEnabled"]')?.checked),
          alipayPayEnabled: Boolean(panel.querySelector('input[data-flag="alipayPayEnabled"]')?.checked)
        };
        const response = await patchFeatureFlags(payload);
        renderResult(resultContainer, '功能开关更新', response);
        if (response.status === 200) {
          flagsUpdated.textContent = `更新时间：${formatDateTime(new Date().toISOString())}`;
          renderFeatureFlags(flagsContainer, response.data || payload);
        }
        return;
      }
    } catch (error) {
      renderResult(resultContainer, '请求错误', {
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      target.disabled = false;
    }
  });
};

void initImportTools();
