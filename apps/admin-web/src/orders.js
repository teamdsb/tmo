import { fetchOrders } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { canonicalOrderFixtures, canonicalSkuById, resolveAdminTabByStatus } from '../../../packages/shared/src/mock-data/index.js';
import {
  buildEmptyState,
  escape,
  formatCurrencyFen,
  formatDate,
  renderErrorState,
  safeText,
  toStatusBadge
} from './lib/render';

const DEV_PAGE_SIZE = 20;
const MOCK_PAGE_SIZE = 5;

const TAB_KEYS = ['submitted', 'confirmed', 'shipped', 'delivered', 'returns'];

const TAB_CLASS = {
  normalActive: 'border-b-2 border-primary py-4 px-1 text-sm font-bold text-primary',
  normalInactive:
    'group border-b-2 border-transparent py-4 px-1 text-sm font-medium text-text-sub dark:text-text-sub-dark hover:border-text-sub hover:text-text-sub-dark dark:hover:text-text-main-dark',
  returnsActive: 'border-b-2 border-red-500 py-4 px-1 text-sm font-bold text-red-600',
  returnsInactive:
    'group border-b-2 border-transparent py-4 px-1 text-sm font-medium text-red-500 hover:border-red-500 hover:text-red-600',
  countActive: 'ml-2 rounded-full bg-primary/10 py-0.5 px-2.5 text-xs font-medium text-primary',
  countInactive:
    'ml-2 rounded-full bg-background-light dark:bg-background-dark py-0.5 px-2.5 text-xs font-medium text-text-sub dark:text-text-sub-dark group-hover:bg-gray-200 dark:group-hover:bg-gray-700',
  countReturns: 'ml-2 rounded-full bg-red-50 py-0.5 px-2.5 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400'
};

const STATUS_BADGE_CLASS = {
  SUBMITTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
  CONFIRMED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  IN_TRANSIT: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  DISPATCHED: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  DELIVERED: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
  RETURNING: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
  RETURNED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
};

const STATUS_DOT_CLASS = {
  SUBMITTED: 'bg-gray-500',
  CONFIRMED: 'bg-indigo-500',
  IN_TRANSIT: 'bg-blue-600 dark:bg-blue-400',
  DISPATCHED: 'bg-amber-600 dark:bg-amber-400',
  DELIVERED: 'bg-green-600 dark:bg-green-400',
  RETURNING: 'bg-red-600 dark:bg-red-400',
  RETURNED: 'bg-red-600 dark:bg-red-400'
};

// 兜底计算订单总金额（分），用于 dev 实时列表金额展示。
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

// 从姓名生成头像缩写。
const initials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'NA';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

// 统计指定状态集合数量。
const countByStatuses = (items, statuses) => {
  const set = new Set(statuses.map((status) => String(status).toUpperCase()));
  return items.filter((item) => set.has(String(item?.status || '').toUpperCase())).length;
};

// 渲染统一状态徽标。
const buildStatusBadge = (statusKey, label) => {
  const normalized = String(statusKey || '').toUpperCase();
  const classes = STATUS_BADGE_CLASS[normalized] || STATUS_BADGE_CLASS.SUBMITTED;
  const dot = STATUS_DOT_CLASS[normalized] || STATUS_DOT_CLASS.SUBMITTED;
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes}"><span class="size-1.5 rounded-full ${dot}"></span>${escape(
    safeText(label, '待处理')
  )}</span>`;
};

// 统计商品行总数量。
const sumLineItemQty = (lineItems) => {
  if (!Array.isArray(lineItems)) {
    return 0;
  }
  return lineItems.reduce((sum, item) => {
    const qty = Number(item?.qty || 0);
    return Number.isFinite(qty) ? sum + qty : sum;
  }, 0);
};

const orderDetailDrawerContext = {
  order: null,
  onSave: null
};

// 构建抽屉里的单条商品编辑行。
const buildLineItemEditRow = (item) => {
  return `
    <div data-role="detail-line-item-row" class="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div class="grid grid-cols-12 gap-2">
        <label class="col-span-6 text-xs text-slate-500">
          商品名
          <input data-role="detail-item-name" type="text" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" value="${escape(
            safeText(item?.name, '')
          )}" />
        </label>
        <label class="col-span-3 text-xs text-slate-500">
          数量
          <input data-role="detail-item-qty" type="number" min="1" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" value="${escape(
            safeText(item?.qty, '1')
          )}" />
        </label>
        <label class="col-span-3 text-xs text-slate-500">
          尺码
          <input data-role="detail-item-size" type="text" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" value="${escape(
            safeText(item?.size, '默认')
          )}" />
        </label>
      </div>
      <div class="mt-2 flex justify-end">
        <button data-role="detail-remove-item" type="button" class="text-xs font-medium text-red-600 hover:text-red-700">删除</button>
      </div>
    </div>
  `;
};

// 从抽屉 DOM 收集商品行编辑结果。
const collectLineItemsFromDrawer = (drawer) => {
  const rows = Array.from(drawer.querySelectorAll('[data-role="detail-line-item-row"]'));
  const items = rows
    .map((row) => {
      const name = safeText(row.querySelector('[data-role="detail-item-name"]')?.value || '', '').trim();
      const qtyValue = Number(row.querySelector('[data-role="detail-item-qty"]')?.value || 0);
      const size = safeText(row.querySelector('[data-role="detail-item-size"]')?.value || '', '默认').trim();
      return {
        name,
        qty: Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1,
        size: size || '默认'
      };
    })
    .filter((item) => Boolean(item.name));

  return items;
};

// 刷新抽屉里的“购买商品总数量”。
const refreshDrawerProductCount = (drawer) => {
  const countEl = drawer.querySelector('[data-role="detail-product-count"]');
  if (!countEl) {
    return;
  }
  const qty = sumLineItemQty(collectLineItemsFromDrawer(drawer));
  countEl.textContent = `${qty} 件`;
};

// 渲染抽屉商品编辑区。
const renderDetailLineItemEditor = (drawer, lineItems) => {
  const container = drawer.querySelector('[data-role="detail-line-items"]');
  if (!container) {
    return;
  }
  const source = Array.isArray(lineItems) && lineItems.length > 0 ? lineItems : [{ name: '', qty: 1, size: 'M' }];
  container.innerHTML = source.map((item) => buildLineItemEditRow(item)).join('');
  refreshDrawerProductCount(drawer);
};

// 懒创建并复用订单详情抽屉。
const ensureOrderDetailDrawer = () => {
  const existed = document.querySelector('#order-detail-drawer');
  if (existed instanceof HTMLElement) {
    return existed;
  }

  const overlay = document.createElement('div');
  overlay.id = 'order-detail-overlay';
  overlay.className = 'fixed inset-0 z-[100] hidden bg-slate-900/30';

  const drawer = document.createElement('aside');
  drawer.id = 'order-detail-drawer';
  drawer.className =
    'fixed right-0 top-0 z-[101] h-screen w-full max-w-lg translate-x-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200';
  drawer.innerHTML = `
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
      <div>
        <h3 class="text-lg font-bold text-slate-900">订单详情（可编辑）</h3>
        <p data-role="detail-order-id" class="text-xs text-slate-500">订单号：--</p>
      </div>
      <button data-role="close-detail-drawer" type="button" class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <form data-role="detail-form" class="space-y-5 px-5 py-4">
      <section class="rounded-xl border border-slate-200 p-4">
        <h4 class="text-sm font-semibold text-slate-900">买家信息</h4>
        <div class="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
          <label class="text-xs text-slate-500">
            姓名
            <input data-role="detail-buyer-name" type="text" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" />
          </label>
          <label class="text-xs text-slate-500">
            联系电话
            <input data-role="detail-buyer-phone" type="text" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" />
          </label>
          <label class="text-xs text-slate-500">
            邮箱
            <input data-role="detail-buyer-email" type="email" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" />
          </label>
          <label class="text-xs text-slate-500">
            地址
            <textarea data-role="detail-buyer-address" rows="2" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary"></textarea>
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 p-4">
        <h4 class="text-sm font-semibold text-slate-900">购买信息</h4>
        <div class="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700">
          <label class="text-xs text-slate-500">
            购买时间
            <input data-role="detail-purchased-at" type="text" class="mt-1 w-full rounded-md border-slate-300 bg-white text-sm focus:border-primary focus:ring-primary" />
          </label>
          <p class="text-sm"><span class="text-slate-500">购买商品总数量：</span><span data-role="detail-product-count">0 件</span></p>
          <label class="text-xs text-slate-500">
            订单金额（只读）
            <input data-role="detail-order-amount" type="text" readonly class="mt-1 w-full rounded-md border-slate-300 bg-slate-50 text-sm text-slate-600" />
          </label>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200 p-4">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-slate-900">商品明细（数量 / 尺码）</h4>
          <button data-role="detail-add-item" type="button" class="text-xs font-medium text-primary hover:text-primary-dark">新增商品</button>
        </div>
        <div data-role="detail-line-items" class="mt-3 space-y-2"></div>
      </section>
      <p data-role="detail-form-error" class="hidden text-sm text-red-600"></p>
      <div class="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white py-3">
        <button data-role="cancel-detail-save" type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button>
        <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">保存修改</button>
      </div>
    </form>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  const close = () => {
    overlay.classList.add('hidden');
    drawer.classList.add('translate-x-full');
    document.body.classList.remove('overflow-hidden');
  };

  overlay.addEventListener('click', close);
  drawer.querySelector('[data-role="close-detail-drawer"]')?.addEventListener('click', close);
  drawer.querySelector('[data-role="cancel-detail-save"]')?.addEventListener('click', close);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
      close();
    }
  });

  const lineItemsContainer = drawer.querySelector('[data-role="detail-line-items"]');
  drawer.querySelector('[data-role="detail-add-item"]')?.addEventListener('click', () => {
    if (!lineItemsContainer) {
      return;
    }
    lineItemsContainer.insertAdjacentHTML('beforeend', buildLineItemEditRow({ name: '', qty: 1, size: 'M' }));
    refreshDrawerProductCount(drawer);
  });

  lineItemsContainer?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const removeBtn = target.closest('[data-role="detail-remove-item"]');
    if (!removeBtn) {
      return;
    }
    const row = removeBtn.closest('[data-role="detail-line-item-row"]');
    row?.remove();
    if (lineItemsContainer.children.length === 0) {
      lineItemsContainer.insertAdjacentHTML('beforeend', buildLineItemEditRow({ name: '', qty: 1, size: 'M' }));
    }
    refreshDrawerProductCount(drawer);
  });

  lineItemsContainer?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.matches('[data-role="detail-item-qty"]')) {
      refreshDrawerProductCount(drawer);
    }
  });

  const form = drawer.querySelector('[data-role="detail-form"]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!orderDetailDrawerContext.order) {
      return;
    }
    const errorEl = drawer.querySelector('[data-role="detail-form-error"]');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }

    const getValue = (selector, fallback = '') => {
      const el = drawer.querySelector(selector);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return safeText(el.value, fallback).trim();
      }
      return fallback;
    };

    const buyerName = getValue('[data-role="detail-buyer-name"]');
    const buyerPhone = getValue('[data-role="detail-buyer-phone"]');
    const buyerAddress = getValue('[data-role="detail-buyer-address"]');
    if (!buyerName || !buyerPhone || !buyerAddress) {
      if (errorEl) {
        errorEl.textContent = '姓名、联系电话、地址不能为空。';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    const lineItems = collectLineItemsFromDrawer(drawer);
    if (lineItems.length === 0) {
      if (errorEl) {
        errorEl.textContent = '请至少填写一条商品信息。';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    const purchasedAt = getValue('[data-role="detail-purchased-at"]', orderDetailDrawerContext.order.purchasedAt);
    const updatedOrder = {
      ...orderDetailDrawerContext.order,
      purchasedAt,
      date: purchasedAt ? purchasedAt.slice(0, 10) : orderDetailDrawerContext.order.date,
      lineItems,
      customer: {
        ...orderDetailDrawerContext.order.customer,
        name: buyerName,
        phone: buyerPhone,
        email: getValue('[data-role="detail-buyer-email"]', orderDetailDrawerContext.order.customer?.email),
        address: buyerAddress
      }
    };

    if (typeof orderDetailDrawerContext.onSave === 'function') {
      orderDetailDrawerContext.onSave(updatedOrder);
    }
    close();
  });

  return drawer;
};

// 打开抽屉并回填订单详情，可在保存后回写主列表。
const openOrderDetailDrawer = (order, onSave) => {
  const drawer = ensureOrderDetailDrawer();
  const overlay = document.querySelector('#order-detail-overlay');
  if (!(drawer instanceof HTMLElement) || !(overlay instanceof HTMLElement) || !order) {
    return;
  }

  orderDetailDrawerContext.order = order;
  orderDetailDrawerContext.onSave = onSave;

  const setInput = (selector, value) => {
    const el = drawer.querySelector(selector);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = safeText(value, '');
    }
  };

  setInput('[data-role="detail-buyer-name"]', order.customer?.name);
  setInput('[data-role="detail-buyer-phone"]', order.customer?.phone);
  setInput('[data-role="detail-buyer-email"]', order.customer?.email);
  setInput('[data-role="detail-buyer-address"]', order.customer?.address);
  setInput('[data-role="detail-purchased-at"]', order.purchasedAt);
  setInput('[data-role="detail-order-amount"]', `$${Number(order.amount || 0).toFixed(2)}`);

  const orderIdEl = drawer.querySelector('[data-role="detail-order-id"]');
  if (orderIdEl) {
    orderIdEl.textContent = `订单号：#${safeText(order.id, '--')}`;
  }
  const errorEl = drawer.querySelector('[data-role="detail-form-error"]');
  if (errorEl) {
    errorEl.classList.add('hidden');
  }
  renderDetailLineItemEditor(drawer, order.lineItems);

  overlay.classList.remove('hidden');
  drawer.classList.remove('translate-x-full');
  document.body.classList.add('overflow-hidden');
};

// 标准化 mock 订单结构。
const mockOrder = (config) => {
  const fallbackLineItems = [
    { name: '基础款 T 恤', qty: 1, size: 'M' }
  ];
  return {
    id: config.id,
    tab: config.tab,
    date: config.date,
    amount: config.amount,
    statusKey: config.statusKey,
    statusLabel: config.statusLabel,
    trackingNumber: config.trackingNumber,
    shippingBadge: config.shippingBadge || config.statusLabel,
    customer: {
      name: config.customerName,
      member: config.customerMember,
      email: config.customerEmail,
      phone: config.customerPhone,
      address: config.customerAddress || '加利福尼亚州旧金山市 Market St 100 号',
      orderCount: config.customerOrderCount,
      ltv: config.customerLtv,
      note: config.deliveryNote
    },
    purchasedAt: config.purchasedAt || `${config.date} 10:00`,
    lineItems: Array.isArray(config.lineItems) && config.lineItems.length > 0 ? config.lineItems : fallbackLineItems,
    timeline: config.timeline
  };
};

// 构建 legacy mock 订单样本。
const buildMockOrders = () => {
  return [
    mockOrder({
      id: 'ORD-2023-001',
      tab: 'shipped',
      date: '2023-10-24',
      amount: 120.5,
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      trackingNumber: '789012349981',
      customerName: '艾丽丝·史密斯',
      customerMember: '高级会员',
      customerEmail: 'alice.smith@example.com',
      customerPhone: '+1 (555) 123-4567',
      customerOrderCount: 54,
      customerLtv: '$4.2k',
      deliveryNote: '若家中无人，请将包裹放在后门门廊。门禁码 1234。',
      timeline: [
        { title: '已到达分拨中心', detail: '旧金山，加州 • 今天 10:24' },
        { title: '已离开发货网点', detail: '奥克兰，加州 • 昨天 20:00' },
        { title: '快递员已揽收', detail: '萨克拉门托，加州 • 2023-10-24 14:30' },
        { title: '订单已处理', detail: '萨克拉门托，加州 • 2023-10-24 09:15' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-002',
      tab: 'shipped',
      date: '2023-10-23',
      amount: 45,
      statusKey: 'DISPATCHED',
      statusLabel: '已发出',
      trackingNumber: '789012349982',
      customerName: '鲍勃·琼斯',
      customerMember: '普通会员',
      customerEmail: 'bob.jones@example.com',
      customerPhone: '+1 (555) 118-2201',
      customerOrderCount: 12,
      customerLtv: '$920',
      deliveryNote: '工作日白天送达前请先电话联系。',
      timeline: [
        { title: '已发出', detail: '奥克兰分拨中心 • 今天 08:20' },
        { title: '仓库已出库', detail: '萨克拉门托仓 • 今天 06:40' },
        { title: '订单已打包', detail: '萨克拉门托仓 • 昨天 22:10' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-003',
      tab: 'shipped',
      date: '2023-10-23',
      amount: 89.99,
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      trackingNumber: '789012349983',
      customerName: '查理·布朗',
      customerMember: '高级会员',
      customerEmail: 'charlie.brown@example.com',
      customerPhone: '+1 (555) 900-7712',
      customerOrderCount: 28,
      customerLtv: '$2.6k',
      deliveryNote: '请放到前台代收。',
      timeline: [
        { title: '运输途中', detail: '圣何塞，加州 • 今天 09:45' },
        { title: '已到达转运中心', detail: '奥克兰，加州 • 今天 04:10' },
        { title: '快递员已揽收', detail: '萨克拉门托，加州 • 昨天 18:05' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-004',
      tab: 'delivered',
      date: '2023-10-22',
      amount: 210,
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      trackingNumber: '789012349984',
      shippingBadge: '配送完成',
      customerName: '戴安娜·普林斯',
      customerMember: '企业客户',
      customerEmail: 'diana.prince@example.com',
      customerPhone: '+1 (555) 555-8888',
      customerOrderCount: 7,
      customerLtv: '$6.8k',
      deliveryNote: '签收人：前台管理员 David。',
      timeline: [
        { title: '已签收', detail: '旧金山，加州 • 今天 11:10' },
        { title: '派送中', detail: '旧金山，加州 • 今天 08:40' },
        { title: '已到达分拨中心', detail: '旧金山，加州 • 今天 06:20' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-005',
      tab: 'submitted',
      date: '2023-10-22',
      amount: 35.5,
      statusKey: 'SUBMITTED',
      statusLabel: '待处理',
      trackingNumber: '--',
      shippingBadge: '待分拣',
      customerName: '埃文·赖特',
      customerMember: '新客',
      customerEmail: 'evan.wright@example.com',
      customerPhone: '+1 (555) 045-1299',
      customerOrderCount: 1,
      customerLtv: '$35.5',
      deliveryNote: '无需电话，直接送货。',
      timeline: [
        { title: '订单已提交', detail: '系统 • 2023-10-22 13:10' },
        { title: '等待仓库确认', detail: '预计 2 小时内完成分拣' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-006',
      tab: 'confirmed',
      date: '2023-10-22',
      amount: 152,
      statusKey: 'CONFIRMED',
      statusLabel: '已确认',
      trackingNumber: '--',
      shippingBadge: '待出库',
      customerName: '费欧娜·李',
      customerMember: '普通会员',
      customerEmail: 'fiona.lee@example.com',
      customerPhone: '+1 (555) 305-1200',
      customerOrderCount: 9,
      customerLtv: '$1.4k',
      deliveryNote: '请附带发票。',
      timeline: [
        { title: '库存锁定完成', detail: '仓库系统 • 今天 09:30' },
        { title: '订单已确认', detail: '支付已完成 • 今天 09:25' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-007',
      tab: 'returns',
      date: '2023-10-21',
      amount: 68.9,
      statusKey: 'RETURNING',
      statusLabel: '退货处理中',
      trackingNumber: 'RET-73920011',
      shippingBadge: '逆向物流中',
      customerName: '格蕾丝·陈',
      customerMember: '高级会员',
      customerEmail: 'grace.chen@example.com',
      customerPhone: '+1 (555) 775-3900',
      customerOrderCount: 33,
      customerLtv: '$3.1k',
      deliveryNote: '商品外包装轻微破损，申请退货。',
      timeline: [
        { title: '退货包裹运输中', detail: '奥克兰，加州 • 今天 12:05' },
        { title: '承运商已揽收', detail: '旧金山，加州 • 今天 08:40' },
        { title: '退货申请已通过', detail: '客服中心 • 昨天 19:20' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-008',
      tab: 'delivered',
      date: '2023-10-21',
      amount: 402.3,
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      trackingNumber: '789012349985',
      shippingBadge: '配送完成',
      customerName: '亨利·摩尔',
      customerMember: '企业客户',
      customerEmail: 'henry.moore@example.com',
      customerPhone: '+1 (555) 984-0080',
      customerOrderCount: 64,
      customerLtv: '$12.5k',
      deliveryNote: '签收后请发送电子回执。',
      timeline: [
        { title: '客户已签收', detail: '圣马特奥，加州 • 昨天 17:20' },
        { title: '派送员投递中', detail: '圣马特奥，加州 • 昨天 14:15' },
        { title: '已到达站点', detail: '旧金山，加州 • 昨天 10:40' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-009',
      tab: 'shipped',
      date: '2023-10-21',
      amount: 74,
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      trackingNumber: '789012349986',
      customerName: '伊莎贝拉·杨',
      customerMember: '普通会员',
      customerEmail: 'isabella.yang@example.com',
      customerPhone: '+1 (555) 600-3333',
      customerOrderCount: 5,
      customerLtv: '$540',
      deliveryNote: '请在下午 5 点后配送。',
      timeline: [
        { title: '运输途中', detail: '帕洛阿尔托，加州 • 今天 07:50' },
        { title: '离开分拨中心', detail: '奥克兰，加州 • 今天 03:40' },
        { title: '仓库出库', detail: '萨克拉门托仓 • 昨天 21:00' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-010',
      tab: 'confirmed',
      date: '2023-10-20',
      amount: 96.2,
      statusKey: 'CONFIRMED',
      statusLabel: '已确认',
      trackingNumber: '--',
      shippingBadge: '待分拣',
      customerName: '杰克·哈里森',
      customerMember: '普通会员',
      customerEmail: 'jack.harrison@example.com',
      customerPhone: '+1 (555) 222-7710',
      customerOrderCount: 14,
      customerLtv: '$1.1k',
      deliveryNote: '优先使用纸质环保包装。',
      timeline: [
        { title: '订单已确认', detail: '支付成功 • 2023-10-20 16:30' },
        { title: '等待分拣', detail: '仓库将于今晚处理' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-011',
      tab: 'submitted',
      date: '2023-10-20',
      amount: 18.8,
      statusKey: 'SUBMITTED',
      statusLabel: '待处理',
      trackingNumber: '--',
      shippingBadge: '待分拣',
      customerName: '凯特·沃森',
      customerMember: '新客',
      customerEmail: 'kate.watson@example.com',
      customerPhone: '+1 (555) 887-1020',
      customerOrderCount: 1,
      customerLtv: '$18.8',
      deliveryNote: '无需加急。',
      timeline: [
        { title: '订单已提交', detail: '系统 • 2023-10-20 11:10' },
        { title: '等待支付校验', detail: '预计 10 分钟内完成' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-012',
      tab: 'returns',
      date: '2023-10-19',
      amount: 133,
      statusKey: 'RETURNED',
      statusLabel: '已退回',
      trackingNumber: 'RET-73920012',
      shippingBadge: '退货完成',
      customerName: '卢卡斯·马丁',
      customerMember: '普通会员',
      customerEmail: 'lucas.martin@example.com',
      customerPhone: '+1 (555) 400-6099',
      customerOrderCount: 6,
      customerLtv: '$780',
      deliveryNote: '退款原路返回银行卡。',
      timeline: [
        { title: '退货入库完成', detail: '萨克拉门托仓 • 今天 10:50' },
        { title: '质检通过', detail: '仓库质检 • 今天 09:15' },
        { title: '退货签收', detail: '仓库前台 • 昨天 18:40' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-013',
      tab: 'shipped',
      date: '2023-10-19',
      amount: 57.6,
      statusKey: 'DISPATCHED',
      statusLabel: '已发出',
      trackingNumber: '789012349987',
      customerName: '米娅·斯科特',
      customerMember: '普通会员',
      customerEmail: 'mia.scott@example.com',
      customerPhone: '+1 (555) 302-3331',
      customerOrderCount: 8,
      customerLtv: '$990',
      deliveryNote: '可放入快递柜。',
      timeline: [
        { title: '已发出', detail: '奥克兰分拨中心 • 今天 06:55' },
        { title: '仓库已出库', detail: '萨克拉门托仓 • 今天 03:10' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-014',
      tab: 'delivered',
      date: '2023-10-18',
      amount: 236,
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      trackingNumber: '789012349988',
      shippingBadge: '配送完成',
      customerName: '诺亚·金',
      customerMember: '高级会员',
      customerEmail: 'noah.king@example.com',
      customerPhone: '+1 (555) 984-6644',
      customerOrderCount: 22,
      customerLtv: '$5.7k',
      deliveryNote: '已由家人代收。',
      timeline: [
        { title: '已签收', detail: '圣何塞，加州 • 2023-10-18 16:20' },
        { title: '派送中', detail: '圣何塞，加州 • 2023-10-18 12:10' },
        { title: '到达站点', detail: '圣何塞站点 • 2023-10-18 08:00' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-015',
      tab: 'submitted',
      date: '2023-10-18',
      amount: 88.4,
      statusKey: 'SUBMITTED',
      statusLabel: '待处理',
      trackingNumber: '--',
      shippingBadge: '待分拣',
      customerName: '奥利维亚·佩里',
      customerMember: '普通会员',
      customerEmail: 'olivia.perry@example.com',
      customerPhone: '+1 (555) 777-9200',
      customerOrderCount: 10,
      customerLtv: '$1.9k',
      deliveryNote: '请使用无接触配送。',
      timeline: [
        { title: '订单已提交', detail: '系统 • 2023-10-18 15:40' },
        { title: '等待仓库排期', detail: '计划明日分拣' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-016',
      tab: 'confirmed',
      date: '2023-10-17',
      amount: 44.6,
      statusKey: 'CONFIRMED',
      statusLabel: '已确认',
      trackingNumber: '--',
      shippingBadge: '待出库',
      customerName: '派翠克·福克斯',
      customerMember: '新客',
      customerEmail: 'patrick.fox@example.com',
      customerPhone: '+1 (555) 440-1009',
      customerOrderCount: 2,
      customerLtv: '$89',
      deliveryNote: '地址新增门牌号 108B。',
      timeline: [
        { title: '订单确认完成', detail: '2023-10-17 10:08' },
        { title: '仓库待处理', detail: '预计今晚分拣' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-017',
      tab: 'shipped',
      date: '2023-10-17',
      amount: 109.9,
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      trackingNumber: '789012349989',
      customerName: '奎因·亚当斯',
      customerMember: '企业客户',
      customerEmail: 'quinn.adams@example.com',
      customerPhone: '+1 (555) 122-9988',
      customerOrderCount: 16,
      customerLtv: '$8.4k',
      deliveryNote: '工作日 9:00-18:00 收货。',
      timeline: [
        { title: '运输途中', detail: '旧金山湾区 • 2023-10-17 13:55' },
        { title: '已离开分拨中心', detail: '奥克兰 • 2023-10-17 11:05' },
        { title: '快递员已揽收', detail: '萨克拉门托 • 2023-10-17 07:50' }
      ]
    }),
    mockOrder({
      id: 'ORD-2023-018',
      tab: 'delivered',
      date: '2023-10-16',
      amount: 59.3,
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      trackingNumber: '789012349990',
      shippingBadge: '配送完成',
      customerName: '瑞秋·伍兹',
      customerMember: '普通会员',
      customerEmail: 'rachel.woods@example.com',
      customerPhone: '+1 (555) 114-7650',
      customerOrderCount: 11,
      customerLtv: '$1.3k',
      deliveryNote: '前台签收，已拍照留档。',
      timeline: [
        { title: '已签收', detail: '旧金山 • 2023-10-16 18:02' },
        { title: '派送中', detail: '旧金山 • 2023-10-16 15:20' },
        { title: '到达分拨中心', detail: '旧金山 • 2023-10-16 09:35' }
      ]
    })
  ];
};

const statusLabelByOrderStatus = {
  SUBMITTED: '待处理',
  CONFIRMED: '已确认',
  SHIPPED: '已发出',
  DELIVERED: '已送达',
  CANCELLED: '退货处理中',
  CLOSED: '已退回'
};

const statusKeyByOrderStatus = {
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'RETURNING',
  CLOSED: 'RETURNED'
};

const shippingBadgeByStatusKey = {
  SUBMITTED: '待分拣',
  CONFIRMED: '待出库',
  DISPATCHED: '已发出',
  IN_TRANSIT: '运输中',
  DELIVERED: '配送完成',
  RETURNING: '逆向物流中',
  RETURNED: '退货完成'
};

// 将 canonical fixture 的 items 映射为抽屉可编辑行。
const buildLineItemsFromFixtureItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ name: '基础款 T 恤', qty: 1, size: 'M' }];
  }
  return items.map((item, index) => {
    const sku = canonicalSkuById[safeText(item?.skuId, '')] || null;
    return {
      name: safeText(sku?.name, `商品 ${index + 1}`),
      qty: Number.isFinite(Number(item?.qty)) ? Number(item.qty) : 1,
      size: safeText(sku?.spec, '默认')
    };
  });
};

// 将 tracking 节点映射为时间线展示模型。
const buildTimelineFromTracking = (tracking) => {
  const shipments = Array.isArray(tracking?.shipments) ? tracking.shipments : [];
  if (shipments.length === 0) {
    return [];
  }
  return shipments.map((shipment, index) => {
    const carrier = safeText(shipment?.carrier, '承运商');
    const shippedAt = safeText(shipment?.shippedAt, '');
    return {
      title: index === 0 ? '最新物流节点' : `物流节点 ${index + 1}`,
      detail: `${carrier}${shippedAt ? ` • ${shippedAt}` : ''}`
    };
  });
};

// 优先使用 shared canonical fixtures 生成 mock 列表。
const buildCanonicalMockOrders = () => {
  if (!Array.isArray(canonicalOrderFixtures) || canonicalOrderFixtures.length === 0) {
    return buildMockOrders();
  }

  return canonicalOrderFixtures.map((fixture) => {
    const orderStatus = String(fixture?.status || 'SUBMITTED').toUpperCase();
    const adminMeta = fixture?.admin || {};
    const statusKey = safeText(adminMeta.statusKey, statusKeyByOrderStatus[orderStatus] || 'SUBMITTED');
    const statusLabel = safeText(adminMeta.statusLabel, statusLabelByOrderStatus[orderStatus] || '待处理');
    const trackingNumber = safeText(
      adminMeta.trackingNumber,
      fixture?.tracking?.shipments?.[0]?.waybillNo || '--'
    );
    const lineItems = Array.isArray(adminMeta.lineItems) && adminMeta.lineItems.length > 0
      ? adminMeta.lineItems
      : buildLineItemsFromFixtureItems(fixture?.items);
    const amount = Array.isArray(fixture?.items)
      ? fixture.items.reduce((sum, item) => {
          const qty = Number(item?.qty || 0);
          const unit = Number(item?.unitPriceFen || 0);
          if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
            return sum;
          }
          return sum + (qty * unit) / 100;
        }, 0)
      : 0;
    const createdAt = safeText(fixture?.createdAt, '');
    const date = createdAt ? createdAt.slice(0, 10) : formatDate(new Date().toISOString());
    const customer = fixture?.customer || {};
    const address = fixture?.address || {};
    const timeline = Array.isArray(adminMeta.timeline) && adminMeta.timeline.length > 0
      ? adminMeta.timeline
      : buildTimelineFromTracking(fixture?.tracking);

    return mockOrder({
      id: safeText(fixture?.id, '--'),
      tab: resolveAdminTabByStatus(orderStatus, statusKey),
      date,
      amount: Number(amount.toFixed(2)),
      statusKey,
      statusLabel,
      trackingNumber,
      shippingBadge: safeText(adminMeta.shippingBadge, shippingBadgeByStatusKey[statusKey] || statusLabel),
      customerName: safeText(customer?.name || address?.receiverName, '客户'),
      customerMember: safeText(customer?.member, '普通会员'),
      customerEmail: safeText(customer?.email, '--'),
      customerPhone: safeText(customer?.phone || address?.receiverPhone, '--'),
      customerAddress: safeText(address?.detail, '加利福尼亚州旧金山市 Market St 100 号'),
      customerOrderCount: Number.isFinite(Number(customer?.orderCount)) ? Number(customer.orderCount) : 0,
      customerLtv: safeText(customer?.ltv, '$0'),
      deliveryNote: safeText(customer?.note || fixture?.remark, '暂无备注'),
      purchasedAt: safeText(adminMeta.purchasedAt, createdAt ? createdAt.replace('T', ' ').slice(0, 16) : ''),
      lineItems,
      timeline
    });
  });
};

// dev 模式页面骨架（实时接口视图）。
const mountDevLayout = (main) => {
  main.innerHTML = `
    <div class="mx-auto w-full max-w-7xl space-y-6">
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-bold text-slate-900">订单（实时）</h1>
        <p class="mt-1 text-sm text-slate-500">Dev 模式仅展示后端真实订单数据。</p>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3" data-role="metrics"></div>
      </section>

      <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-base font-semibold text-slate-900">订单列表</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-6 py-3">订单号</th>
                <th class="px-6 py-3">客户</th>
                <th class="px-6 py-3">日期</th>
                <th class="px-6 py-3">金额</th>
                <th class="px-6 py-3">状态</th>
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

// 渲染 dev 模式顶部指标。
const renderDevMetrics = (container, payload) => {
  if (!container) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  const pending = countByStatuses(items, ['SUBMITTED', 'CONFIRMED', 'PAY_PENDING', 'PENDING']);
  const delivered = countByStatuses(items, ['DELIVERED']);

  container.innerHTML = `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">订单总数</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(total)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">待处理（当前页）</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(pending)}</p></div>
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">已送达（当前页）</p><p class="mt-1 text-xl font-bold text-slate-900">${escape(delivered)}</p></div>
  `;
};

// 渲染 dev 模式订单表格。
const renderDevOrdersTable = (tbody, payload) => {
  if (!tbody) {
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="px-6 py-5">后端未返回订单数据。</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map((order) => {
      const customerName = safeText(order?.address?.receiverName, '客户');
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
    })
    .join('');
};

// 渲染 dev 模式分页摘要文案。
const renderDevSummaryText = (container, payload) => {
  if (!container) {
    return;
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  container.textContent = `当前页显示 ${items.length} 笔订单，总计 ${total} 笔。`;
};

// 初始化 dev 模式订单页（仅 real 数据）。
const initDevOrders = async (main) => {
  mountDevLayout(main);

  const response = await fetchOrders({ page: 1, pageSize: DEV_PAGE_SIZE });
  if (response.status !== 200 || !response.data) {
    renderErrorState(main, '加载 /orders 失败');
    return;
  }

  const metrics = main.querySelector('[data-role="metrics"]');
  const tbody = main.querySelector('[data-role="orders-body"]');
  const summaryText = main.querySelector('[data-role="summary-text"]');
  const logisticsPlaceholder = main.querySelector('[data-role="logistics-placeholder"]');

  renderDevMetrics(metrics, response.data);
  renderDevOrdersTable(tbody, response.data);
  renderDevSummaryText(summaryText, response.data);

  if (logisticsPlaceholder) {
    logisticsPlaceholder.innerHTML = buildEmptyState('物流详情面板', 'Dev 模式下该页面尚未接入专用实时物流详情面板。');
  }
};

// 设置单个元素文本（不存在则忽略）。
const setElementText = (selector, value) => {
  const element = document.querySelector(selector);
  if (!element) {
    return;
  }
  element.textContent = safeText(value, '--');
};

// 渲染 mock 物流时间线。
const renderMockTimeline = (timeline) => {
  const container = document.querySelector('[data-role="sorting-timeline"]');
  if (!container) {
    return;
  }
  if (!Array.isArray(timeline) || timeline.length === 0) {
    container.innerHTML = `
      <div class="relative">
        <span class="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-border-light bg-background-light"></span>
        <div class="flex flex-col gap-1">
          <p class="text-sm font-medium text-text-sub">暂无分拣信息</p>
          <p class="text-xs text-text-sub">当前状态暂无物流轨迹</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = timeline
    .map((step, index) => {
      if (index === 0) {
        return `
          <div class="relative">
            <span class="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-primary bg-surface-light"><span class="size-1.5 rounded-full bg-primary"></span></span>
            <div class="flex flex-col gap-1">
              <p class="text-sm font-bold text-text-main">${escape(safeText(step.title, '最新状态'))}</p>
              <p class="text-xs text-text-sub">${escape(safeText(step.detail, '--'))}</p>
            </div>
          </div>
        `;
      }
      return `
        <div class="relative">
          <span class="absolute -left-[21px] top-1 flex size-3.5 items-center justify-center rounded-full border-2 border-border-light bg-background-light"></span>
          <div class="flex flex-col gap-1">
            <p class="text-sm font-medium text-text-sub">${escape(safeText(step.title, '--'))}</p>
            <p class="text-xs text-text-sub">${escape(safeText(step.detail, '--'))}</p>
          </div>
        </div>
      `;
    })
    .join('');
};

// 渲染 mock 物流详情侧栏。
const renderMockLogisticsPanel = (order) => {
  if (!order) {
    setElementText('[data-role="tracking-number"]', '--');
    setElementText('[data-role="shipping-badge-label"]', '暂无状态');
    setElementText('[data-role="customer-name"]', '--');
    setElementText('[data-role="customer-email"]', '--');
    setElementText('[data-role="customer-phone"]', '--');
    setElementText('[data-role="customer-order-count"]', '--');
    setElementText('[data-role="customer-ltv"]', '--');
    setElementText('[data-role="delivery-note"]', '暂无备注');
    renderMockTimeline([]);
    return;
  }

  setElementText('[data-role="tracking-number"]', order.trackingNumber);
  setElementText('[data-role="shipping-badge-label"]', order.shippingBadge);
  setElementText('[data-role="customer-name"]', order.customer.name);
  setElementText('[data-role="customer-email"]', order.customer.email);
  setElementText('[data-role="customer-phone"]', order.customer.phone);
  setElementText('[data-role="customer-order-count"]', `${order.customer.orderCount} 个订单`);
  setElementText('[data-role="customer-ltv"]', `客户累计下单金额 ${order.customer.ltv}`);
  setElementText('[data-role="delivery-note"]', `“${safeText(order.customer.note, '暂无备注')}”`);
  renderMockTimeline(order.timeline);
};

// 初始化 mock 模式订单页（含分页、Tab、详情抽屉）。
const initMockOrders = () => {
  const orders = buildCanonicalMockOrders();
  const state = {
    tab: 'shipped',
    page: 1,
    selectedId: ''
  };

  const tabElements = Array.from(document.querySelectorAll('[data-role="order-tab"]'));
  const tbody = document.querySelector('[data-role="orders-body"]');
  const summary = document.querySelector('[data-role="orders-summary"]');
  const prevButton = document.querySelector('[data-role="orders-prev-page"]');
  const nextButton = document.querySelector('[data-role="orders-next-page"]');

  if (!tbody || !summary || !prevButton || !nextButton || tabElements.length === 0) {
    return;
  }

  const byTab = (tab) => orders.filter((order) => order.tab === tab);
  const findById = (orderId) => orders.find((order) => order.id === orderId);
  const updateOrderById = (nextOrder) => {
    const index = orders.findIndex((order) => order.id === nextOrder.id);
    if (index < 0) {
      return;
    }
    orders[index] = nextOrder;
    state.selectedId = nextOrder.id;
    render();
  };
  const totalPages = (tab) => Math.max(1, Math.ceil(byTab(tab).length / MOCK_PAGE_SIZE));

  const applyTabStyles = () => {
    tabElements.forEach((tabEl) => {
      const tabKey = tabEl.getAttribute('data-tab');
      const countEl = tabEl.querySelector('[data-role="order-tab-count"]');
      const count = byTab(tabKey).length;
      const isActive = tabKey === state.tab;
      const isReturns = tabKey === 'returns';

      tabEl.className = isActive
        ? isReturns
          ? TAB_CLASS.returnsActive
          : TAB_CLASS.normalActive
        : isReturns
          ? TAB_CLASS.returnsInactive
          : TAB_CLASS.normalInactive;
      if (isActive) {
        tabEl.setAttribute('aria-current', 'page');
      } else {
        tabEl.removeAttribute('aria-current');
      }

      if (countEl) {
        countEl.textContent = String(count);
        if (isReturns) {
          countEl.className = TAB_CLASS.countReturns;
        } else {
          countEl.className = isActive ? TAB_CLASS.countActive : TAB_CLASS.countInactive;
        }
      }
    });
  };

  const getPagedOrders = () => {
    const filtered = byTab(state.tab);
    const pages = totalPages(state.tab);
    if (state.page > pages) {
      state.page = pages;
    }
    if (state.page < 1) {
      state.page = 1;
    }
    const start = (state.page - 1) * MOCK_PAGE_SIZE;
    return {
      filtered,
      start,
      pageItems: filtered.slice(start, start + MOCK_PAGE_SIZE)
    };
  };

  const ensureSelectedOrder = (filtered, pageItems) => {
    const selectedInFiltered = filtered.find((order) => order.id === state.selectedId);
    if (!selectedInFiltered) {
      state.selectedId = pageItems[0]?.id || '';
    }
  };

  const renderSummary = (filteredCount, start, visibleCount) => {
    if (filteredCount === 0 || visibleCount === 0) {
      summary.innerHTML =
        '显示第 <span class="font-medium text-text-main dark:text-text-main-dark">0</span> 到 <span class="font-medium text-text-main dark:text-text-main-dark">0</span> 条，共 <span class="font-medium text-text-main dark:text-text-main-dark">0</span> 条结果';
      return;
    }
    const from = start + 1;
    const to = Math.min(start + visibleCount, filteredCount);
    summary.innerHTML = `显示第 <span class="font-medium text-text-main dark:text-text-main-dark">${from}</span> 到 <span class="font-medium text-text-main dark:text-text-main-dark">${to}</span> 条，共 <span class="font-medium text-text-main dark:text-text-main-dark">${filteredCount}</span> 条结果`;
  };

  const renderTable = (pageItems) => {
    if (pageItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-6 text-sm text-text-sub">当前状态下暂无订单。</td></tr>`;
      return;
    }

    tbody.innerHTML = pageItems
      .map((order) => {
        const isActive = state.selectedId === order.id;
        const rowClass = isActive
          ? 'group transition-colors cursor-pointer bg-primary-light/30'
          : 'group hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer';
        const amount = `$${Number(order.amount || 0).toFixed(2)}`;
        return `
          <tr class="${rowClass}" data-order-id="${escape(order.id)}">
            <td class="px-6 py-4 font-medium text-primary">#${escape(order.id)}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="size-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">${escape(initials(order.customer.name))}</div>
                <div>
                  <p class="text-text-main dark:text-text-main-dark font-medium">${escape(order.customer.name)}</p>
                  <p class="text-xs text-text-sub dark:text-text-sub-dark">${escape(safeText(order.customer.member, '普通会员'))}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-text-sub dark:text-text-sub-dark">${escape(order.date)}</td>
            <td class="px-6 py-4 font-medium text-text-main dark:text-text-main-dark">${escape(amount)}</td>
            <td class="px-6 py-4">${buildStatusBadge(order.statusKey, order.statusLabel)}</td>
            <td class="px-6 py-4 text-right">
              <button data-role="view-order" data-order-id="${escape(order.id)}" class="text-primary hover:text-primary-dark font-medium text-sm">查看</button>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const renderPagination = (filteredCount) => {
    const pages = Math.max(1, Math.ceil(filteredCount / MOCK_PAGE_SIZE));
    prevButton.disabled = state.page <= 1;
    nextButton.disabled = state.page >= pages;
  };

  const render = () => {
    applyTabStyles();
    const { filtered, start, pageItems } = getPagedOrders();
    ensureSelectedOrder(filtered, pageItems);
    renderTable(pageItems);
    renderSummary(filtered.length, start, pageItems.length);
    renderPagination(filtered.length);
    const selectedOrder = filtered.find((order) => order.id === state.selectedId) || pageItems[0] || null;
    renderMockLogisticsPanel(selectedOrder);
  };

  tabElements.forEach((tabEl) => {
    tabEl.addEventListener('click', (event) => {
      event.preventDefault();
      const tab = tabEl.getAttribute('data-tab');
      if (!TAB_KEYS.includes(tab)) {
        return;
      }
      state.tab = tab;
      state.page = 1;
      state.selectedId = '';
      render();
    });
  });

  prevButton.addEventListener('click', () => {
    state.page = Math.max(1, state.page - 1);
    render();
  });

  nextButton.addEventListener('click', () => {
    const pages = totalPages(state.tab);
    state.page = Math.min(pages, state.page + 1);
    render();
  });

  tbody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const viewButton = target.closest('[data-role="view-order"]');
    const row = target.closest('tr[data-order-id]');
    const orderId = safeText(viewButton?.getAttribute('data-order-id') || row?.getAttribute('data-order-id'), '');
    if (!orderId) {
      return;
    }
    state.selectedId = orderId;
    render();
    if (viewButton) {
      openOrderDetailDrawer(findById(orderId), updateOrderById);
    }
  });

  render();
};

// 订单页入口：先过守卫，再按模式走 dev/mock 初始化。
const initOrders = async () => {
  const context = await ensureProtectedPage();
  if (!context) {
    return;
  }

  const main = document.querySelector('main');
  if (!main) {
    return;
  }

  if (context.mode === 'dev') {
    await initDevOrders(main);
    return;
  }

  initMockOrders();
};

void initOrders();
