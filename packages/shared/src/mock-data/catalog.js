const categoryNameById = {
  fasteners: '紧固件',
  electrical: '电气',
  safety: '安全防护',
  tools: '工具',
  instrumentation: '仪器仪表',
  janitorial: '劳保清洁',
  office: '办公文具',
  packaging: '包装耗材'
};

const toFen = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.round(numeric * 100));
};

const normalizeTierPricing = (rows) => {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      minQty: Number(row?.minQty || 0),
      discountRate: Number(row?.discountRate || 0)
    }))
    .filter((row) => Number.isFinite(row.minQty) && row.minQty >= 2 && Number.isFinite(row.discountRate) && row.discountRate > 0 && row.discountRate < 95)
    .sort((left, right) => left.minQty - right.minQty);
};

const buildPriceTiers = (basePriceYuan, tierPricing) => {
  const baseFen = toFen(basePriceYuan);
  const tiers = normalizeTierPricing(tierPricing);

  if (tiers.length === 0) {
    return [{ minQty: 1, maxQty: null, unitPriceFen: baseFen }];
  }

  const result = [];
  const firstTierMinQty = tiers[0].minQty;
  result.push({
    minQty: 1,
    maxQty: Math.max(1, firstTierMinQty - 1),
    unitPriceFen: baseFen
  });

  tiers.forEach((tier, index) => {
    const next = tiers[index + 1];
    const discountMultiplier = Math.max(0.05, 1 - tier.discountRate / 100);
    result.push({
      minQty: tier.minQty,
      maxQty: next ? Math.max(tier.minQty, next.minQty - 1) : null,
      unitPriceFen: Math.max(1, Math.round(baseFen * discountMultiplier))
    });
  });

  return result;
};

const normalizeCodePart = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
};

const buildSkuId = (spuId, code) => {
  const spuPart = normalizeCodePart(String(spuId).replace(/^spu-/, ''));
  const codePart = normalizeCodePart(code);
  return `sku-${spuPart}${codePart ? `-${codePart}` : ''}`;
};

export const canonicalCategories = [
  { id: 'fasteners', name: '紧固件', sort: 10, parentId: null },
  { id: 'electrical', name: '电气', sort: 20, parentId: null },
  { id: 'safety', name: '安全防护', sort: 30, parentId: null },
  { id: 'tools', name: '工具', sort: 40, parentId: null },
  { id: 'instrumentation', name: '仪器仪表', sort: 50, parentId: null },
  { id: 'janitorial', name: '劳保清洁', sort: 60, parentId: null },
  { id: 'office', name: '办公文具', sort: 70, parentId: null },
  { id: 'packaging', name: '包装耗材', sort: 80, parentId: null }
];

export const canonicalDisplayCategories = [
  { id: 'fasteners', name: '紧固件', iconKey: 'setting', sort: 1, enabled: true },
  { id: 'electrical', name: '电气', iconKey: 'desktop', sort: 2, enabled: true },
  { id: 'safety', name: '安全防护', iconKey: 'shield', sort: 3, enabled: true },
  { id: 'tools', name: '工具', iconKey: 'setting', sort: 4, enabled: true },
  { id: 'instrumentation', name: '仪器仪表', iconKey: 'apps', sort: 5, enabled: true },
  { id: 'janitorial', name: '劳保清洁', iconKey: 'brush', sort: 6, enabled: true },
  { id: 'office', name: '办公文具', iconKey: 'notes', sort: 7, enabled: true },
  { id: 'packaging', name: '包装耗材', iconKey: 'apps', sort: 8, enabled: true }
];

const productTemplates = [
  {
    id: 'spu-bolt-a2',
    name: '不锈钢六角螺栓 A2',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780',
    description: 'A2-70 材质六角螺栓，适用于设备装配、机柜固定与常规工况紧固。',
    inventory: 8600,
    status: 'ACTIVE',
    tierLabel: '工程常备',
    models: [
      { name: 'M8 x 30', code: 'M8', spec: 'M8 x 30 / A2-70', basePrice: 1.8 },
      { name: 'M10 x 40', code: 'M10', spec: 'M10 x 40 / A2-70', basePrice: 2.6 }
    ],
    tierPricing: [
      { minQty: 50, discountRate: 6 },
      { minQty: 200, discountRate: 12 }
    ]
  },
  {
    id: 'spu-nut-flange-304',
    name: '304 法兰螺母',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1565793298595-6a879b1d9492',
    description: '304 不锈钢带齿法兰螺母，适合振动工位与板材装配场景。',
    inventory: 12400,
    status: 'ACTIVE',
    tierLabel: '标准档',
    models: [
      { name: 'M8', code: 'M8', spec: 'M8 / 304 不锈钢', basePrice: 0.68 },
      { name: 'M10', code: 'M10', spec: 'M10 / 304 不锈钢', basePrice: 0.92 }
    ],
    tierPricing: [
      { minQty: 100, discountRate: 5 },
      { minQty: 500, discountRate: 10 }
    ]
  },
  {
    id: 'spu-washer-flat-304',
    name: '304 平垫圈',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
    description: '304 平垫圈，适用于分散压强、保护连接面并提升装配稳定性。',
    inventory: 18600,
    status: 'ACTIVE',
    tierLabel: '标准档',
    models: [
      { name: 'M8', code: 'M8', spec: 'M8 / 外径 16mm', basePrice: 0.22 },
      { name: 'M10', code: 'M10', spec: 'M10 / 外径 20mm', basePrice: 0.28 }
    ],
    tierPricing: [
      { minQty: 200, discountRate: 5 },
      { minQty: 1000, discountRate: 11 }
    ]
  },
  {
    id: 'spu-washer-spring-65mn',
    name: '65Mn 弹簧垫圈',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1532634896-26909d0d4b6b',
    description: '发黑 65Mn 弹簧垫圈，用于防松连接，适合设备维护与机加装配。',
    inventory: 15300,
    status: 'ACTIVE',
    tierLabel: '防松档',
    models: [
      { name: 'M8', code: 'M8', spec: 'M8 / 发黑 65Mn', basePrice: 0.18 },
      { name: 'M10', code: 'M10', spec: 'M10 / 发黑 65Mn', basePrice: 0.24 }
    ],
    tierPricing: [
      { minQty: 200, discountRate: 4 },
      { minQty: 1000, discountRate: 9 }
    ]
  },
  {
    id: 'spu-retaining-ring-internal',
    name: '孔用弹性挡圈',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc',
    description: '标准孔用弹性挡圈，适用于轴承定位与传动部件限位。',
    inventory: 7200,
    status: 'ACTIVE',
    tierLabel: '卡簧档',
    models: [
      { name: '18mm', code: '18', spec: '孔径 18mm / 65Mn', basePrice: 0.46 },
      { name: '25mm', code: '25', spec: '孔径 25mm / 65Mn', basePrice: 0.62 }
    ],
    tierPricing: [
      { minQty: 100, discountRate: 5 },
      { minQty: 500, discountRate: 10 }
    ]
  },
  {
    id: 'spu-anchor-expansion-zp',
    name: '镀锌膨胀螺栓',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122',
    description: '镀锌膨胀螺栓，适用于混凝土墙体、支架底座与设备落地固定。',
    inventory: 4300,
    status: 'ACTIVE',
    tierLabel: '锚固档',
    models: [
      { name: 'M8 x 80', code: 'M8', spec: 'M8 x 80 / 镀锌', basePrice: 2.9 },
      { name: 'M10 x 100', code: 'M10', spec: 'M10 x 100 / 镀锌', basePrice: 4.2 }
    ],
    tierPricing: [
      { minQty: 20, discountRate: 4 },
      { minQty: 100, discountRate: 9 }
    ]
  },
  {
    id: 'spu-anchor-chemical-m12',
    name: '化学锚栓 M12',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
    description: '8.8 级化学锚栓，适合高荷载设备基础、幕墙预埋与改造加固场景。',
    inventory: 2100,
    status: 'ACTIVE',
    tierLabel: '重载档',
    models: [
      { name: 'M12 x 160', code: '160', spec: 'M12 x 160 / 8.8 级', basePrice: 8.6 },
      { name: 'M12 x 200', code: '200', spec: 'M12 x 200 / 8.8 级', basePrice: 10.2 }
    ],
    tierPricing: [
      { minQty: 10, discountRate: 3 },
      { minQty: 50, discountRate: 7 }
    ]
  },
  {
    id: 'spu-rivet-blind-alfe',
    name: '开口型抽芯铆钉',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1497493292307-31c376b6e479',
    description: '铝铁开口型抽芯铆钉，适用于薄板连接、风管安装与机壳装配。',
    inventory: 9600,
    status: 'ACTIVE',
    tierLabel: '铆接档',
    models: [
      { name: '4.0 x 10', code: '4X10', spec: '4.0 x 10 / 铝铁', basePrice: 0.36 },
      { name: '4.8 x 12', code: '4X12', spec: '4.8 x 12 / 铝铁', basePrice: 0.44 }
    ],
    tierPricing: [
      { minQty: 200, discountRate: 5 },
      { minQty: 1000, discountRate: 12 }
    ]
  },
  {
    id: 'spu-selftap-410',
    name: '410 不锈钢自攻钉',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1581092160607-ee22731d8c1a',
    description: '十字盘头 410 不锈钢自攻钉，适用于薄钢板、箱体与面板固定。',
    inventory: 11800,
    status: 'ACTIVE',
    tierLabel: '板材固定',
    models: [
      { name: 'ST4.2 x 19', code: 'ST42-19', spec: 'ST4.2 x 19 / 十字盘头', basePrice: 0.27 },
      { name: 'ST4.8 x 25', code: 'ST48-25', spec: 'ST4.8 x 25 / 十字盘头', basePrice: 0.39 }
    ],
    tierPricing: [
      { minQty: 200, discountRate: 5 },
      { minQty: 1000, discountRate: 10 }
    ]
  },
  {
    id: 'spu-u-bolt-zp',
    name: '镀锌 U 型卡',
    categoryId: 'fasteners',
    coverImageUrl:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952',
    description: '镀锌 U 型卡箍，适用于管道支撑、线缆桥架与支架抱箍固定。',
    inventory: 3800,
    status: 'ACTIVE',
    tierLabel: '管夹档',
    models: [
      { name: 'DN20', code: 'DN20', spec: 'DN20 / 镀锌碳钢', basePrice: 1.6 },
      { name: 'DN32', code: 'DN32', spec: 'DN32 / 镀锌碳钢', basePrice: 2.1 }
    ],
    tierPricing: [
      { minQty: 50, discountRate: 4 },
      { minQty: 200, discountRate: 8 }
    ]
  },
  {
    id: 'spu-tee-classic',
    name: '经典纯棉 T 恤',
    categoryId: 'office',
    coverImageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    description: '柔软透气的日常基础款，适合批量团购。',
    inventory: 1240,
    status: 'ACTIVE',
    tierLabel: '标准档',
    models: [
      { name: '蓝色 M', code: 'BLU-M', spec: '蓝色 / M', basePrice: 79 },
      { name: '蓝色 L', code: 'BLU-L', spec: '蓝色 / L', basePrice: 79 }
    ],
    tierPricing: []
  },
  {
    id: 'spu-earbuds-pro',
    name: '无线耳机 Pro',
    categoryId: 'electrical',
    coverImageUrl:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
    description: '低延迟主动降噪，适合办公与通勤。',
    inventory: 45,
    status: 'INACTIVE',
    tierLabel: '设置分层价格',
    models: [
      { name: '黑色', code: 'BLK', spec: '午夜黑', basePrice: 399 },
      { name: '银色', code: 'SLV', spec: '冰川银', basePrice: 419 }
    ],
    tierPricing: [
      { minQty: 3, discountRate: 5 },
      { minQty: 10, discountRate: 12 }
    ]
  },
  {
    id: 'spu-wallet-slim',
    name: '真皮轻薄钱包',
    categoryId: 'tools',
    coverImageUrl:
      'https://images.unsplash.com/photo-1627123424574-724758594e93',
    description: '头层牛皮材质，轻薄多卡位设计。',
    inventory: 320,
    status: 'ACTIVE',
    tierLabel: '二档启用',
    models: [{ name: '棕色标准款', code: 'BRN-STD', spec: '棕色 / 标准', basePrice: 169 }],
    tierPricing: [{ minQty: 5, discountRate: 8 }]
  },
  {
    id: 'spu-vase-minimal',
    name: '极简陶瓷花瓶',
    categoryId: 'office',
    coverImageUrl:
      'https://images.unsplash.com/photo-1612196808214-b40f97f0c6ec',
    description: '哑光釉面，适配现代风格办公与家居空间。',
    inventory: 15,
    status: 'DRAFT',
    tierLabel: '标准',
    models: [{ name: '白色', code: 'WHT', spec: '白色 / 28cm', basePrice: 259 }],
    tierPricing: []
  },
  {
    id: 'spu-running-shoes',
    name: '性能跑鞋',
    categoryId: 'safety',
    coverImageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
    description: '缓震中底与透气鞋面，适合城市慢跑。',
    inventory: 850,
    status: 'ACTIVE',
    tierLabel: '设置分层价格',
    models: [
      { name: '灰色 42', code: 'GRY-42', spec: '灰色 / 42', basePrice: 529 },
      { name: '灰色 43', code: 'GRY-43', spec: '灰色 / 43', basePrice: 529 }
    ],
    tierPricing: [
      { minQty: 2, discountRate: 3 },
      { minQty: 6, discountRate: 10 }
    ]
  },
  {
    id: 'spu-backpack-business',
    name: '商务双肩包',
    categoryId: 'office',
    coverImageUrl:
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    description: '多仓位分区，支持 15 英寸笔记本。',
    inventory: 268,
    status: 'ACTIVE',
    tierLabel: '标准档',
    models: [{ name: '曜石黑', code: 'BLK', spec: '黑色 / 20L', basePrice: 219 }],
    tierPricing: []
  },
  {
    id: 'spu-watch-smart-s',
    name: '智能手表 S',
    categoryId: 'instrumentation',
    coverImageUrl:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
    description: '全天候心率监测与多运动模式。',
    inventory: 172,
    status: 'ACTIVE',
    tierLabel: '二档启用',
    models: [
      { name: '石墨黑 41mm', code: '41-BLK', spec: '石墨黑 / 41mm', basePrice: 899 },
      { name: '银色 45mm', code: '45-SLV', spec: '银色 / 45mm', basePrice: 949 }
    ],
    tierPricing: [{ minQty: 4, discountRate: 6 }]
  },
  {
    id: 'spu-linen-shirt',
    name: '亚麻衬衫',
    categoryId: 'janitorial',
    coverImageUrl:
      'https://images.unsplash.com/photo-1603252109303-2751441dd157',
    description: '轻薄透气面料，夏季商务休闲两用。',
    inventory: 412,
    status: 'ACTIVE',
    tierLabel: '标准档',
    models: [
      { name: '米白 M', code: 'WHT-M', spec: '米白 / M', basePrice: 129 },
      { name: '米白 L', code: 'WHT-L', spec: '米白 / L', basePrice: 129 }
    ],
    tierPricing: []
  },
  {
    id: 'spu-keyboard-k87',
    name: '电竞键盘 K87',
    categoryId: 'electrical',
    coverImageUrl:
      'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae',
    description: '87 键紧凑布局，支持热插拔轴体。',
    inventory: 69,
    status: 'INACTIVE',
    tierLabel: '设置分层价格',
    models: [
      { name: '红轴', code: 'RED', spec: '红轴 / 有线', basePrice: 329 },
      { name: '茶轴', code: 'BRN', spec: '茶轴 / 有线', basePrice: 349 }
    ],
    tierPricing: [
      { minQty: 3, discountRate: 4 },
      { minQty: 8, discountRate: 9 }
    ]
  },
  {
    id: 'spu-running-bottle',
    name: '跑步水壶',
    categoryId: 'packaging',
    coverImageUrl:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8',
    description: '食品级 Tritan 材质，防漏便携。',
    inventory: 506,
    status: 'ACTIVE',
    tierLabel: '标准',
    models: [{ name: '600ml', code: '600', spec: '600ml / 蓝色', basePrice: 49 }],
    tierPricing: []
  }
];

const categoryLabelById = canonicalCategories.reduce((acc, item) => {
  acc[item.id] = item.name;
  return acc;
}, {});

const toSku = (template, model) => {
  const basePriceYuan = Number(model.basePrice || 0);
  return {
    id: buildSkuId(template.id, model.code),
    spuId: template.id,
    name: model.name,
    skuCode: `${template.id.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${String(model.code || 'STD').toUpperCase()}`,
    spec: model.spec || model.name,
    priceTiers: buildPriceTiers(basePriceYuan, template.tierPricing),
    isActive: true
  };
};

export const canonicalProducts = productTemplates.map((template) => {
  const categoryName = categoryLabelById[template.categoryId] || categoryNameById[template.categoryId] || '未分类';
  return {
    id: template.id,
    name: template.name,
    categoryId: template.categoryId,
    coverImageUrl: template.coverImageUrl,
    tags: [categoryName, template.tierLabel],
    description: template.description,
    inventory: template.inventory,
    status: template.status,
    models: template.models.map((model) => ({
      name: model.name,
      code: model.code,
      basePrice: Number(model.basePrice || 0),
      spec: model.spec || model.name
    })),
    tierPricing: normalizeTierPricing(template.tierPricing)
  };
});

export const canonicalProductDetailsById = Object.fromEntries(
  productTemplates.map((template) => {
    const skus = template.models.map((model) => toSku(template, model));

    return [
      template.id,
      {
        product: {
          id: template.id,
          name: template.name,
          categoryId: template.categoryId,
          description: template.description,
          images: template.coverImageUrl ? [template.coverImageUrl] : []
        },
        skus
      }
    ];
  })
);

export const canonicalSkuById = Object.values(canonicalProductDetailsById).reduce((acc, detail) => {
  detail.skus.forEach((sku) => {
    acc[sku.id] = sku;
  });
  return acc;
}, {});

export const findCanonicalSkuById = (skuId) => {
  return canonicalSkuById[skuId] || null;
};

export const buildCanonicalProductDetail = (spuId) => {
  const fromMap = canonicalProductDetailsById[spuId];
  if (fromMap) {
    return fromMap;
  }

  const product = canonicalProducts.find((item) => item.id === spuId);
  if (!product) {
    return null;
  }

  const fallbackSku = {
    id: buildSkuId(product.id, 'STD'),
    spuId: product.id,
    name: `${product.name} 标准款`,
    skuCode: `${product.id.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-STD`,
    spec: '标准',
    priceTiers: [{ minQty: 1, maxQty: null, unitPriceFen: 9800 }],
    isActive: true
  };

  return {
    product: {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      description: product.description || '离线预览用的商品详情。',
      images: product.coverImageUrl ? [product.coverImageUrl] : []
    },
    skus: [fallbackSku]
  };
};
