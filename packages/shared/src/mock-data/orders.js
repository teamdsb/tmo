import { canonicalSkuById } from './catalog.js';

const firstSkuPriceFen = (skuId, fallbackFen = 0) => {
  const price = canonicalSkuById[skuId]?.priceTiers?.[0]?.unitPriceFen;
  if (Number.isFinite(price)) {
    return Number(price);
  }
  return fallbackFen;
};

const createOrderItem = (skuId, qty, unitPriceFen = firstSkuPriceFen(skuId, 0)) => {
  const safeQty = Number.isFinite(Number(qty)) ? Math.max(1, Math.floor(Number(qty))) : 1;
  return {
    skuId,
    qty: safeQty,
    unitPriceFen: Number.isFinite(Number(unitPriceFen)) ? Math.max(0, Math.floor(Number(unitPriceFen))) : 0
  };
};

const createFixture = ({
  id,
  status,
  createdAt,
  updatedAt,
  remark,
  address,
  customer,
  items,
  tracking,
  admin
}) => ({
  id,
  status,
  createdAt,
  updatedAt: updatedAt || createdAt,
  remark: remark || '',
  address,
  customer,
  items,
  tracking: tracking || { orderId: id, shipments: [] },
  admin
});

export const canonicalOrderFixtures = [
  createFixture({
    id: 'ORD-2026-001',
    status: 'SHIPPED',
    createdAt: '2026-02-24T10:24:00Z',
    remark: '若家中无人，请将包裹放在后门门廊。门禁码 1234。',
    address: {
      receiverName: '艾丽丝·史密斯',
      receiverPhone: '+1 (555) 123-4567',
      detail: '加利福尼亚州旧金山市 Market St 100 号'
    },
    customer: {
      name: '艾丽丝·史密斯',
      member: '高级会员',
      email: 'alice.smith@example.com',
      phone: '+1 (555) 123-4567',
      orderCount: 54,
      ltv: '$4.2k',
      note: '若家中无人，请将包裹放在后门门廊。门禁码 1234。'
    },
    items: [
      createOrderItem('sku-tee-classic-blu-m', 1),
      createOrderItem('sku-running-bottle-600', 2)
    ],
    tracking: {
      orderId: 'ORD-2026-001',
      shipments: [
        { carrier: 'FedEx', waybillNo: 'FX-789012349981', shippedAt: '2026-02-24T12:00:00Z' }
      ]
    },
    admin: {
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      shippingBadge: '运输中',
      purchasedAt: '2026-02-24 10:24',
      timeline: [
        { title: '已到达分拨中心', detail: '旧金山，加州 • 今天 10:24' },
        { title: '已离开发货网点', detail: '奥克兰，加州 • 今天 06:40' },
        { title: '快递员已揽收', detail: '萨克拉门托，加州 • 今天 00:30' }
      ],
      lineItems: [
        { name: '经典纯棉 T 恤', qty: 1, size: 'M' },
        { name: '跑步水壶', qty: 2, size: '600ml' }
      ]
    }
  }),
  createFixture({
    id: 'ORD-2026-002',
    status: 'SHIPPED',
    createdAt: '2026-02-23T08:20:00Z',
    address: {
      receiverName: '鲍勃·琼斯',
      receiverPhone: '+1 (555) 118-2201',
      detail: '加利福尼亚州奥克兰市 Franklin St 22 号'
    },
    customer: {
      name: '鲍勃·琼斯',
      member: '普通会员',
      email: 'bob.jones@example.com',
      phone: '+1 (555) 118-2201',
      orderCount: 12,
      ltv: '$920',
      note: '工作日白天送达前请先电话联系。'
    },
    items: [
      createOrderItem('sku-earbuds-pro-blk', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-002',
      shipments: [
        { carrier: 'UPS', waybillNo: '1Z789012349982', shippedAt: '2026-02-23T08:20:00Z' }
      ]
    },
    admin: {
      statusKey: 'DISPATCHED',
      statusLabel: '已发出',
      shippingBadge: '已发出',
      purchasedAt: '2026-02-23 08:20',
      timeline: [
        { title: '已发出', detail: '奥克兰分拨中心 • 今天 08:20' },
        { title: '仓库已出库', detail: '萨克拉门托仓 • 今天 06:40' },
        { title: '订单已打包', detail: '萨克拉门托仓 • 昨天 22:10' }
      ],
      lineItems: [{ name: '无线耳机 Pro', qty: 1, size: '黑色' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-003',
    status: 'DELIVERED',
    createdAt: '2026-02-22T11:10:00Z',
    address: {
      receiverName: '查理·布朗',
      receiverPhone: '+1 (555) 900-7712',
      detail: '加利福尼亚州圣何塞市 5th Ave 31 号'
    },
    customer: {
      name: '查理·布朗',
      member: '高级会员',
      email: 'charlie.brown@example.com',
      phone: '+1 (555) 900-7712',
      orderCount: 28,
      ltv: '$2.6k',
      note: '请放到前台代收。'
    },
    items: [
      createOrderItem('sku-running-shoes-gry-42', 1),
      createOrderItem('sku-running-bottle-600', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-003',
      shipments: [
        { carrier: 'USPS', waybillNo: '940010000000000003', shippedAt: '2026-02-22T04:00:00Z' }
      ]
    },
    admin: {
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      shippingBadge: '配送完成',
      purchasedAt: '2026-02-22 11:10',
      timeline: [
        { title: '已签收', detail: '圣何塞，加州 • 今天 11:10' },
        { title: '派送中', detail: '圣何塞，加州 • 今天 08:40' },
        { title: '已到达分拨中心', detail: '圣何塞，加州 • 今天 06:20' }
      ],
      lineItems: [
        { name: '性能跑鞋', qty: 1, size: '42' },
        { name: '跑步水壶', qty: 1, size: '600ml' }
      ]
    }
  }),
  createFixture({
    id: 'ORD-2026-004',
    status: 'SUBMITTED',
    createdAt: '2026-02-22T13:10:00Z',
    address: {
      receiverName: '戴安娜·普林斯',
      receiverPhone: '+1 (555) 555-8888',
      detail: '加利福尼亚州旧金山市 Embarcadero 80 号'
    },
    customer: {
      name: '戴安娜·普林斯',
      member: '企业客户',
      email: 'diana.prince@example.com',
      phone: '+1 (555) 555-8888',
      orderCount: 7,
      ltv: '$6.8k',
      note: '签收后请发送电子回执。'
    },
    items: [
      createOrderItem('sku-backpack-business-blk', 2)
    ],
    admin: {
      statusKey: 'SUBMITTED',
      statusLabel: '待处理',
      shippingBadge: '待分拣',
      purchasedAt: '2026-02-22 13:10',
      timeline: [
        { title: '订单已提交', detail: '系统 • 2026-02-22 13:10' },
        { title: '等待仓库确认', detail: '预计 2 小时内完成分拣' }
      ],
      lineItems: [{ name: '商务双肩包', qty: 2, size: '20L' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-005',
    status: 'CONFIRMED',
    createdAt: '2026-02-22T09:25:00Z',
    address: {
      receiverName: '埃文·赖特',
      receiverPhone: '+1 (555) 045-1299',
      detail: '加利福尼亚州洛杉矶市 Sunset Blvd 901 号'
    },
    customer: {
      name: '埃文·赖特',
      member: '新客',
      email: 'evan.wright@example.com',
      phone: '+1 (555) 045-1299',
      orderCount: 1,
      ltv: '$35.5',
      note: '无需电话，直接送货。'
    },
    items: [
      createOrderItem('sku-linen-shirt-wht-m', 3)
    ],
    admin: {
      statusKey: 'CONFIRMED',
      statusLabel: '已确认',
      shippingBadge: '待出库',
      purchasedAt: '2026-02-22 09:25',
      timeline: [
        { title: '库存锁定完成', detail: '仓库系统 • 今天 09:30' },
        { title: '订单已确认', detail: '支付已完成 • 今天 09:25' }
      ],
      lineItems: [{ name: '亚麻衬衫', qty: 3, size: 'M' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-006',
    status: 'SHIPPED',
    createdAt: '2026-02-21T09:45:00Z',
    address: {
      receiverName: '费欧娜·李',
      receiverPhone: '+1 (555) 305-1200',
      detail: '加利福尼亚州圣马特奥市 Broadway 120 号'
    },
    customer: {
      name: '费欧娜·李',
      member: '普通会员',
      email: 'fiona.lee@example.com',
      phone: '+1 (555) 305-1200',
      orderCount: 9,
      ltv: '$1.4k',
      note: '请附带发票。'
    },
    items: [
      createOrderItem('sku-watch-smart-s-41-blk', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-006',
      shipments: [
        { carrier: 'FedEx', waybillNo: 'FX-789012349986', shippedAt: '2026-02-21T05:45:00Z' }
      ]
    },
    admin: {
      statusKey: 'IN_TRANSIT',
      statusLabel: '运输中',
      shippingBadge: '运输中',
      purchasedAt: '2026-02-21 09:45',
      timeline: [
        { title: '运输途中', detail: '帕洛阿尔托，加州 • 今天 09:45' },
        { title: '已到达转运中心', detail: '奥克兰，加州 • 今天 04:10' },
        { title: '快递员已揽收', detail: '萨克拉门托，加州 • 昨天 18:05' }
      ],
      lineItems: [{ name: '智能手表 S', qty: 1, size: '41mm' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-007',
    status: 'CANCELLED',
    createdAt: '2026-02-21T12:05:00Z',
    address: {
      receiverName: '格蕾丝·陈',
      receiverPhone: '+1 (555) 775-3900',
      detail: '加利福尼亚州奥克兰市 Lakeside Dr 51 号'
    },
    customer: {
      name: '格蕾丝·陈',
      member: '高级会员',
      email: 'grace.chen@example.com',
      phone: '+1 (555) 775-3900',
      orderCount: 33,
      ltv: '$3.1k',
      note: '商品外包装轻微破损，申请退货。'
    },
    items: [
      createOrderItem('sku-keyboard-k87-red', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-007',
      shipments: [
        { carrier: 'UPS', waybillNo: 'RET-73920011', shippedAt: '2026-02-21T08:40:00Z' }
      ]
    },
    admin: {
      statusKey: 'RETURNING',
      statusLabel: '退货处理中',
      shippingBadge: '逆向物流中',
      purchasedAt: '2026-02-21 12:05',
      timeline: [
        { title: '退货包裹运输中', detail: '奥克兰，加州 • 今天 12:05' },
        { title: '承运商已揽收', detail: '旧金山，加州 • 今天 08:40' },
        { title: '退货申请已通过', detail: '客服中心 • 昨天 19:20' }
      ],
      lineItems: [{ name: '电竞键盘 K87', qty: 1, size: '红轴' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-008',
    status: 'CLOSED',
    createdAt: '2026-02-20T10:50:00Z',
    address: {
      receiverName: '亨利·摩尔',
      receiverPhone: '+1 (555) 984-0080',
      detail: '加利福尼亚州萨克拉门托市 River Rd 19 号'
    },
    customer: {
      name: '亨利·摩尔',
      member: '企业客户',
      email: 'henry.moore@example.com',
      phone: '+1 (555) 984-0080',
      orderCount: 64,
      ltv: '$12.5k',
      note: '退款原路返回银行卡。'
    },
    items: [
      createOrderItem('sku-vase-minimal-wht', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-008',
      shipments: [
        { carrier: 'USPS', waybillNo: 'RET-73920012', shippedAt: '2026-02-20T06:10:00Z' }
      ]
    },
    admin: {
      statusKey: 'RETURNED',
      statusLabel: '已退回',
      shippingBadge: '退货完成',
      purchasedAt: '2026-02-20 10:50',
      timeline: [
        { title: '退货入库完成', detail: '萨克拉门托仓 • 今天 10:50' },
        { title: '质检通过', detail: '仓库质检 • 今天 09:15' },
        { title: '退货签收', detail: '仓库前台 • 昨天 18:40' }
      ],
      lineItems: [{ name: '极简陶瓷花瓶', qty: 1, size: '白色' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-009',
    status: 'DELIVERED',
    createdAt: '2026-02-20T17:20:00Z',
    address: {
      receiverName: '伊莎贝拉·杨',
      receiverPhone: '+1 (555) 600-3333',
      detail: '加利福尼亚州圣马特奥市 Harbor Rd 43 号'
    },
    customer: {
      name: '伊莎贝拉·杨',
      member: '普通会员',
      email: 'isabella.yang@example.com',
      phone: '+1 (555) 600-3333',
      orderCount: 5,
      ltv: '$540',
      note: '请在下午 5 点后配送。'
    },
    items: [
      createOrderItem('sku-running-shoes-gry-43', 1),
      createOrderItem('sku-watch-smart-s-45-slv', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-009',
      shipments: [
        { carrier: 'FedEx', waybillNo: 'FX-789012349989', shippedAt: '2026-02-20T09:15:00Z' }
      ]
    },
    admin: {
      statusKey: 'DELIVERED',
      statusLabel: '已送达',
      shippingBadge: '配送完成',
      purchasedAt: '2026-02-20 17:20',
      timeline: [
        { title: '客户已签收', detail: '圣马特奥，加州 • 昨天 17:20' },
        { title: '派送员投递中', detail: '圣马特奥，加州 • 昨天 14:15' },
        { title: '已到达站点', detail: '旧金山，加州 • 昨天 10:40' }
      ],
      lineItems: [
        { name: '性能跑鞋', qty: 1, size: '43' },
        { name: '智能手表 S', qty: 1, size: '45mm' }
      ]
    }
  }),
  createFixture({
    id: 'ORD-2026-010',
    status: 'SUBMITTED',
    createdAt: '2026-02-19T11:10:00Z',
    address: {
      receiverName: '杰克·哈里森',
      receiverPhone: '+1 (555) 222-7710',
      detail: '加利福尼亚州旧金山市 Pine St 231 号'
    },
    customer: {
      name: '杰克·哈里森',
      member: '普通会员',
      email: 'jack.harrison@example.com',
      phone: '+1 (555) 222-7710',
      orderCount: 14,
      ltv: '$1.1k',
      note: '优先使用纸质环保包装。'
    },
    items: [
      createOrderItem('sku-linen-shirt-wht-l', 2),
      createOrderItem('sku-wallet-slim-brn-std', 1)
    ],
    admin: {
      statusKey: 'SUBMITTED',
      statusLabel: '待处理',
      shippingBadge: '待分拣',
      purchasedAt: '2026-02-19 11:10',
      timeline: [
        { title: '订单已提交', detail: '系统 • 2026-02-19 11:10' },
        { title: '等待支付校验', detail: '预计 10 分钟内完成' }
      ],
      lineItems: [
        { name: '亚麻衬衫', qty: 2, size: 'L' },
        { name: '真皮轻薄钱包', qty: 1, size: '标准款' }
      ]
    }
  }),
  createFixture({
    id: 'ORD-2026-011',
    status: 'CONFIRMED',
    createdAt: '2026-02-18T10:08:00Z',
    address: {
      receiverName: '凯特·沃森',
      receiverPhone: '+1 (555) 887-1020',
      detail: '加利福尼亚州圣何塞市 Willow Rd 108B'
    },
    customer: {
      name: '凯特·沃森',
      member: '新客',
      email: 'kate.watson@example.com',
      phone: '+1 (555) 887-1020',
      orderCount: 1,
      ltv: '$18.8',
      note: '地址新增门牌号 108B。'
    },
    items: [
      createOrderItem('sku-running-bottle-600', 3)
    ],
    admin: {
      statusKey: 'CONFIRMED',
      statusLabel: '已确认',
      shippingBadge: '待出库',
      purchasedAt: '2026-02-18 10:08',
      timeline: [
        { title: '订单确认完成', detail: '2026-02-18 10:08' },
        { title: '仓库待处理', detail: '预计今晚分拣' }
      ],
      lineItems: [{ name: '跑步水壶', qty: 3, size: '600ml' }]
    }
  }),
  createFixture({
    id: 'ORD-2026-012',
    status: 'SHIPPED',
    createdAt: '2026-02-17T13:55:00Z',
    address: {
      receiverName: '卢卡斯·马丁',
      receiverPhone: '+1 (555) 400-6099',
      detail: '加利福尼亚州旧金山湾区 Mission Bay 77 号'
    },
    customer: {
      name: '卢卡斯·马丁',
      member: '普通会员',
      email: 'lucas.martin@example.com',
      phone: '+1 (555) 400-6099',
      orderCount: 6,
      ltv: '$780',
      note: '工作日 9:00-18:00 收货。'
    },
    items: [
      createOrderItem('sku-keyboard-k87-brn', 1),
      createOrderItem('sku-backpack-business-blk', 1)
    ],
    tracking: {
      orderId: 'ORD-2026-012',
      shipments: [
        { carrier: 'UPS', waybillNo: '1Z789012349992', shippedAt: '2026-02-17T11:05:00Z' }
      ]
    },
    admin: {
      statusKey: 'DISPATCHED',
      statusLabel: '已发出',
      shippingBadge: '已发出',
      purchasedAt: '2026-02-17 13:55',
      timeline: [
        { title: '运输途中', detail: '旧金山湾区 • 2026-02-17 13:55' },
        { title: '已离开分拨中心', detail: '奥克兰 • 2026-02-17 11:05' },
        { title: '快递员已揽收', detail: '萨克拉门托 • 2026-02-17 07:50' }
      ],
      lineItems: [
        { name: '电竞键盘 K87', qty: 1, size: '茶轴' },
        { name: '商务双肩包', qty: 1, size: '20L' }
      ]
    }
  })
];

export const canonicalOrders = canonicalOrderFixtures.map((fixture) => ({
  id: fixture.id,
  status: fixture.status,
  address: fixture.address,
  items: fixture.items,
  remark: fixture.remark || '',
  createdAt: fixture.createdAt,
  updatedAt: fixture.updatedAt
}));

export const canonicalTrackingByOrderId = canonicalOrderFixtures.reduce((acc, fixture) => {
  acc[fixture.id] = {
    orderId: fixture.id,
    shipments: Array.isArray(fixture.tracking?.shipments)
      ? fixture.tracking.shipments.map((shipment) => ({
          carrier: shipment.carrier || null,
          waybillNo: shipment.waybillNo,
          shippedAt: shipment.shippedAt || null
        }))
      : []
  };
  return acc;
}, {});

export const resolveAdminTabByStatus = (status, statusKey = '') => {
  const normalizedKey = String(statusKey || '').toUpperCase();
  if (normalizedKey === 'RETURNING' || normalizedKey === 'RETURNED') {
    return 'returns';
  }

  const normalized = String(status || '').toUpperCase();
  if (normalized === 'SUBMITTED') {
    return 'submitted';
  }
  if (normalized === 'CONFIRMED') {
    return 'confirmed';
  }
  if (normalized === 'SHIPPED') {
    return 'shipped';
  }
  if (normalized === 'DELIVERED') {
    return 'delivered';
  }
  if (normalized === 'CANCELLED' || normalized === 'CLOSED') {
    return 'returns';
  }
  return 'submitted';
};
