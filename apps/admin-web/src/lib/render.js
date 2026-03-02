const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const formatDateTime = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleString();
};

export const formatDate = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleDateString();
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

export const toStatusBadge = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (!normalized) {
    return '<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600">Unknown</span>';
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
  return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${classes}">${escapeHtml(normalized)}</span>`;
};

export const escape = escapeHtml;
