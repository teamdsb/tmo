import { canonicalOrderFixtures, canonicalSkuById, resolveAdminTabByStatus } from '../../../../../../packages/shared/src/mock-data/index.js';

export type OrderTabKey = 'submitted' | 'confirmed' | 'shipped' | 'delivered' | 'returns';
export type OrderStatusTone = 'blue' | 'amber' | 'green' | 'gray' | 'red';

export type OrderLineItem = {
  name: string;
  qty: number;
  size: string;
};

export type OrderTimelineItem = {
  title: string;
  detail: string;
};

export type OrderCustomer = {
  name: string;
  member: string;
  email: string;
  phone: string;
  address: string;
  orderCount: number;
  ltv: string;
  note: string;
};

export type AdminOrderRecord = {
  id: string;
  tab: OrderTabKey;
  date: string;
  amount: number;
  statusKey: string;
  statusLabel: string;
  statusTone: OrderStatusTone;
  trackingNumber: string;
  shippingBadge: string;
  customer: OrderCustomer;
  purchasedAt: string;
  lineItems: OrderLineItem[];
  timeline: OrderTimelineItem[];
};

export type OrdersApiPayload = {
  items?: unknown[];
  total?: number;
};

export const ORDER_TABS: Array<{ key: OrderTabKey; label: string; isReturns?: boolean }> = [
  { key: 'submitted', label: '已提交' },
  { key: 'confirmed', label: '已确认' },
  { key: 'shipped', label: '已发货' },
  { key: 'delivered', label: '已送达' },
  { key: 'returns', label: '退货', isReturns: true }
];

const statusLabelByOrderStatus: Record<string, string> = {
  SUBMITTED: '待处理',
  CONFIRMED: '已确认',
  SHIPPED: '已发出',
  DELIVERED: '已送达',
  CANCELLED: '退货处理中',
  CLOSED: '已退回',
  IN_TRANSIT: '运输中',
  DISPATCHED: '已发出',
  RETURNING: '退货处理中',
  RETURNED: '已退回'
};

const statusKeyByOrderStatus: Record<string, string> = {
  SUBMITTED: 'SUBMITTED',
  CONFIRMED: 'CONFIRMED',
  SHIPPED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'RETURNING',
  CLOSED: 'RETURNED'
};

const shippingBadgeByStatusKey: Record<string, string> = {
  SUBMITTED: '待分拣',
  CONFIRMED: '待出库',
  DISPATCHED: '已发出',
  IN_TRANSIT: '运输中',
  DELIVERED: '配送完成',
  RETURNING: '逆向物流中',
  RETURNED: '退货完成'
};

const statusToneByStatusKey: Record<string, OrderStatusTone> = {
  SUBMITTED: 'gray',
  CONFIRMED: 'blue',
  DISPATCHED: 'amber',
  IN_TRANSIT: 'blue',
  DELIVERED: 'green',
  RETURNING: 'red',
  RETURNED: 'red'
};

const safeText = (value: unknown, fallback = '--') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
};

const formatDate = (value?: string) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10) || '--';
  }
  return date.toISOString().slice(0, 10);
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'NA';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const statusTone = (statusKey: string): OrderStatusTone => {
  return statusToneByStatusKey[safeText(statusKey, 'SUBMITTED').toUpperCase()] || 'gray';
};

const buildFallbackLineItems = (): OrderLineItem[] => [{ name: '基础款 T 恤', qty: 1, size: 'M' }];

const buildLineItemsFromFixtureItems = (items: unknown[]): OrderLineItem[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return buildFallbackLineItems();
  }
  return items.map((item, index) => {
    const skuId = safeText((item as { skuId?: string })?.skuId, '');
    const sku = (canonicalSkuById as Record<string, { name?: string; spec?: string }>)[skuId] || null;
    return {
      name: safeText(sku?.name, `商品 ${index + 1}`),
      qty: Number.isFinite(Number((item as { qty?: number })?.qty)) ? Number((item as { qty?: number }).qty) : 1,
      size: safeText(sku?.spec, '默认')
    };
  });
};

const buildTimelineFromTracking = (tracking: unknown): OrderTimelineItem[] => {
  const shipments = Array.isArray((tracking as { shipments?: unknown[] })?.shipments)
    ? ((tracking as { shipments?: unknown[] }).shipments as Array<{ carrier?: string; shippedAt?: string }>)
    : [];
  if (shipments.length === 0) {
    return [];
  }
  return shipments.map((shipment, index) => ({
    title: index === 0 ? '最新物流节点' : `物流节点 ${index + 1}`,
    detail: `${safeText(shipment?.carrier, '承运商')}${shipment?.shippedAt ? ` • ${shipment.shippedAt}` : ''}`
  }));
};

const createOrder = (input: Omit<AdminOrderRecord, 'statusTone'>): AdminOrderRecord => ({
  ...input,
  statusTone: statusTone(input.statusKey)
});

const fallbackMockOrders = (): AdminOrderRecord[] => [
  createOrder({
    id: 'ORD-2023-001',
    tab: 'shipped',
    date: '2023-10-24',
    amount: 120.5,
    statusKey: 'IN_TRANSIT',
    statusLabel: '运输中',
    trackingNumber: '789012349981',
    shippingBadge: '运输途中',
    customer: {
      name: '艾丽丝·史密斯',
      member: '高级会员',
      email: 'alice.smith@example.com',
      phone: '+1 (555) 123-4567',
      address: '加利福尼亚州旧金山市 Market St 100 号',
      orderCount: 54,
      ltv: '$4.2k',
      note: '若家中无人，请将包裹放在后门门廊。门禁码 1234。'
    },
    purchasedAt: '2023-10-24 09:15',
    lineItems: [{ name: '基础款 T 恤', qty: 2, size: 'M' }],
    timeline: [
      { title: '已到达分拨中心', detail: '旧金山，加州 • 今天 10:24' },
      { title: '已离开发货网点', detail: '奥克兰，加州 • 昨天 20:00' }
    ]
  }),
  createOrder({
    id: 'ORD-2023-002',
    tab: 'confirmed',
    date: '2023-10-23',
    amount: 45,
    statusKey: 'CONFIRMED',
    statusLabel: '已确认',
    trackingNumber: '--',
    shippingBadge: '待出库',
    customer: {
      name: '鲍勃·琼斯',
      member: '普通会员',
      email: 'bob.jones@example.com',
      phone: '+1 (555) 118-2201',
      address: '加利福尼亚州奥克兰市 Broadway 22 号',
      orderCount: 12,
      ltv: '$920',
      note: '工作日白天送达前请先电话联系。'
    },
    purchasedAt: '2023-10-23 08:20',
    lineItems: [{ name: '无线耳机 Pro', qty: 1, size: '黑色' }],
    timeline: [{ title: '订单已确认', detail: '支付已完成 • 今天 09:25' }]
  }),
  createOrder({
    id: 'ORD-2023-003',
    tab: 'submitted',
    date: '2023-10-22',
    amount: 35.5,
    statusKey: 'SUBMITTED',
    statusLabel: '待处理',
    trackingNumber: '--',
    shippingBadge: '待分拣',
    customer: {
      name: '埃文·赖特',
      member: '新客',
      email: 'evan.wright@example.com',
      phone: '+1 (555) 045-1299',
      address: '加利福尼亚州萨克拉门托市 Pine St 8 号',
      orderCount: 1,
      ltv: '$35.5',
      note: '无需电话，直接送货。'
    },
    purchasedAt: '2023-10-22 13:10',
    lineItems: [{ name: '跑步水壶', qty: 1, size: '默认' }],
    timeline: [{ title: '订单已提交', detail: '系统 • 2023-10-22 13:10' }]
  }),
  createOrder({
    id: 'ORD-2023-004',
    tab: 'delivered',
    date: '2023-10-22',
    amount: 210,
    statusKey: 'DELIVERED',
    statusLabel: '已送达',
    trackingNumber: '789012349984',
    shippingBadge: '配送完成',
    customer: {
      name: '戴安娜·普林斯',
      member: '企业客户',
      email: 'diana.prince@example.com',
      phone: '+1 (555) 555-8888',
      address: '加利福尼亚州旧金山市 Howard St 188 号',
      orderCount: 7,
      ltv: '$6.8k',
      note: '签收人：前台管理员 David。'
    },
    purchasedAt: '2023-10-22 11:10',
    lineItems: [{ name: '真皮轻薄钱包', qty: 2, size: '棕色标准款' }],
    timeline: [{ title: '已签收', detail: '旧金山，加州 • 今天 11:10' }]
  }),
  createOrder({
    id: 'ORD-2023-005',
    tab: 'returns',
    date: '2023-10-21',
    amount: 68.9,
    statusKey: 'RETURNING',
    statusLabel: '退货处理中',
    trackingNumber: 'RET-73920011',
    shippingBadge: '逆向物流中',
    customer: {
      name: '格蕾丝·陈',
      member: '高级会员',
      email: 'grace.chen@example.com',
      phone: '+1 (555) 775-3900',
      address: '加利福尼亚州伯克利市 College Ave 90 号',
      orderCount: 33,
      ltv: '$3.1k',
      note: '商品外包装轻微破损，申请退货。'
    },
    purchasedAt: '2023-10-21 08:40',
    lineItems: [{ name: '极简陶瓷花瓶', qty: 1, size: '默认' }],
    timeline: [{ title: '退货包裹运输中', detail: '奥克兰，加州 • 今天 12:05' }]
  }),
  createOrder({
    id: 'ORD-2023-006',
    tab: 'shipped',
    date: '2023-10-21',
    amount: 74,
    statusKey: 'DISPATCHED',
    statusLabel: '已发出',
    trackingNumber: '789012349986',
    shippingBadge: '已发出',
    customer: {
      name: '伊莎贝拉·杨',
      member: '普通会员',
      email: 'isabella.yang@example.com',
      phone: '+1 (555) 600-3333',
      address: '加利福尼亚州帕洛阿尔托市 Castro St 12 号',
      orderCount: 5,
      ltv: '$540',
      note: '请在下午 5 点后配送。'
    },
    purchasedAt: '2023-10-21 03:40',
    lineItems: [{ name: '性能跑鞋', qty: 1, size: '灰色 42' }],
    timeline: [{ title: '已发出', detail: '奥克兰分拨中心 • 今天 06:55' }]
  })
];

export const buildMockOrders = (): AdminOrderRecord[] => {
  if (!Array.isArray(canonicalOrderFixtures) || canonicalOrderFixtures.length === 0) {
    return fallbackMockOrders();
  }

  return canonicalOrderFixtures.map((fixture) => {
    const order = fixture as {
      address?: { detail?: string; receiverName?: string; receiverPhone?: string };
      admin?: {
        lineItems?: OrderLineItem[];
        purchasedAt?: string;
        shippingBadge?: string;
        statusKey?: string;
        statusLabel?: string;
        timeline?: OrderTimelineItem[];
        trackingNumber?: string;
      };
      createdAt?: string;
      customer?: { email?: string; ltv?: string; member?: string; name?: string; note?: string; orderCount?: number; phone?: string };
      id?: string;
      items?: unknown[];
      remark?: string;
      status?: string;
      tracking?: { shipments?: Array<{ waybillNo?: string }> };
    };

    const orderStatus = safeText(order.status, 'SUBMITTED').toUpperCase();
    const adminMeta = order.admin || {};
    const statusKey = safeText(adminMeta.statusKey, statusKeyByOrderStatus[orderStatus] || 'SUBMITTED');
    const statusLabel = safeText(adminMeta.statusLabel, statusLabelByOrderStatus[orderStatus] || '待处理');
    const amount = Array.isArray(order.items)
      ? order.items.reduce<number>((sum, item) => {
          const qty = Number((item as { qty?: number })?.qty || 0);
          const unit = Number((item as { unitPriceFen?: number })?.unitPriceFen || 0);
          if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
            return sum;
          }
          return sum + (qty * unit) / 100;
        }, 0)
      : 0;
    const createdAt = safeText(order.createdAt, '');
    const lineItems = Array.isArray(adminMeta.lineItems) && adminMeta.lineItems.length > 0
      ? adminMeta.lineItems
      : buildLineItemsFromFixtureItems(order.items || []);
    const timeline = Array.isArray(adminMeta.timeline) && adminMeta.timeline.length > 0
      ? adminMeta.timeline
      : buildTimelineFromTracking(order.tracking);

    return createOrder({
      id: safeText(order.id, '--'),
      tab: resolveAdminTabByStatus(orderStatus, statusKey) as OrderTabKey,
      date: formatDate(createdAt),
      amount: Number(amount.toFixed(2)),
      statusKey,
      statusLabel,
      trackingNumber: safeText(adminMeta.trackingNumber, order.tracking?.shipments?.[0]?.waybillNo || '--'),
      shippingBadge: safeText(adminMeta.shippingBadge, shippingBadgeByStatusKey[statusKey] || statusLabel),
      customer: {
        name: safeText(order.customer?.name || order.address?.receiverName, '客户'),
        member: safeText(order.customer?.member, '普通会员'),
        email: safeText(order.customer?.email, '--'),
        phone: safeText(order.customer?.phone || order.address?.receiverPhone, '--'),
        address: safeText(order.address?.detail, '加利福尼亚州旧金山市 Market St 100 号'),
        orderCount: Number.isFinite(Number(order.customer?.orderCount)) ? Number(order.customer?.orderCount) : 0,
        ltv: safeText(order.customer?.ltv, '$0'),
        note: safeText(order.customer?.note || order.remark, '暂无备注')
      },
      purchasedAt: safeText(adminMeta.purchasedAt, createdAt ? createdAt.replace('T', ' ').slice(0, 16) : ''),
      lineItems,
      timeline
    });
  });
};

export const buildDevOrders = (payload: OrdersApiPayload): AdminOrderRecord[] => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item, index) => {
    const order = item as {
      address?: { detail?: string; receiverName?: string; receiverPhone?: string };
      createdAt?: string;
      customer?: { email?: string; name?: string; phone?: string };
      id?: string;
      items?: Array<{ qty?: number; unitPriceFen?: number; skuId?: string }>;
      status?: string;
      tracking?: { shipments?: Array<{ carrier?: string; shippedAt?: string; waybillNo?: string }> };
    };
    const orderStatus = safeText(order.status, 'SUBMITTED').toUpperCase();
    const statusKey = statusKeyByOrderStatus[orderStatus] || orderStatus;
    const statusLabel = statusLabelByOrderStatus[orderStatus] || orderStatus;
    const amount = Array.isArray(order.items)
      ? order.items.reduce((sum, line) => {
          const qty = Number(line?.qty || 0);
          const unit = Number(line?.unitPriceFen || 0);
          if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
            return sum;
          }
          return sum + (qty * unit) / 100;
        }, 0)
      : 0;
    return createOrder({
      id: safeText(order.id, `ORDER-${index + 1}`),
      tab: (resolveAdminTabByStatus(orderStatus, statusKey) || 'submitted') as OrderTabKey,
      date: formatDate(order.createdAt),
      amount: Number(amount.toFixed(2)),
      statusKey,
      statusLabel,
      trackingNumber: safeText(order.tracking?.shipments?.[0]?.waybillNo, '--'),
      shippingBadge: shippingBadgeByStatusKey[statusKey] || statusLabel,
      customer: {
        name: safeText(order.customer?.name || order.address?.receiverName, '客户'),
        member: '实时订单',
        email: safeText(order.customer?.email, '--'),
        phone: safeText(order.customer?.phone || order.address?.receiverPhone, '--'),
        address: safeText(order.address?.detail, '--'),
        orderCount: 0,
        ltv: '--',
        note: 'Dev 模式下暂未接入客户备注。'
      },
      purchasedAt: safeText(order.createdAt, '--'),
      lineItems: buildLineItemsFromFixtureItems(order.items || []),
      timeline: buildTimelineFromTracking(order.tracking)
    });
  });
};

export const countByTab = (orders: AdminOrderRecord[], tab: OrderTabKey) => {
  return orders.filter((order) => order.tab === tab).length;
};

export const getStatusTone = (statusKey: string): OrderStatusTone => statusTone(statusKey);

export const formatAmount = (amount: number) => `$${amount.toFixed(2)}`;

export const getInitials = (name: string) => initials(name);
