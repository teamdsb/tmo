const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const defaultEmptyDescription = '暂无实时数据。';
const defaultErrorDescription = '请求失败，请稍后重试。';

export const formatDateTime = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleString('zh-CN');
};

export const formatDate = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleDateString('zh-CN');
};

export const formatCurrencyFen = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return '$0.00';
  }
  return `$${(numeric / 100).toFixed(2)}`;
};

export const safeText = (value, fallback = '--') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
};

export const buildEmptyState = (title, description = defaultEmptyDescription) => {
  return `
    <div class="rounded-xl border border-slate-200 bg-white p-5 text-slate-700">
      <h3 class="text-sm font-semibold text-slate-900">${escapeHtml(safeText(title, '暂无数据'))}</h3>
      <p class="mt-2 text-sm text-slate-500">${escapeHtml(safeText(description, defaultEmptyDescription))}</p>
    </div>
  `;
};

export const buildErrorState = (message, description = defaultErrorDescription) => {
  return `
    <div class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
      <h3 class="text-sm font-semibold text-red-800">请求错误</h3>
      <p class="mt-2 text-sm">${escapeHtml(safeText(message, '未知错误'))}</p>
      <p class="mt-1 text-xs text-red-600">${escapeHtml(safeText(description, defaultErrorDescription))}</p>
    </div>
  `;
};

export const renderEmptyState = (container, title, description) => {
  if (!container) {
    return;
  }
  container.innerHTML = buildEmptyState(title, description);
};

export const renderErrorState = (container, message, description) => {
  if (!container) {
    return;
  }
  container.innerHTML = buildErrorState(message, description);
};

export const toStatusBadge = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (!normalized) {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600">未知</span>';
  }

  const map = {
    OPEN: 'bg-blue-100 text-blue-700',
    RESPONDED: 'bg-emerald-100 text-emerald-700',
    CLOSED: 'bg-slate-200 text-slate-700',
    SUBMITTED: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    PAY_PENDING: 'bg-purple-100 text-purple-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    SHIPPED: 'bg-cyan-100 text-cyan-700',
    DELIVERED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-red-100 text-red-700',
    FAILED: 'bg-red-100 text-red-700',
    PENDING: 'bg-amber-100 text-amber-700',
    RUNNING: 'bg-blue-100 text-blue-700',
    SUCCEEDED: 'bg-emerald-100 text-emerald-700'
  };

  const classes = map[normalized] || 'bg-slate-100 text-slate-700';
  const labels = {
    OPEN: '开放',
    RESPONDED: '已回复',
    CLOSED: '已关闭',
    SUBMITTED: '已提交',
    CONFIRMED: '已确认',
    PAY_PENDING: '待支付',
    PAID: '已支付',
    SHIPPED: '已发货',
    DELIVERED: '已送达',
    CANCELLED: '已取消',
    FAILED: '失败',
    PENDING: '待处理',
    RUNNING: '运行中',
    SUCCEEDED: '成功',
    UNKNOWN: '未知'
  };
  return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${classes}">${escapeHtml(labels[normalized] || normalized)}</span>`;
};

export const escape = escapeHtml;
