export type ProductRequestRecord = {
  categoryId: string;
  color: string;
  createdAt: string;
  createdByUserId: string;
  dimensions: string;
  id: string;
  material: string;
  name: string;
  note: string;
  qty: string;
  referenceImageUrls: string[];
  spec: string;
};

const toText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim();
  return normalized || fallback;
};

export const normalizeProductRequest = (value: unknown, index = 0): ProductRequestRecord => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const referenceImageUrls = Array.isArray(record.referenceImageUrls)
    ? record.referenceImageUrls.map((item) => toText(item)).filter(Boolean)
    : [];
  return {
    id: toText(record.id, `mock-request-${index + 1}`),
    createdByUserId: toText(record.createdByUserId, 'unknown-customer'),
    name: toText(record.name, `未命名需求 ${index + 1}`),
    categoryId: toText(record.categoryId),
    spec: toText(record.spec),
    material: toText(record.material),
    dimensions: toText(record.dimensions),
    color: toText(record.color),
    qty: toText(record.qty),
    note: toText(record.note),
    referenceImageUrls,
    createdAt: toText(record.createdAt)
  };
};

const mockReferenceImage = (label: string, color: string) => (
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#334155">${label}</text></svg>`)}`
);

const MOCK_REQUEST_TEMPLATES = [
  { name: '非标不锈钢机箱', spec: '304 不锈钢，2mm', material: '304 不锈钢', dimensions: '600 × 450 × 300 mm', color: '拉丝银', qty: '20 台', note: '需要户外防雨，并预留散热孔。' },
  { name: '耐高温密封圈', spec: '内径 35mm', material: '氟橡胶', dimensions: '35 × 3.5 mm', color: '黑色', qty: '500 个', note: '长期工作温度 200℃。' },
  { name: '定制木质包装箱', spec: '出口免熏蒸', material: '胶合板', dimensions: '1200 × 800 × 900 mm', color: '原木色', qty: '30 个', note: '需要加装叉车托盘和防震内衬。' },
  { name: '工业触控显示器', spec: '15.6 英寸，电容触控', material: '铝合金外壳', dimensions: '嵌入式安装', color: '深灰', qty: '12 台', note: '接口需要 HDMI 与 USB，亮度不低于 1000nit。' }
];

export const buildMockProductRequests = (count = 24): ProductRequestRecord[] => (
  Array.from({ length: count }, (_, index) => {
    const template = MOCK_REQUEST_TEMPLATES[index % MOCK_REQUEST_TEMPLATES.length];
    return normalizeProductRequest({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      createdByUserId: `10000000-0000-4000-8000-${String((index % 6) + 1).padStart(12, '0')}`,
      categoryId: '',
      ...template,
      name: index < MOCK_REQUEST_TEMPLATES.length ? template.name : `${template.name} ${index + 1}`,
      referenceImageUrls: index % 3 === 0 ? [mockReferenceImage(`需求参考图 ${index + 1}`, '#e2e8f0')] : [],
      createdAt: new Date(Date.UTC(2026, 5, 28 - index, 8, 30)).toISOString()
    }, index);
  })
);

export const matchesProductRequestQuery = (item: ProductRequestRecord, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    item.id,
    item.createdByUserId,
    item.name,
    item.spec,
    item.material,
    item.dimensions,
    item.color,
    item.qty,
    item.note
  ].some((value) => value.toLowerCase().includes(normalized));
};
