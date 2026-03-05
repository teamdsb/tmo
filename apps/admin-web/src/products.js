import {
  createCatalogCategory,
  createCatalogProduct,
  deleteCatalogCategory,
  fetchCatalogCategories,
  fetchMiniappDisplayCategories,
  fetchProducts,
  replaceMiniappDisplayCategories,
  updateCatalogCategory
} from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, safeText } from './lib/render';
import {
  canonicalCategories,
  canonicalDisplayCategories,
  canonicalProducts
} from '../../../packages/shared/src/mock-data/index.js';

const DEFAULT_PAGE_SIZE = 10;

const state = {
  context: null,
  total: 0,
  allProducts: [],
  categories: [],
  displayCategories: [],
  categoryIdByLabel: {},
  productsById: {},
  filters: {
    categoryId: '',
    status: ''
  },
  pagination: {
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    remote: false
  },
  drawer: {
    row: null,
    productId: ''
  }
};

const CATEGORY_EMPTY_LABEL = '无';
const NO_CATEGORY_FILTER = '__NO_CATEGORY__';
const CATEGORY_STORAGE_KEY = 'admin-web-products-categories';
const DISPLAY_CATEGORY_STORAGE_KEY = 'admin-web-miniapp-display-categories';
const STATUS_FILTER_ITEMS = [
  { value: '', label: '状态：全部' },
  { value: 'ACTIVE', label: '状态：启用' },
  { value: 'INACTIVE', label: '状态：停用' },
  { value: 'DRAFT', label: '状态：草稿' }
];
const FALLBACK_DEFAULT_CATEGORIES = [
  { id: 'apparel', name: '服饰', sort: 10, parentId: null },
  { id: 'electronics', name: '电子产品', sort: 20, parentId: null },
  { id: 'accessories', name: '配件', sort: 30, parentId: null },
  { id: 'home-decor', name: '家居装饰', sort: 40, parentId: null },
  { id: 'footwear', name: '鞋履', sort: 50, parentId: null }
];

const DEFAULT_CATEGORIES = (Array.isArray(canonicalCategories) && canonicalCategories.length > 0
  ? canonicalCategories
  : FALLBACK_DEFAULT_CATEGORIES
).map((item, index) => ({
  id: safeText(item?.id, `category-${index + 1}`),
  name: safeText(item?.name, `类目 ${index + 1}`),
  sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : (index + 1) * 10,
  parentId: safeText(item?.parentId, '') || null
}));

const DISPLAY_CATEGORY_ICON_ITEMS = [
  { value: 'setting', label: '紧固/工业', symbol: 'settings' },
  { value: 'desktop', label: '电气/电子', symbol: 'desktop_windows' },
  { value: 'shield', label: '安全防护', symbol: 'shield' },
  { value: 'notes', label: '办公/文具', symbol: 'description' },
  { value: 'brush', label: '清洁保洁', symbol: 'cleaning_services' },
  { value: 'hot', label: '茶歇/休闲', symbol: 'local_fire_department' },
  { value: 'apps', label: '通用图标', symbol: 'apps' }
];

const FALLBACK_DISPLAY_CATEGORIES = [
  { id: 'apparel', name: '服饰', iconKey: 'notes', sort: 1, enabled: true },
  { id: 'electronics', name: '电子产品', iconKey: 'desktop', sort: 2, enabled: true },
  { id: 'accessories', name: '配件', iconKey: 'apps', sort: 3, enabled: true },
  { id: 'home-decor', name: '家居装饰', iconKey: 'brush', sort: 4, enabled: true },
  { id: 'footwear', name: '鞋履', iconKey: 'hot', sort: 5, enabled: true }
];

const DEFAULT_DISPLAY_CATEGORIES = (Array.isArray(canonicalDisplayCategories) && canonicalDisplayCategories.length > 0
  ? canonicalDisplayCategories
  : FALLBACK_DISPLAY_CATEGORIES
).map((item, index) => ({
  id: safeText(item?.id, `display-category-${index + 1}`),
  name: safeText(item?.name, `展示类目 ${index + 1}`),
  iconKey: safeText(item?.iconKey, 'apps'),
  sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : index + 1,
  enabled: item?.enabled !== false
}));

const CATEGORY_BADGE_CLASS = {
  服饰: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  电子产品: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  配件: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  家居装饰: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  鞋履: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  无: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  未分类: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
};

const DEFAULT_MODEL_NAME = '默认型号';
const DEFAULT_MODEL_CODE = 'STD';
const MIN_TIER_QTY = 2;
const MAX_TIER_DISCOUNT_RATE = 90;

const MOCK_IMAGE_POOL = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCQoEH4gfPeWzK1H0fbTKGpdPsPEiVMSPpMe3jLG-QgVaadYTF5qCKXGMjK_UTCXUpALUF4RYSCB-uwdUYyEqrynzyRupEFmfWY0O4Y55MSNjHpEcnbyyoMgg9bnSiWa-xAQg9jjGABk35lkIoQYRcnYbRoheyqYHOwhN_dwLyq9p73TGuxxF4apYmpLHY9xpto3PvnH_aZ0I9bo4tHrTLkleRHk2Dxhp9kINeVt8_ELlHoEiskagOOP2omXZCUmUVbFac5vdDDsIY',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBEIgPW6ZBOTgr9Q108MfixPSYHRAYslI2QJq5jutI_I44OsmzXgS1DKgmv5bhUsoq8uj3sJsOGNsSVWTxV-MqVI5WZyd9Na0avk4Xb8Otkz0-SiSM9aoveA6AAYyaUAwwF7giqaUqikM6MKXWA62Lwkru6jttI92nQEEjAV7JrQewS4-8dgwyn_ivXI_iTPPk25_065zBjkvwThYjMA4WwJVvz0y9d0fZGYtJE111hzA0c9BL7tlLKI6GITyug2_lvbIU_qwqC5zs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAjfY9aErprDgMbNW85Bo1S8v946mPEkkDWaZzNHNBAYFo0m9XuCqFAv_SQv6LrE3AWOXealNtJiOQyGWyme10Dbf7sCna3NN2mr5lmmr9LG1DfWfVdbieVgjgFL9GHTkXi1tQJJdOYdR3YNQ8BM9KTCk0tuqJy0mtF_ha6Zar8OLDXFX51Fn6j7VCOSOmzIYgcuePgboazKpD8MCDDowKOK0VVUXHGHw50ztZCmTk1rfOmEFE_shi0E59oj3ZN72S3-T1R8lMP3TA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuATkU8VA_t7SGJYwPViJASvA_fn8uMFTdL9xTEl4WMsqfhxAvbR0nh2-_l1eL9GnV59mItV7WjLwXeKx6QdfbOXt-t02wb9ZDuQy7Ct-lJmuBaM2-N-eeAFCqQ_D-3lGfNZIyw5cdug2IE8WXiSN4Li-asDIj6cWCwM1GyC0Nq5xdNe1uaZ9zPdG0O57cR0GdpfWmpSfIaD3W3zsEa98n0M1GF0hB5VJGZMW3fESRS-sXsDmwHPEzklvk_cawQVRfgqmbWWeJSiV_s',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0dVU3CbsDZyVFNGcLshF6YPBJMXxeAkydfB9oG-gpqraaY3swuQGA6DlAzox0skc9W3gMDHpbOY7Ui6Dyfi72SLBagGUh5ASqADVL1jdp6k9txxiAxXeotx6YaP8KAeq_-eMws7k2lB-ugkiyFet-VpTh98336NktWjqnterKtgihC0oJOobwVBu322iP86hzYMstZBx7ItnBXjsjex5nGodo7N27yiGtEIvurLh64yG0d_g9NrQMb0bw9L9p4EHj3e2KWUbeq1c'
];

const MOCK_PRODUCT_TEMPLATES = [
  {
    name: '经典纯棉 T 恤',
    categoryId: 'apparel',
    tier: '标准档',
    inventory: 1240,
    status: 'ACTIVE',
    basePrice: 79,
    models: [
      { name: '蓝色 M', code: 'TSH-BLU-M', basePrice: 79 },
      { name: '蓝色 L', code: 'TSH-BLU-L', basePrice: 79 }
    ]
  },
  {
    name: '无线耳机 Pro',
    categoryId: 'electronics',
    tier: '设置分层价格',
    inventory: 45,
    status: 'INACTIVE',
    basePrice: 399,
    models: [
      { name: '黑色', code: 'EAR-PRO-BLK', basePrice: 399 },
      { name: '银色', code: 'EAR-PRO-SLV', basePrice: 419 }
    ],
    tierPricing: [
      { minQty: 3, discountRate: 5 },
      { minQty: 10, discountRate: 12 }
    ]
  },
  {
    name: '真皮轻薄钱包',
    categoryId: 'accessories',
    tier: '二档启用',
    inventory: 320,
    status: 'ACTIVE',
    basePrice: 169,
    models: [{ name: '棕色标准款', code: 'WAL-BRN-STD', basePrice: 169 }],
    tierPricing: [{ minQty: 5, discountRate: 8 }]
  },
  { name: '极简陶瓷花瓶', categoryId: 'home-decor', tier: '标准', inventory: 15, status: 'DRAFT', basePrice: 259 },
  {
    name: '性能跑鞋',
    categoryId: 'footwear',
    tier: '设置分层价格',
    inventory: 850,
    status: 'ACTIVE',
    basePrice: 529,
    models: [
      { name: '灰色 42', code: 'RUN-GRY-42', basePrice: 529 },
      { name: '灰色 43', code: 'RUN-GRY-43', basePrice: 529 }
    ],
    tierPricing: [
      { minQty: 2, discountRate: 3 },
      { minQty: 6, discountRate: 10 }
    ]
  },
  { name: '商务双肩包', categoryId: 'accessories', tier: '标准档', inventory: 268, status: 'ACTIVE', basePrice: 219 },
  { name: '智能手表 S', categoryId: 'electronics', tier: '二档启用', inventory: 172, status: 'ACTIVE', basePrice: 899 },
  { name: '亚麻衬衫', categoryId: 'apparel', tier: '标准档', inventory: 412, status: 'ACTIVE', basePrice: 129 },
  { name: '电竞键盘 K87', categoryId: 'electronics', tier: '设置分层价格', inventory: 69, status: 'INACTIVE', basePrice: 329 },
  { name: '跑步水壶', categoryId: 'accessories', tier: '标准', inventory: 506, status: 'ACTIVE', basePrice: 49 }
];

const canonicalCategoryNameById = DEFAULT_CATEGORIES.reduce((acc, item) => {
  acc[safeText(item.id, '')] = safeText(item.name, CATEGORY_EMPTY_LABEL);
  return acc;
}, {});

const resolveCanonicalTierLabel = (item) => {
  const rawTier = Array.isArray(item?.tags) && item.tags[1] ? safeText(item.tags[1], '') : '';
  return rawTier || '标准档';
};

const CANONICAL_PRODUCT_TEMPLATES = (Array.isArray(canonicalProducts) ? canonicalProducts : [])
  .map((item, index) => {
    const categoryId = safeText(item?.categoryId, '').trim();
    const categoryLabel = canonicalCategoryNameById[categoryId] || CATEGORY_EMPTY_LABEL;
    const models = Array.isArray(item?.models)
      ? item.models.map((model, modelIndex) => ({
          name: safeText(model?.name, `${DEFAULT_MODEL_NAME} ${modelIndex + 1}`),
          code: safeText(model?.code, `${DEFAULT_MODEL_CODE}-${modelIndex + 1}`),
          basePrice: Number.isFinite(Number(model?.basePrice)) ? Number(model.basePrice) : 0
        }))
      : [];
    const tierPricing = Array.isArray(item?.tierPricing)
      ? item.tierPricing.map((tier) => ({
          minQty: Number.isFinite(Number(tier?.minQty)) ? Number(tier.minQty) : MIN_TIER_QTY,
          discountRate: Number.isFinite(Number(tier?.discountRate)) ? Number(tier.discountRate) : 0
        }))
      : [];
    return {
      id: safeText(item?.id, `SPU-${index + 1}`),
      name: safeText(item?.name, `模拟商品 ${index + 1}`),
      categoryId,
      categoryLabel,
      tier: resolveCanonicalTierLabel(item),
      inventory: Number.isFinite(Number(item?.inventory)) ? Number(item.inventory) : 0,
      status: safeText(item?.status, 'ACTIVE'),
      coverImageUrl: safeText(item?.coverImageUrl, ''),
      description: safeText(item?.description, ''),
      models,
      tierPricing
    };
  })
  .filter((item) => item.id && item.name);

const normalizeProductText = (value, fallback = '') => {
  const key = String(value || '').trim();
  const map = {
    Apparel: '服饰',
    apparel: '服饰',
    Electronics: '电子产品',
    electronics: '电子产品',
    Accessories: '配件',
    accessories: '配件',
    'Home Decor': '家居装饰',
    'home-decor': '家居装饰',
    home_decor: '家居装饰',
    homedecor: '家居装饰',
    Footwear: '鞋履',
    footwear: '鞋履',
    Uncategorized: CATEGORY_EMPTY_LABEL,
    未分类: CATEGORY_EMPTY_LABEL,
    无: CATEGORY_EMPTY_LABEL,
    none: CATEGORY_EMPTY_LABEL,
    'Standard Tier': '标准档',
    Standard: '标准',
    'Set Tiered Price': '设置分层价格',
    'Tier 2 Active': '二档启用',
    ACTIVE: '启用',
    INACTIVE: '停用',
    DRAFT: '草稿'
  };
  return map[key] || key || fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
};

const toMoney = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return fallback;
  }
  return Math.max(0, Math.round(amount * 100) / 100);
};

const toPositiveInt = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return fallback;
  }
  return Math.max(0, Math.floor(amount));
};

const formatCurrency = (value) => {
  return `¥${toMoney(value, 0).toFixed(2)}`;
};

const formatDiscountFold = (discountRate) => {
  const rate = toMoney(discountRate, 0);
  const fold = Math.round((10 - rate / 10) * 10) / 10;
  return `${Number.isInteger(fold) ? String(fold) : fold.toFixed(1)}折`;
};

const resolveLegacyTierLabel = (item) => {
  if (Array.isArray(item.tags) && item.tags.length > 1) {
    return normalizeProductText(item.tags[1], '标准档');
  }
  return '标准档';
};

const resolveBasePriceCandidate = (item, fallback = 0) => {
  const candidate = [
    item?.basePrice,
    item?.price,
    item?.unitPrice,
    item?.salePrice,
    item?.amount
  ].find((value) => Number.isFinite(Number(value)));
  if (candidate === undefined) {
    return toMoney(fallback, 0);
  }
  return toMoney(candidate, 0);
};

const normalizeModelCode = (value, fallback = DEFAULT_MODEL_CODE) => {
  const code = safeText(value, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_]/g, '');
  return code || fallback;
};

const normalizeModelSettings = (item) => {
  const fallbackBasePrice = resolveBasePriceCandidate(item, 0);
  const source = Array.isArray(item?.models) ? item.models : Array.isArray(item?.variants) ? item.variants : [];
  const normalized = source
    .map((model, index) => {
      const name = safeText(model?.name ?? model?.modelName ?? model?.title, '').trim();
      const code = normalizeModelCode(model?.code ?? model?.modelCode ?? model?.sku ?? model?.id, `${DEFAULT_MODEL_CODE}-${index + 1}`);
      const basePrice = resolveBasePriceCandidate(model, fallbackBasePrice);
      if (!name && !code) {
        return null;
      }
      return {
        name: name || `${DEFAULT_MODEL_NAME} ${index + 1}`,
        code,
        basePrice
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackCode = normalizeModelCode(item?.sku ?? item?.id, DEFAULT_MODEL_CODE);
  return [
    {
      name: DEFAULT_MODEL_NAME,
      code: fallbackCode,
      basePrice: fallbackBasePrice
    }
  ];
};

const inferTierPricingFromLegacyLabel = (label) => {
  const text = safeText(label, '');
  if (text.includes('二档')) {
    return [{ minQty: 5, discountRate: 8 }];
  }
  return [];
};

const normalizeTierPricing = (item) => {
  const source = Array.isArray(item?.tierPricing)
    ? item.tierPricing
    : Array.isArray(item?.priceTiers)
      ? item.priceTiers
      : Array.isArray(item?.pricingTiers)
        ? item.pricingTiers
        : [];
  const rows = source
    .map((tier) => {
      const minQty = toPositiveInt(tier?.minQty ?? tier?.quantity ?? tier?.minQuantity, 0);
      const discountRate = toMoney(
        tier?.discountRate ?? tier?.discountPercent ?? tier?.discount ?? tier?.offPercent,
        -1
      );
      if (minQty < MIN_TIER_QTY || discountRate <= 0 || discountRate >= MAX_TIER_DISCOUNT_RATE) {
        return null;
      }
      return {
        minQty,
        discountRate
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.minQty - right.minQty);

  if (rows.length === 0) {
    return inferTierPricingFromLegacyLabel(resolveLegacyTierLabel(item));
  }

  const unique = [];
  const qtySet = new Set();
  rows.forEach((row) => {
    if (qtySet.has(row.minQty)) {
      return;
    }
    qtySet.add(row.minQty);
    unique.push(row);
  });
  return unique;
};

const resolveTierSummaryLabel = (tierPricing, fallback = '标准档') => {
  if (!Array.isArray(tierPricing) || tierPricing.length === 0) {
    return normalizeProductText(fallback, '标准档');
  }
  const maxDiscount = tierPricing.reduce((max, item) => Math.max(max, toMoney(item.discountRate, 0)), 0);
  return `${tierPricing.length + 1}档阶梯价 · 最高${formatDiscountFold(maxDiscount)}`;
};

const normalizeCategoryItem = (item, index = 0) => {
  const id = safeText(item?.id, '').trim();
  if (!id) {
    return null;
  }
  const name = safeText(item?.name, '').trim();
  const parentId = safeText(item?.parentId, '').trim();
  return {
    id,
    name: name || `类目 ${index + 1}`,
    parentId: parentId || null,
    sort: toNumber(item?.sort, (index + 1) * 10)
  };
};

const sortCategories = (items) => {
  return [...items].sort((left, right) => {
    const sortDiff = left.sort - right.sort;
    if (sortDiff !== 0) {
      return sortDiff;
    }
    return left.name.localeCompare(right.name, 'zh-CN');
  });
};

const getDisplayIconOption = (iconKey) => {
  const key = safeText(iconKey, '').trim().toLowerCase();
  return DISPLAY_CATEGORY_ICON_ITEMS.find((item) => item.value === key) || null;
};

const inferDisplayCategoryIconKey = (name, fallback = 'apps') => {
  const text = safeText(name, '').toLowerCase();
  if (!text) {
    return fallback;
  }
  if (/紧固|五金|工业|工具|fasten|bolt|hardware/.test(text)) {
    return 'setting';
  }
  if (/电|电子|electronics?|cable/.test(text)) {
    return 'desktop';
  }
  if (/安防|防护|安全|ppe|safety/.test(text)) {
    return 'shield';
  }
  if (/办公|文具|office/.test(text)) {
    return 'notes';
  }
  if (/清洁|保洁|janitorial/.test(text)) {
    return 'brush';
  }
  if (/茶|休闲|食品|餐|breakroom|food/.test(text)) {
    return 'hot';
  }
  return fallback;
};

const normalizeDisplayCategoryItem = (item, index = 0) => {
  const id = safeText(item?.id, '').trim();
  const name = safeText(item?.name, '').trim();
  if (!id || !name) {
    return null;
  }
  const iconKeyCandidate = safeText(item?.iconKey, '').trim().toLowerCase();
  const iconKey = getDisplayIconOption(iconKeyCandidate)?.value || inferDisplayCategoryIconKey(name, 'apps');
  return {
    id,
    name,
    iconKey,
    sort: toNumber(item?.sort, index + 1),
    enabled: item?.enabled !== false
  };
};

const sortDisplayCategories = (items) => {
  return [...items].sort((left, right) => {
    const sortDiff = left.sort - right.sort;
    if (sortDiff !== 0) {
      return sortDiff;
    }
    return left.name.localeCompare(right.name, 'zh-CN');
  });
};

const saveDisplayCategoriesToStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(DISPLAY_CATEGORY_STORAGE_KEY, JSON.stringify(state.displayCategories));
};

const readDisplayCategoriesFromStorage = () => {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(DISPLAY_CATEGORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item, index) => normalizeDisplayCategoryItem(item, index)).filter(Boolean);
  } catch {
    return [];
  }
};

const setDisplayCategories = (items, options = {}) => {
  const normalized = items.map((item, index) => normalizeDisplayCategoryItem(item, index)).filter(Boolean);
  state.displayCategories = sortDisplayCategories(normalized);
  if (options.persist !== false) {
    saveDisplayCategoriesToStorage();
  }
};

const resolveDisplayCategoryIconSymbol = (iconKey) => {
  return getDisplayIconOption(iconKey)?.symbol || 'apps';
};

const buildDisplayCategoryIconOptions = (selectedIconKey = '') => {
  const selectedKey = safeText(selectedIconKey, '').trim().toLowerCase();
  return DISPLAY_CATEGORY_ICON_ITEMS.map((item) => {
    return `<option value="${escape(item.value)}"${item.value === selectedKey ? ' selected' : ''}>${escape(item.label)}</option>`;
  }).join('');
};

const getDisplayCategoryById = (displayCategoryId) => {
  const id = safeText(displayCategoryId, '').trim();
  if (!id) {
    return null;
  }
  return state.displayCategories.find((item) => item.id === id) || null;
};

const getCategoryById = (categoryId) => {
  const id = safeText(categoryId, '').trim();
  if (!id) {
    return null;
  }
  return state.categories.find((item) => item.id === id) || null;
};

const resolveCategoryLabelById = (categoryId) => {
  const category = getCategoryById(categoryId);
  if (!category) {
    return CATEGORY_EMPTY_LABEL;
  }
  return safeText(category.name, CATEGORY_EMPTY_LABEL);
};

const rebuildCategoryLookup = () => {
  state.categoryIdByLabel = {};
  state.categories.forEach((item) => {
    const label = safeText(item.name, '').trim();
    const id = safeText(item.id, '').trim();
    if (!label || !id) {
      return;
    }
    state.categoryIdByLabel[label] = id;
  });
};

const saveCategoriesToStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(state.categories));
};

const readCategoriesFromStorage = () => {
  if (typeof window === 'undefined') {
    return [];
  }
  const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item, index) => normalizeCategoryItem(item, index)).filter(Boolean);
  } catch {
    return [];
  }
};

const setCategories = (items, options = {}) => {
  const normalized = items.map((item, index) => normalizeCategoryItem(item, index)).filter(Boolean);
  state.categories = sortCategories(normalized);
  rebuildCategoryLookup();
  if (options.persist !== false) {
    saveCategoriesToStorage();
  }
};

const buildCategorySelectOptionsHtml = (includeRequired = false) => {
  const noneLabel = includeRequired ? '无（商品可独立）' : CATEGORY_EMPTY_LABEL;
  const rows = [`<option value="">${escape(noneLabel)}</option>`];
  state.categories.forEach((category) => {
    rows.push(`<option value="${escape(category.id)}">${escape(category.name)}</option>`);
  });
  return rows.join('');
};

const buildCategoryFilterOptionsHtml = () => {
  const rows = [
    '<option value="">类目：全部</option>',
    `<option value="${NO_CATEGORY_FILTER}">类目：${CATEGORY_EMPTY_LABEL}</option>`
  ];
  state.categories.forEach((category) => {
    rows.push(`<option value="${escape(category.id)}">类目：${escape(category.name)}</option>`);
  });
  return rows.join('');
};

const buildStatusFilterOptionsHtml = () => {
  return STATUS_FILTER_ITEMS.map((item) => `<option value="${escape(item.value)}">${escape(item.label)}</option>`).join('');
};

const syncCategorySelectOptions = () => {
  const selectors = [
    '#create-product-modal select[name="categoryKey"]',
    '#product-edit-drawer select[name="categoryKey"]',
    '#products-category-filter'
  ];
  selectors.forEach((selector) => {
    const select = document.querySelector(selector);
    if (!(select instanceof HTMLSelectElement)) {
      return;
    }
    const currentValue = safeText(select.value, '');
    if (selector === '#products-category-filter') {
      select.innerHTML = buildCategoryFilterOptionsHtml();
      const nextValue =
        currentValue === NO_CATEGORY_FILTER || getCategoryById(currentValue) ? currentValue : safeText(state.filters.categoryId, '');
      select.value = nextValue === NO_CATEGORY_FILTER || getCategoryById(nextValue) ? nextValue : '';
      state.filters.categoryId = safeText(select.value, '');
      return;
    }

    select.innerHTML = buildCategorySelectOptionsHtml(selector.includes('create-product-modal'));
    const nextValue = getCategoryById(currentValue) ? currentValue : '';
    select.value = nextValue;
  });

  const statusFilterSelect = document.querySelector('#products-status-filter');
  if (statusFilterSelect instanceof HTMLSelectElement) {
    statusFilterSelect.innerHTML = buildStatusFilterOptionsHtml();
    const statusValue = safeText(state.filters.status, '').toUpperCase();
    const exists = STATUS_FILTER_ITEMS.some((item) => item.value === statusValue);
    statusFilterSelect.value = exists ? statusValue : '';
    state.filters.status = safeText(statusFilterSelect.value, '').toUpperCase();
  }
};

const normalizeStatusValue = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  const map = {
    启用: 'ACTIVE',
    已上架: 'ACTIVE',
    上架: 'ACTIVE',
    停用: 'INACTIVE',
    已下架: 'INACTIVE',
    下架: 'INACTIVE',
    草稿: 'DRAFT',
    ACTIVE: 'ACTIVE',
    ON_SHELF: 'ACTIVE',
    ENABLED: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    OFF_SHELF: 'INACTIVE',
    DISABLED: 'INACTIVE',
    DRAFT: 'DRAFT'
  };
  return map[normalized] || 'DRAFT';
};

const readBackgroundImageUrl = (styleValue) => {
  const raw = String(styleValue || '');
  const matched = raw.match(/url\((['"]?)(.*?)\1\)/i);
  return matched?.[2] ? matched[2].trim() : '';
};

const upsertProductInState = (product) => {
  const id = safeText(product?.id, '');
  if (!id) {
    return;
  }
  state.productsById[id] = {
    ...product
  };
};

const getSummaryElement = () => {
  return document.querySelector('[data-role="products-summary"]');
};

const getProductsTable = () => {
  return document.querySelector('[data-role="products-table"]');
};

const getSelectAllProductsCheckbox = () => {
  const table = getProductsTable();
  if (!(table instanceof HTMLTableElement)) {
    return null;
  }
  const checkbox = table.querySelector('[data-role="select-all-products"]');
  return checkbox instanceof HTMLInputElement ? checkbox : null;
};

const getProductRowCheckboxes = () => {
  const table = getProductsTable();
  if (!(table instanceof HTMLTableElement)) {
    return [];
  }
  return Array.from(table.querySelectorAll('tbody input[data-role="select-product-row"]')).filter(
    (input) => input instanceof HTMLInputElement
  );
};

const syncSelectAllProductsState = () => {
  const selectAllCheckbox = getSelectAllProductsCheckbox();
  if (!(selectAllCheckbox instanceof HTMLInputElement)) {
    return;
  }

  const rowCheckboxes = getProductRowCheckboxes();
  if (rowCheckboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    selectAllCheckbox.disabled = true;
    return;
  }

  const checkedCount = rowCheckboxes.filter((checkbox) => checkbox.checked).length;
  selectAllCheckbox.disabled = false;
  selectAllCheckbox.checked = checkedCount > 0 && checkedCount === rowCheckboxes.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
};

const setCurrentPageRowsSelected = (checked) => {
  const rowCheckboxes = getProductRowCheckboxes();
  rowCheckboxes.forEach((checkbox) => {
    checkbox.checked = checked;
  });
  syncSelectAllProductsState();
};

const getPaginationContainer = () => {
  return document.querySelector('[data-role="page-numbers"]');
};

const getPrevPageButton = () => {
  return document.querySelector('[data-role="page-prev"]');
};

const getNextPageButton = () => {
  return document.querySelector('[data-role="page-next"]');
};

const getTotalPages = (total = state.total) => {
  const pages = Math.ceil(total / state.pagination.pageSize);
  return Math.max(1, Number.isFinite(pages) ? pages : 1);
};

const isCategoryMatched = (item) => {
  const filterValue = safeText(state.filters.categoryId, '');
  if (!filterValue) {
    return true;
  }
  const categoryId = safeText(item.categoryId, '');
  if (filterValue === NO_CATEGORY_FILTER) {
    return !categoryId;
  }
  return categoryId === filterValue;
};

const isStatusMatched = (item) => {
  const filterValue = safeText(state.filters.status, '').toUpperCase();
  if (!filterValue) {
    return true;
  }
  return normalizeStatusValue(item.status) === filterValue;
};

const getFilteredProducts = () => {
  return state.allProducts.filter((item) => {
    if (!isCategoryMatched(item)) {
      return false;
    }
    if (!isStatusMatched(item)) {
      return false;
    }
    return true;
  });
};

const updateSummary = (start, end, total) => {
  const summary = getSummaryElement();
  if (!summary) {
    return;
  }
  summary.innerHTML = `显示第 <span class="font-semibold text-slate-900 dark:text-white">${start}</span> 到 <span class="font-semibold text-slate-900 dark:text-white">${end}</span> 条，共 <span class="font-semibold text-slate-900 dark:text-white">${total}</span> 条结果`;
};

const resolveCategoryTag = (item) => {
  const categoryId = safeText(item?.categoryId, '').trim();
  if (categoryId) {
    return resolveCategoryLabelById(categoryId);
  }
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    const normalizedTag = normalizeProductText(item.tags[0], '');
    const categoryIdByTag = state.categoryIdByLabel[normalizedTag];
    if (categoryIdByTag) {
      return resolveCategoryLabelById(categoryIdByTag);
    }
  }
  return CATEGORY_EMPTY_LABEL;
};

const resolveTierLabel = (item) => {
  const tierPricing = normalizeTierPricing(item);
  return resolveTierSummaryLabel(tierPricing, resolveLegacyTierLabel(item));
};

const resolveModelClass = (item) => {
  const models = Array.isArray(item?.models) && item.models.length > 0 ? item.models : normalizeModelSettings(item);
  return models.length > 1 ? '多型号' : '单型号';
};

const resolveInventory = (item) => {
  const rawInventory = [
    item.inventory,
    item.inventoryQty,
    item.stock,
    item.stockQty,
    item.availableQty
  ].find((value) => Number.isFinite(Number(value)));
  return rawInventory === undefined ? '--' : Number(rawInventory);
};

const normalizeProductItem = (item, index = 0) => {
  const fallbackTag = Array.isArray(item.tags) && item.tags.length > 0 ? normalizeProductText(item.tags[0], '') : '';
  const fallbackCategoryId = fallbackTag ? safeText(state.categoryIdByLabel[fallbackTag], '').trim() : '';
  const rawCategoryId = safeText(item.categoryId, '').trim();
  const nextCategoryId = getCategoryById(rawCategoryId) ? rawCategoryId : fallbackCategoryId;
  const categoryId = getCategoryById(nextCategoryId) ? nextCategoryId : '';
  const tag = resolveCategoryLabelById(categoryId);
  const models = normalizeModelSettings(item);
  const tierPricing = normalizeTierPricing(item);
  const tierLabel = resolveTierSummaryLabel(tierPricing, resolveLegacyTierLabel(item));
  return {
    ...item,
    id: safeText(item.id, `MOCK-${String(index + 1).padStart(4, '0')}`),
    name: safeText(item.name, `模拟商品 ${index + 1}`),
    categoryId,
    tags: [tag, tierLabel],
    models,
    tierPricing,
    inventory: resolveInventory(item),
    status: normalizeStatusValue(item.status),
    coverImageUrl: safeText(item.coverImageUrl, '')
  };
};

const rebuildProductIndexes = () => {
  state.productsById = {};
  state.allProducts.forEach((item) => {
    upsertProductInState(item);
  });
};

const toProductStatusBadge = (status) => {
  const normalized = String(status || '').toUpperCase();
  const map = {
    ACTIVE: {
      label: '启用',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    ON_SHELF: {
      label: '启用',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    ENABLED: {
      label: '启用',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    INACTIVE: {
      label: '停用',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    },
    OFF_SHELF: {
      label: '停用',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    },
    DISABLED: {
      label: '停用',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    },
    DRAFT: {
      label: '草稿',
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800',
      dot: 'bg-amber-500'
    }
  };
  const resolved = map[normalized] || {
    label: '待确认',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  };
  return `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${resolved.className}"><span class="size-1.5 rounded-full ${resolved.dot}"></span>${resolved.label}</span>`;
};

const toModelClassBadge = (modelClass) => {
  const className =
    modelClass === '多型号'
      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}">${escape(modelClass)}</span>`;
};

const renderProductRow = (item) => {
  const image = safeText(item.coverImageUrl, '');
  const tag = resolveCategoryTag(item);
  const modelClass = resolveModelClass(item);
  const tier = resolveTierLabel(item);
  const inventory = resolveInventory(item);
  const status = safeText(item.status, 'DRAFT');
  const categoryClass = CATEGORY_BADGE_CLASS[tag] || CATEGORY_BADGE_CLASS[CATEGORY_EMPTY_LABEL];

  return `
    <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-product-id="${escape(safeText(item.id))}">
      <td class="px-6 py-4"><input class="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary bg-transparent" data-role="select-product-row" type="checkbox" /></td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-4">
          <div class="size-12 rounded bg-slate-200 dark:bg-slate-700 flex-shrink-0 bg-cover bg-center" style="${image ? `background-image:url('${escape(image)}')` : ''}"></div>
          <div>
            <div class="font-bold text-slate-900 dark:text-white">${escape(safeText(item.name))}</div>
            <div class="text-xs text-slate-500 font-mono mt-0.5">SPU ${escape(safeText(item.id))}</div>
          </div>
        </div>
      </td>
      <td class="px-6 py-4"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryClass}">${escape(tag)}</span></td>
      <td class="px-6 py-4">${toModelClassBadge(modelClass)}</td>
      <td class="px-6 py-4"><span class="text-sm text-slate-600 dark:text-slate-300">${escape(safeText(tier))}</span></td>
      <td class="px-6 py-4 text-right"><span class="font-medium text-slate-900 dark:text-white">${escape(inventory)}</span></td>
      <td class="px-6 py-4 text-center">${toProductStatusBadge(status)}</td>
      <td class="px-6 py-4 text-right">
        <button data-role="open-product-drawer" title="编辑商品" class="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-base">edit</span>
          <span class="hidden sm:inline">编辑</span>
        </button>
      </td>
    </tr>
  `;
};

const buildPageTokens = (totalPages, currentPage) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens = [1];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);
  if (left > 2) {
    tokens.push('ellipsis-left');
  }
  for (let page = left; page <= right; page += 1) {
    tokens.push(page);
  }
  if (right < totalPages - 1) {
    tokens.push('ellipsis-right');
  }
  tokens.push(totalPages);
  return tokens;
};

const renderPagination = (totalCount = state.total) => {
  const container = getPaginationContainer();
  const prevButton = getPrevPageButton();
  const nextButton = getNextPageButton();
  if (!container || !prevButton || !nextButton) {
    return;
  }

  const resolvedTotalPages = getTotalPages(totalCount);
  const currentPage = state.pagination.currentPage;
  const tokens = buildPageTokens(resolvedTotalPages, currentPage);

  container.innerHTML = tokens
    .map((token) => {
      if (typeof token !== 'number') {
        return '<span class="text-slate-400">...</span>';
      }
      const isActive = token === currentPage;
      const className = isActive
        ? 'size-8 rounded bg-primary text-white text-sm font-medium flex items-center justify-center'
        : 'size-8 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium flex items-center justify-center transition-colors';
      return `<button data-role="page-number" data-page="${token}" class="${className}">${token}</button>`;
    })
    .join('');

  prevButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= resolvedTotalPages;
};

const renderCurrentPage = () => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }

  const filteredProducts = getFilteredProducts();
  const hasClientOnlyFilter = Boolean(state.filters.status) || state.filters.categoryId === NO_CATEGORY_FILTER;
  const useRemotePageWindow = state.pagination.remote && !hasClientOnlyFilter;
  const localTotal = filteredProducts.length;
  const summaryTotal = useRemotePageWindow ? state.total : localTotal;
  const totalPages = getTotalPages(summaryTotal);

  if (state.pagination.currentPage > totalPages) {
    state.pagination.currentPage = totalPages;
  }
  if (state.pagination.currentPage < 1) {
    state.pagination.currentPage = 1;
  }

  const offset = (state.pagination.currentPage - 1) * state.pagination.pageSize;
  const pageItems = useRemotePageWindow
    ? filteredProducts
    : filteredProducts.slice(offset, offset + state.pagination.pageSize);

  if (pageItems.length === 0) {
    const hasAnyProducts = state.allProducts.length > 0;
    const emptyMessage = hasAnyProducts ? '暂无符合筛选条件的商品。' : '后端暂无商品数据。';
    tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-5 text-sm text-slate-500">${emptyMessage}</td></tr>`;
    updateSummary(0, 0, useRemotePageWindow ? state.total : localTotal);
    renderPagination(useRemotePageWindow ? state.total : localTotal);
    syncSelectAllProductsState();
    return;
  }

  tbody.innerHTML = pageItems.map((item) => renderProductRow(item)).join('');
  const start = useRemotePageWindow
    ? (state.pagination.currentPage - 1) * state.pagination.pageSize + 1
    : localTotal === 0
      ? 0
      : offset + 1;
  const end = useRemotePageWindow ? start + pageItems.length - 1 : Math.min(offset + pageItems.length, localTotal);
  updateSummary(start, end, useRemotePageWindow ? state.total : localTotal);
  renderPagination(useRemotePageWindow ? state.total : localTotal);
  syncSelectAllProductsState();
};

const applyProducts = (items, total = items.length, currentPage = 1, remote = false) => {
  state.allProducts = items.map((item, index) => normalizeProductItem(item, index));
  state.total = Number.isFinite(Number(total)) ? Number(total) : state.allProducts.length;
  state.pagination.currentPage = currentPage;
  state.pagination.remote = remote;
  rebuildProductIndexes();
  renderCurrentPage();
};

const renderProducts = (payload, currentPage = 1, remote = state.context?.mode === 'dev') => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  applyProducts(items, total, currentPage, remote);
};

const createMockProducts = (count = 30) => {
  const templates = CANONICAL_PRODUCT_TEMPLATES.length > 0 ? CANONICAL_PRODUCT_TEMPLATES : MOCK_PRODUCT_TEMPLATES;
  if (templates.length === 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    const suffix = index < templates.length ? '' : ` ${index + 1}`;
    const modelSource = Array.isArray(template.models) ? template.models : [];
    const models = (modelSource.length > 0
      ? modelSource
      : [{ name: DEFAULT_MODEL_NAME, code: `${DEFAULT_MODEL_CODE}-${index + 1}`, basePrice: toMoney(template.basePrice, 0) }]
    ).map((model, modelIndex) => ({
      name: safeText(model.name, `${DEFAULT_MODEL_NAME} ${modelIndex + 1}`),
      code: normalizeModelCode(model.code, `${DEFAULT_MODEL_CODE}-${modelIndex + 1}`),
      basePrice: toMoney(model.basePrice, toMoney(template.basePrice, 0))
    }));

    return {
      id: suffix ? `${safeText(template.id, `MOCK-${String(index + 1).padStart(4, '0')}`)}-${index + 1}` : safeText(template.id, `MOCK-${String(index + 1).padStart(4, '0')}`),
      name: `${template.name}${suffix}`,
      categoryId: safeText(template.categoryId, ''),
      tags: [resolveCategoryLabelById(template.categoryId), safeText(template.tier, '标准档')],
      inventory: Math.max(0, template.inventory + (index % 7) * 13),
      status: template.status,
      coverImageUrl: safeText(template.coverImageUrl, '') || MOCK_IMAGE_POOL[index % MOCK_IMAGE_POOL.length],
      description: safeText(template.description, '') || `模拟商品数据 #${index + 1}`,
      models,
      tierPricing: Array.isArray(template.tierPricing)
        ? template.tierPricing.map((tier) => ({
            minQty: toPositiveInt(tier.minQty, MIN_TIER_QTY),
            discountRate: toMoney(tier.discountRate, 0)
          }))
        : []
    };
  });
};

const buildProductsQueryParams = (page = 1) => {
  const params = {
    page,
    pageSize: DEFAULT_PAGE_SIZE
  };
  const categoryId = safeText(state.filters.categoryId, '');
  if (categoryId && categoryId !== NO_CATEGORY_FILTER) {
    params.categoryId = categoryId;
  }
  return params;
};

const applyProductFilters = async () => {
  state.pagination.currentPage = 1;
  if (state.context?.mode !== 'dev') {
    renderCurrentPage();
    return;
  }

  const response = await fetchProducts(buildProductsQueryParams(1));
  if (response.status !== 200 || !response.data) {
    showToast('筛选加载失败，请稍后重试。', 'error');
    return;
  }

  const hasClientOnlyFilter = Boolean(state.filters.status) || state.filters.categoryId === NO_CATEGORY_FILTER;
  if (hasClientOnlyFilter) {
    const items = Array.isArray(response.data.items) ? response.data.items : [];
    applyProducts(items, items.length, 1, false);
    return;
  }

  renderProducts(response.data, 1, true);
};

const goToPage = async (page) => {
  const hasClientOnlyFilter = Boolean(state.filters.status) || state.filters.categoryId === NO_CATEGORY_FILTER;
  const useRemotePageWindow = state.pagination.remote && !hasClientOnlyFilter;
  const totalPages = getTotalPages(useRemotePageWindow ? state.total : getFilteredProducts().length);
  const nextPage = Math.min(Math.max(page, 1), totalPages);
  if (nextPage === state.pagination.currentPage) {
    return;
  }

  if (state.context?.mode === 'dev' && useRemotePageWindow) {
    const response = await fetchProducts(buildProductsQueryParams(nextPage));
    if (response.status !== 200 || !response.data) {
      showToast('分页加载失败，请稍后重试。', 'error');
      return;
    }
    renderProducts(response.data, nextPage, true);
    return;
  }

  state.pagination.currentPage = nextPage;
  renderCurrentPage();
};

const bindPaginationActions = () => {
  const prevButton = getPrevPageButton();
  const nextButton = getNextPageButton();
  const numberContainer = getPaginationContainer();
  if (!prevButton || !nextButton || !numberContainer) {
    return;
  }

  prevButton.addEventListener('click', () => {
    void goToPage(state.pagination.currentPage - 1);
  });
  nextButton.addEventListener('click', () => {
    void goToPage(state.pagination.currentPage + 1);
  });
  numberContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest('[data-role="page-number"]');
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const page = Number(button.dataset.page || 1);
    if (!Number.isFinite(page)) {
      return;
    }
    void goToPage(page);
  });
};

const bindFilterActions = () => {
  const categoryFilter = document.querySelector('#products-category-filter');
  if (categoryFilter instanceof HTMLSelectElement) {
    categoryFilter.addEventListener('change', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.filters.categoryId = safeText(target.value, '');
      await applyProductFilters();
    });
  }

  const statusFilter = document.querySelector('#products-status-filter');
  if (statusFilter instanceof HTMLSelectElement) {
    statusFilter.addEventListener('change', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      state.filters.status = safeText(target.value, '').toUpperCase();
      await applyProductFilters();
    });
  }
};

const showToast = (message, type = 'success') => {
  let container = document.querySelector('#product-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'product-toast-container';
    container.className = 'fixed inset-0 z-[120] flex items-center justify-center px-4 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const isError = type === 'error';
  const colorClass = isError
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  const icon = isError ? 'close' : 'check';
  toast.className = `rounded-xl border px-5 py-3 text-sm shadow-lg ${colorClass} flex items-center gap-2`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-base">${icon}</span>
    <span>${escape(message)}</span>
  `;
  container.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 2600);
};

const toMinimalErrorReason = (error, fallback = '请稍后重试') => {
  if (!error) {
    return fallback;
  }
  const message = error instanceof Error ? error.message : safeText(error, '');
  const text = safeText(message, '').trim();
  if (!text) {
    return fallback;
  }
  const normalized = text.replace(/\s+/g, ' ');
  if (normalized.length <= 48) {
    return normalized;
  }
  return `${normalized.slice(0, 45)}...`;
};

const closeCreateModal = () => {
  const modal = document.querySelector('#create-product-modal');
  if (!modal) {
    return;
  }
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

const openCreateModal = () => {
  const modal = document.querySelector('#create-product-modal');
  if (!modal) {
    return;
  }
  const form = modal.querySelector('form');
  if (form) {
    form.reset();
    syncCategorySelectOptions();
    const categorySelect = form.elements.namedItem('categoryKey');
    if (categorySelect instanceof HTMLSelectElement) {
      categorySelect.value = '';
    }
  }
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

const appendProductRow = (product) => {
  const normalized = normalizeProductItem(product, 0);
  state.allProducts = [normalized, ...state.allProducts];
  state.total = Math.max(state.total + 1, state.allProducts.length);
  state.pagination.currentPage = 1;
  rebuildProductIndexes();
  renderCurrentPage();
};

const createLocalProduct = (formData) => {
  const requestedCategoryId = safeText(formData.categoryKey, '').trim();
  const categoryId = getCategoryById(requestedCategoryId) ? requestedCategoryId : '';
  const categoryLabel = resolveCategoryLabelById(categoryId);
  const basePrice = 0;
  return {
    id: `LOCAL-${Date.now()}`,
    name: formData.name,
    coverImageUrl: formData.coverImageUrl,
    categoryId,
    tags: [categoryLabel, '标准档'],
    inventory: formData.inventory,
    status: formData.status,
    models: [
      {
        name: DEFAULT_MODEL_NAME,
        code: normalizeModelCode(formData.name, DEFAULT_MODEL_CODE),
        basePrice
      }
    ],
    tierPricing: []
  };
};

const collectFormData = (form) => {
  const formData = new FormData(form);
  return {
    name: safeText(formData.get('name'), '').trim(),
    categoryKey: safeText(formData.get('categoryKey'), ''),
    inventory: Math.max(0, Number(formData.get('inventory') || 0)),
    status: safeText(formData.get('status'), 'ACTIVE'),
    coverImageUrl: safeText(formData.get('coverImageUrl'), ''),
    description: safeText(formData.get('description'), '')
  };
};

const getProductFromRow = (row) => {
  const codeText = safeText(row.querySelector('td:nth-child(2) .text-xs')?.textContent, '').replace(/^SPU\s*/i, '').trim();
  const rowId = safeText(row.dataset.productId, codeText || `LOCAL-${Date.now()}`);
  const name = safeText(row.querySelector('td:nth-child(2) .font-bold')?.textContent, '未命名商品');
  const categoryLabel = normalizeProductText(row.querySelector('td:nth-child(3) span')?.textContent, CATEGORY_EMPTY_LABEL);
  const categoryId = safeText(state.categoryIdByLabel[categoryLabel], '').trim();
  const tier = safeText(row.querySelector('td:nth-child(5) span')?.textContent, '标准档');
  const inventoryText = safeText(row.querySelector('td:nth-child(6) .font-medium')?.textContent, '0');
  const inventory = Math.max(0, Number(inventoryText.replace(/[^\d.-]/g, '')) || 0);
  const statusText = safeText(row.querySelector('td:nth-child(7) span')?.textContent, '草稿').replace(/\s+/g, '');
  const status = normalizeStatusValue(statusText);
  const thumb = row.querySelector('td:nth-child(2) .size-12');
  const coverImageUrl = readBackgroundImageUrl(thumb?.style?.backgroundImage);
  const cached = state.productsById[rowId] || {};
  const models = normalizeModelSettings({
    ...cached,
    name,
    sku: codeText
  });
  const tierPricing = normalizeTierPricing(cached);
  const tierLabel = resolveTierSummaryLabel(tierPricing, tier);

  return {
    id: rowId,
    name,
    categoryId: getCategoryById(categoryId) ? categoryId : '',
    tags: [resolveCategoryLabelById(categoryId), tierLabel],
    inventory,
    status,
    coverImageUrl,
    description: safeText(cached.description, ''),
    models,
    tierPricing
  };
};

const updateRowFromProduct = (row, product) => {
  if (!row) {
    return;
  }
  row.dataset.productId = safeText(product.id, row.dataset.productId || '');

  const nameElement = row.querySelector('td:nth-child(2) .font-bold');
  if (nameElement) {
    nameElement.textContent = safeText(product.name, '未命名商品');
  }

  const categoryLabel = resolveCategoryTag(product);
  const categoryClass = CATEGORY_BADGE_CLASS[categoryLabel] || CATEGORY_BADGE_CLASS[CATEGORY_EMPTY_LABEL];
  const categoryBadge = row.querySelector('td:nth-child(3) span');
  if (categoryBadge) {
    categoryBadge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryClass}`;
    categoryBadge.textContent = categoryLabel;
  }

  const modelClass = resolveModelClass(product);
  const modelClassBadge = row.querySelector('td:nth-child(4) span');
  if (modelClassBadge) {
    modelClassBadge.className =
      modelClass === '多型号'
        ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
        : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    modelClassBadge.textContent = modelClass;
  }

  const tierLabel = resolveTierLabel(product);
  const tierElement = row.querySelector('td:nth-child(5) span');
  if (tierElement) {
    tierElement.textContent = tierLabel;
  }

  const inventoryElement = row.querySelector('td:nth-child(6) .font-medium');
  if (inventoryElement) {
    inventoryElement.textContent = String(resolveInventory(product));
  }

  const statusCell = row.querySelector('td:nth-child(7)');
  if (statusCell) {
    statusCell.innerHTML = toProductStatusBadge(product.status);
  }

  const thumb = row.querySelector('td:nth-child(2) .size-12');
  if (thumb instanceof HTMLElement) {
    thumb.style.backgroundImage = product.coverImageUrl ? `url("${product.coverImageUrl}")` : '';
  }
};

const replaceProductInCollection = (product) => {
  const productId = safeText(product.id, '');
  if (!productId) {
    return;
  }
  const index = state.allProducts.findIndex((item) => safeText(item.id) === productId);
  if (index >= 0) {
    state.allProducts[index] = normalizeProductItem(product, index);
  } else {
    state.allProducts.unshift(normalizeProductItem(product, 0));
  }
  state.total = Math.max(state.total, state.allProducts.length);
  rebuildProductIndexes();
  renderCurrentPage();
};

const closeEditDrawer = () => {
  const overlay = document.querySelector('#product-drawer-overlay');
  const drawer = document.querySelector('#product-edit-drawer');
  if (!overlay || !drawer) {
    return;
  }
  overlay.classList.add('hidden');
  drawer.classList.add('translate-x-full');
  document.body.classList.remove('overflow-hidden');
};

const updateDrawerPreview = (drawer, imageUrl) => {
  const image = drawer.querySelector('[data-role="drawer-preview-image"]');
  const emptyState = drawer.querySelector('[data-role="drawer-preview-empty"]');
  const previewButton = drawer.querySelector('[data-role="open-image-preview"]');
  if (!(image instanceof HTMLImageElement) || !(emptyState instanceof HTMLElement)) {
    return;
  }
  if (!imageUrl) {
    image.src = '';
    image.classList.add('hidden');
    emptyState.classList.remove('hidden');
    previewButton?.classList.add('hidden');
    return;
  }
  image.src = imageUrl;
  image.classList.remove('hidden');
  emptyState.classList.add('hidden');
  previewButton?.classList.remove('hidden');
};

const ensureImagePreviewModal = () => {
  const existed = document.querySelector('#product-image-preview-modal');
  if (existed instanceof HTMLElement) {
    return existed;
  }

  const modal = document.createElement('div');
  modal.id = 'product-image-preview-modal';
  modal.className = 'fixed inset-0 z-[110] hidden items-center justify-center bg-slate-900/75 p-4';
  modal.innerHTML = `
    <div class="relative w-full max-w-5xl">
      <button type="button" data-role="close-image-preview" class="absolute -top-12 right-0 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white">
        关闭
      </button>
      <img data-role="image-preview-target" alt="商品大图预览" class="max-h-[85vh] w-full rounded-xl object-contain" />
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      close();
    }
  });
  modal.querySelector('[data-role="close-image-preview"]')?.addEventListener('click', close);

  return modal;
};

const openImagePreview = (imageUrl) => {
  const url = safeText(imageUrl, '').trim();
  if (!url) {
    showToast('当前没有可预览的图片。', 'error');
    return;
  }
  const modal = ensureImagePreviewModal();
  const image = modal.querySelector('[data-role="image-preview-target"]');
  if (!(image instanceof HTMLImageElement)) {
    return;
  }
  image.src = url;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

const buildModelRowHtml = (model, index = 0) => {
  const fallbackName = index === 0 ? DEFAULT_MODEL_NAME : `${DEFAULT_MODEL_NAME} ${index + 1}`;
  return `
    <div data-role="model-row" class="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
      <label class="space-y-1 text-xs text-slate-600">
        <span>型号名称</span>
        <input data-field="model-name" type="text" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(safeText(model?.name, fallbackName))}" />
      </label>
      <label class="space-y-1 text-xs text-slate-600">
        <span>型号编码</span>
        <input data-field="model-code" type="text" class="w-full rounded-lg border-slate-300 text-sm uppercase focus:border-primary focus:ring-primary" value="${escape(normalizeModelCode(model?.code, `${DEFAULT_MODEL_CODE}-${index + 1}`))}" />
      </label>
      <label class="space-y-1 text-xs text-slate-600">
        <span>基础售价</span>
        <input data-field="model-base-price" type="number" min="0" step="0.01" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(toMoney(model?.basePrice, 0))}" />
      </label>
      <button type="button" data-role="remove-model-row" class="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">删除</button>
    </div>
  `;
};

const buildTierRowHtml = (tier = {}) => {
  return `
    <div data-role="tier-row" class="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
      <label class="space-y-1 text-xs text-slate-600">
        <span>起购数量</span>
        <input data-field="tier-min-qty" type="number" min="${MIN_TIER_QTY}" step="1" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(toPositiveInt(tier.minQty, 0) || '')}" placeholder="例如 5" />
      </label>
      <label class="space-y-1 text-xs text-slate-600">
        <span>优惠比例（%）</span>
        <input data-field="tier-discount-rate" type="number" min="0.1" max="${MAX_TIER_DISCOUNT_RATE}" step="0.1" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(tier.discountRate ? toMoney(tier.discountRate, 0) : '')}" placeholder="例如 8" />
        <p data-role="tier-price-preview" class="text-[11px] text-slate-400">填写后自动预估折后单价</p>
      </label>
      <button type="button" data-role="remove-tier-row" class="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">删除</button>
    </div>
  `;
};

const getDrawerModelRows = (drawer) => {
  return Array.from(drawer.querySelectorAll('[data-role="model-row"]'));
};

const getDrawerTierRows = (drawer) => {
  return Array.from(drawer.querySelectorAll('[data-role="tier-row"]'));
};

const syncModelRowActions = (drawer) => {
  const rows = getDrawerModelRows(drawer);
  rows.forEach((row) => {
    const removeButton = row.querySelector('[data-role="remove-model-row"]');
    if (!(removeButton instanceof HTMLButtonElement)) {
      return;
    }
    const shouldDisable = rows.length <= 1;
    removeButton.disabled = shouldDisable;
    removeButton.classList.toggle('opacity-50', shouldDisable);
    removeButton.classList.toggle('cursor-not-allowed', shouldDisable);
  });
};

const getPrimaryModelBasePrice = (drawer) => {
  const firstRow = getDrawerModelRows(drawer)[0];
  if (!(firstRow instanceof HTMLElement)) {
    return 0;
  }
  const input = firstRow.querySelector('[data-field="model-base-price"]');
  if (!(input instanceof HTMLInputElement)) {
    return 0;
  }
  return toMoney(input.value, 0);
};

const updateTierPricePreviews = (drawer) => {
  const basePrice = getPrimaryModelBasePrice(drawer);
  getDrawerTierRows(drawer).forEach((row) => {
    const discountInput = row.querySelector('[data-field="tier-discount-rate"]');
    const preview = row.querySelector('[data-role="tier-price-preview"]');
    if (!(discountInput instanceof HTMLInputElement) || !(preview instanceof HTMLElement)) {
      return;
    }
    const discountRate = toMoney(discountInput.value, -1);
    if (discountRate <= 0 || discountRate >= MAX_TIER_DISCOUNT_RATE) {
      preview.textContent = `请输入 0.1 - ${MAX_TIER_DISCOUNT_RATE} 之间的优惠比例`;
      return;
    }
    if (basePrice <= 0) {
      preview.textContent = '先填写首个型号的基础售价后可预估折后价';
      return;
    }
    const tierPrice = toMoney(basePrice * (1 - discountRate / 100), 0);
    preview.textContent = `预估单价 ${formatCurrency(tierPrice)}（按首型号基准价）`;
  });
};

const renderDrawerModels = (drawer, models) => {
  const list = drawer.querySelector('[data-role="model-list"]');
  if (!(list instanceof HTMLElement)) {
    return;
  }
  const source = Array.isArray(models) && models.length > 0 ? models : normalizeModelSettings({});
  list.innerHTML = source.map((model, index) => buildModelRowHtml(model, index)).join('');
  syncModelRowActions(drawer);
  updateTierPricePreviews(drawer);
};

const renderDrawerTiers = (drawer, tiers) => {
  const list = drawer.querySelector('[data-role="tier-list"]');
  if (!(list instanceof HTMLElement)) {
    return;
  }
  if (!Array.isArray(tiers) || tiers.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = tiers.map((tier) => buildTierRowHtml(tier)).join('');
  updateTierPricePreviews(drawer);
};

const appendDrawerModelRow = (drawer) => {
  const list = drawer.querySelector('[data-role="model-list"]');
  if (!(list instanceof HTMLElement)) {
    return;
  }
  const currentCount = getDrawerModelRows(drawer).length;
  const nextBasePrice = getPrimaryModelBasePrice(drawer);
  list.insertAdjacentHTML(
    'beforeend',
    buildModelRowHtml(
      {
        name: `${DEFAULT_MODEL_NAME} ${currentCount + 1}`,
        code: `${DEFAULT_MODEL_CODE}-${currentCount + 1}`,
        basePrice: nextBasePrice
      },
      currentCount
    )
  );
  syncModelRowActions(drawer);
  updateTierPricePreviews(drawer);
};

const appendDrawerTierRow = (drawer) => {
  const list = drawer.querySelector('[data-role="tier-list"]');
  if (!(list instanceof HTMLElement)) {
    return;
  }
  const tierRows = getDrawerTierRows(drawer);
  const lastQtyInput = tierRows[tierRows.length - 1]?.querySelector('[data-field="tier-min-qty"]');
  const nextQty = Math.max(
    MIN_TIER_QTY,
    toPositiveInt(lastQtyInput instanceof HTMLInputElement ? lastQtyInput.value : MIN_TIER_QTY, MIN_TIER_QTY) + 3
  );
  list.insertAdjacentHTML(
    'beforeend',
    buildTierRowHtml({
      minQty: nextQty,
      discountRate: ''
    })
  );
  updateTierPricePreviews(drawer);
};

const collectDrawerModels = (drawer) => {
  const rows = getDrawerModelRows(drawer);
  if (rows.length === 0) {
    throw new Error('至少需要一个型号。');
  }

  const codeSet = new Set();
  return rows.map((row, index) => {
    const nameInput = row.querySelector('[data-field="model-name"]');
    const codeInput = row.querySelector('[data-field="model-code"]');
    const basePriceInput = row.querySelector('[data-field="model-base-price"]');
    const name = safeText(nameInput instanceof HTMLInputElement ? nameInput.value : '', '').trim();
    if (!name) {
      throw new Error(`第 ${index + 1} 个型号未填写名称。`);
    }
    const code = normalizeModelCode(codeInput instanceof HTMLInputElement ? codeInput.value : '', `${DEFAULT_MODEL_CODE}-${index + 1}`);
    if (codeSet.has(code)) {
      throw new Error(`型号编码重复：${code}`);
    }
    codeSet.add(code);
    const basePrice = toMoney(basePriceInput instanceof HTMLInputElement ? basePriceInput.value : 0, 0);
    return {
      name,
      code,
      basePrice
    };
  });
};

const collectDrawerTierPricing = (drawer) => {
  const rows = getDrawerTierRows(drawer);
  const tiers = [];

  rows.forEach((row, index) => {
    const minQtyInput = row.querySelector('[data-field="tier-min-qty"]');
    const discountInput = row.querySelector('[data-field="tier-discount-rate"]');
    const minQtyRaw = safeText(minQtyInput instanceof HTMLInputElement ? minQtyInput.value : '', '').trim();
    const discountRaw = safeText(discountInput instanceof HTMLInputElement ? discountInput.value : '', '').trim();
    if (!minQtyRaw && !discountRaw) {
      return;
    }
    if (!minQtyRaw || !discountRaw) {
      throw new Error(`第 ${index + 1} 条阶梯规则不完整。`);
    }
    const minQty = toPositiveInt(minQtyRaw, 0);
    if (minQty < MIN_TIER_QTY) {
      throw new Error(`第 ${index + 1} 条阶梯的起购数量需不小于 ${MIN_TIER_QTY}。`);
    }
    const discountRate = toMoney(discountRaw, -1);
    if (discountRate <= 0 || discountRate >= MAX_TIER_DISCOUNT_RATE) {
      throw new Error(`第 ${index + 1} 条阶梯的优惠比例需在 0.1 - ${MAX_TIER_DISCOUNT_RATE} 之间。`);
    }
    tiers.push({
      minQty,
      discountRate
    });
  });

  tiers.sort((left, right) => left.minQty - right.minQty);
  const seenQty = new Set();
  tiers.forEach((tier) => {
    if (seenQty.has(tier.minQty)) {
      throw new Error(`阶梯起购数量不能重复：${tier.minQty}`);
    }
    seenQty.add(tier.minQty);
  });
  return tiers;
};

const ensureEditDrawer = () => {
  const existed = document.querySelector('#product-edit-drawer');
  if (existed) {
    return existed;
  }

  const overlay = document.createElement('div');
  overlay.id = 'product-drawer-overlay';
  overlay.className = 'fixed inset-0 z-[95] hidden bg-slate-900/25';

  const drawer = document.createElement('aside');
  drawer.id = 'product-edit-drawer';
  drawer.className = 'fixed right-0 top-0 z-[96] h-screen w-full max-w-md translate-x-full overflow-y-auto border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200';
  drawer.innerHTML = `
    <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
      <div>
        <h3 class="text-lg font-bold text-slate-900">编辑商品</h3>
        <p class="text-xs text-slate-500">当前为 Mock 编辑，稍后可切到真实接口。</p>
      </div>
      <button type="button" data-role="close-drawer" class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <form class="space-y-4 px-5 py-4" data-role="drawer-form">
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <div class="relative flex aspect-video items-center justify-center bg-slate-100">
          <img data-role="drawer-preview-image" class="hidden h-full w-full cursor-zoom-in object-cover" alt="商品预览图" />
          <div data-role="drawer-preview-empty" class="text-sm text-slate-400">暂无图片预览</div>
          <button type="button" data-role="open-image-preview" class="absolute right-2 top-2 hidden rounded bg-slate-900/70 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900">
            查看大图
          </button>
        </div>
      </div>
      <label class="block space-y-1 text-sm text-slate-700">
        <span>商品名称 *</span>
        <input name="name" type="text" required class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" />
      </label>
      <label class="block space-y-1 text-sm text-slate-700">
        <span>类目</span>
        <select name="categoryKey" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">${buildCategorySelectOptionsHtml()}</select>
        <span class="text-xs text-slate-500">商品高于类目，未设置类目将显示“无”。</span>
      </label>
      <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-slate-800">型号设置</p>
            <p class="text-xs text-slate-500">可维护多个型号编码与基础售价。</p>
          </div>
          <button type="button" data-role="add-model-row" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">新增型号</button>
        </div>
        <div data-role="model-list" class="space-y-2"></div>
      </div>
      <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold text-slate-800">阶梯定价策略</p>
            <p class="text-xs text-slate-500">买得越多越便宜，按起购数量自动匹配优惠。</p>
          </div>
          <button type="button" data-role="add-tier-row" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">新增阶梯</button>
        </div>
        <div data-role="tier-list" class="space-y-2"></div>
        <p class="text-[11px] text-slate-500">示例：起购 10 件，优惠 8%，系统将按首型号基础售价预估折后价。</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <label class="block space-y-1 text-sm text-slate-700">
          <span>库存</span>
          <input name="inventory" type="number" min="0" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" />
        </label>
        <label class="block space-y-1 text-sm text-slate-700">
          <span>状态</span>
          <select name="status" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">
            <option value="ACTIVE">启用</option>
            <option value="INACTIVE">停用</option>
            <option value="DRAFT">草稿</option>
          </select>
        </label>
      </div>
      <label class="block space-y-1 text-sm text-slate-700">
        <span>封面图 URL</span>
        <input name="coverImageUrl" type="url" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" placeholder="https://example.com/image.jpg" />
      </label>
      <label class="block space-y-1 text-sm text-slate-700">
        <span>商品描述</span>
        <textarea name="description" rows="4" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"></textarea>
      </label>
      <p data-role="drawer-error" class="hidden text-sm text-red-600"></p>
      <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button type="button" data-role="cancel-drawer" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">取消</button>
        <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">保存（Mock）</button>
      </div>
    </form>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  overlay.addEventListener('click', () => closeEditDrawer());
  drawer.querySelector('[data-role="close-drawer"]')?.addEventListener('click', () => closeEditDrawer());
  drawer.querySelector('[data-role="cancel-drawer"]')?.addEventListener('click', () => closeEditDrawer());
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closeEditDrawer();
    }
  });

  const form = drawer.querySelector('[data-role="drawer-form"]');
  if (form instanceof HTMLFormElement) {
    const imageInput = form.elements.namedItem('coverImageUrl');
    if (imageInput instanceof HTMLInputElement) {
      imageInput.addEventListener('input', () => {
        updateDrawerPreview(drawer, safeText(imageInput.value, ''));
      });
    }

    drawer.querySelector('[data-role="add-model-row"]')?.addEventListener('click', () => {
      appendDrawerModelRow(drawer);
    });
    drawer.querySelector('[data-role="add-tier-row"]')?.addEventListener('click', () => {
      appendDrawerTierRow(drawer);
    });
    drawer.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const removeModelButton = target.closest('[data-role="remove-model-row"]');
      if (removeModelButton) {
        const rows = getDrawerModelRows(drawer);
        if (rows.length <= 1) {
          showToast('至少保留一个型号。', 'error');
          return;
        }
        removeModelButton.closest('[data-role="model-row"]')?.remove();
        syncModelRowActions(drawer);
        updateTierPricePreviews(drawer);
        return;
      }
      const removeTierButton = target.closest('[data-role="remove-tier-row"]');
      if (removeTierButton) {
        removeTierButton.closest('[data-role="tier-row"]')?.remove();
        updateTierPricePreviews(drawer);
      }
    });
    drawer.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.matches('[data-field="model-base-price"]') ||
        target.matches('[data-field="tier-discount-rate"]') ||
        target.matches('[data-field="tier-min-qty"]')
      ) {
        updateTierPricePreviews(drawer);
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const currentForm = event.currentTarget;
      if (!(currentForm instanceof HTMLFormElement) || !state.drawer.row) {
        return;
      }
      const errorElement = currentForm.querySelector('[data-role="drawer-error"]');
      const submitButton = currentForm.querySelector('button[type="submit"]');
      const formData = new FormData(currentForm);
      const name = safeText(formData.get('name'), '').trim();
      if (!name) {
        if (errorElement) {
          errorElement.textContent = '商品名称不能为空。';
          errorElement.classList.remove('hidden');
        }
        showToast('保存失败：商品名称不能为空。', 'error');
        return;
      }
      if (errorElement) {
        errorElement.classList.add('hidden');
      }
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = '保存中...';
      }

      try {
        const categoryIdValue = safeText(formData.get('categoryKey'), '').trim();
        const categoryId = getCategoryById(categoryIdValue) ? categoryIdValue : '';
        const models = collectDrawerModels(drawer);
        const tierPricing = collectDrawerTierPricing(drawer);
        const tierLabel = resolveTierSummaryLabel(tierPricing, '标准档');
        const status = normalizeStatusValue(formData.get('status'));
        const inventory = Math.max(0, Number(formData.get('inventory') || 0));
        const coverImageUrl = safeText(formData.get('coverImageUrl'), '');
        const description = safeText(formData.get('description'), '');

        const existing = state.productsById[state.drawer.productId] || getProductFromRow(state.drawer.row);
        const nextProduct = {
          ...existing,
          id: state.drawer.productId,
          name,
          categoryId,
          tags: [resolveCategoryLabelById(categoryId), tierLabel],
          inventory,
          status,
          coverImageUrl,
          description,
          models,
          tierPricing
        };

        replaceProductInCollection(nextProduct);
        closeEditDrawer();
        showToast('保存成功。');
      } catch (error) {
        const reason = toMinimalErrorReason(error);
        if (errorElement) {
          errorElement.textContent = `保存失败：${reason}`;
          errorElement.classList.remove('hidden');
        }
        showToast(`保存失败：${reason}`, 'error');
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.textContent = '保存（Mock）';
        }
      }
    });
  }

  drawer.querySelector('[data-role="open-image-preview"]')?.addEventListener('click', () => {
    const form = drawer.querySelector('[data-role="drawer-form"]');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }
    const input = form.elements.namedItem('coverImageUrl');
    const imageUrl = input instanceof HTMLInputElement ? input.value : '';
    openImagePreview(imageUrl);
  });

  const previewImage = drawer.querySelector('[data-role="drawer-preview-image"]');
  if (previewImage instanceof HTMLImageElement) {
    previewImage.addEventListener('error', () => {
      updateDrawerPreview(drawer, '');
    });
    previewImage.addEventListener('click', () => {
      openImagePreview(previewImage.src);
    });
  }

  return drawer;
};

const openEditDrawer = (row) => {
  const drawer = ensureEditDrawer();
  const overlay = document.querySelector('#product-drawer-overlay');
  if (!(drawer instanceof HTMLElement) || !(overlay instanceof HTMLElement)) {
    return;
  }

  const product = getProductFromRow(row);
  upsertProductInState(product);

  state.drawer.row = row;
  state.drawer.productId = safeText(product.id);

  const form = drawer.querySelector('[data-role="drawer-form"]');
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  const setFormValue = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  };

  syncCategorySelectOptions();
  const categoryId = getCategoryById(product.categoryId) ? safeText(product.categoryId, '') : '';
  const inventory = resolveInventory(product);
  setFormValue('name', safeText(product.name));
  setFormValue('categoryKey', categoryId);
  setFormValue('inventory', String(inventory === '--' ? 0 : inventory));
  setFormValue('status', normalizeStatusValue(product.status));
  setFormValue('coverImageUrl', safeText(product.coverImageUrl));
  setFormValue('description', safeText(product.description, ''));
  renderDrawerModels(drawer, normalizeModelSettings(product));
  renderDrawerTiers(drawer, normalizeTierPricing(product));
  const errorElement = form.querySelector('[data-role="drawer-error"]');
  if (errorElement instanceof HTMLElement) {
    errorElement.classList.add('hidden');
    errorElement.textContent = '';
  }

  updateDrawerPreview(drawer, safeText(product.coverImageUrl));
  overlay.classList.remove('hidden');
  drawer.classList.remove('translate-x-full');
  document.body.classList.add('overflow-hidden');
};

const hydrateStaticRows = () => {
  const rows = document.querySelectorAll('table tbody tr');
  const hydrated = [];
  rows.forEach((row) => {
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const cells = row.querySelectorAll('td');
    if (cells.length < 7) {
      return;
    }
    const actionButton = row.querySelector('td:last-child button');
    if (actionButton instanceof HTMLButtonElement) {
      actionButton.setAttribute('data-role', 'open-product-drawer');
      actionButton.setAttribute('title', '编辑商品');
      actionButton.className =
        'inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-primary transition-colors';
      actionButton.innerHTML = '<span class="material-symbols-outlined text-base">edit</span><span class="hidden sm:inline">编辑</span>';
    }
    const rowCheckbox = row.querySelector('td:first-child input[type="checkbox"]');
    if (rowCheckbox instanceof HTMLInputElement) {
      rowCheckbox.setAttribute('data-role', 'select-product-row');
    }
    const product = getProductFromRow(row);
    row.dataset.productId = safeText(product.id);
    upsertProductInState(product);
    hydrated.push(normalizeProductItem(product, hydrated.length));
  });
  if (hydrated.length > 0 && state.allProducts.length === 0) {
    state.allProducts = hydrated;
    state.total = hydrated.length;
    rebuildProductIndexes();
    renderCurrentPage();
  }
};

const bindSelectionActions = () => {
  const table = getProductsTable();
  if (!(table instanceof HTMLTableElement)) {
    return;
  }

  table.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.matches('[data-role="select-all-products"]')) {
      setCurrentPageRowsSelected(target.checked);
      return;
    }

    if (target.matches('tbody input[data-role="select-product-row"]')) {
      syncSelectAllProductsState();
    }
  });
};

const bindProductRowActions = () => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }
  tbody.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest('[data-role="open-product-drawer"]');
    if (!button) {
      return;
    }
    const row = button.closest('tr');
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    openEditDrawer(row);
  });
};

const ensureCreateModal = () => {
  const existed = document.querySelector('#create-product-modal');
  if (existed) {
    return existed;
  }

  const modal = document.createElement('div');
  modal.id = 'create-product-modal';
  modal.className = 'fixed inset-0 z-[90] hidden flex items-center justify-center bg-slate-900/50 p-4';
  modal.innerHTML = `
    <div class="w-full max-w-xl rounded-xl bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h3 class="text-lg font-bold text-slate-900">新建商品</h3>
        <button type="button" data-role="close" class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form class="space-y-4 px-6 py-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="space-y-1 text-sm text-slate-700">
            <span>商品名称 *</span>
            <input name="name" type="text" required class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" placeholder="请输入商品名称" />
          </label>
          <label class="space-y-1 text-sm text-slate-700">
            <span>类目（可选）</span>
            <select name="categoryKey" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">${buildCategorySelectOptionsHtml(true)}</select>
            <span class="text-xs text-slate-500">商品本身高于类目，未选择时展示“无”。</span>
          </label>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label class="space-y-1 text-sm text-slate-700">
            <span>初始库存</span>
            <input name="inventory" type="number" min="0" value="0" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" />
          </label>
          <label class="space-y-1 text-sm text-slate-700">
            <span>状态</span>
            <select name="status" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">
              <option value="ACTIVE">启用</option>
              <option value="DRAFT">草稿</option>
              <option value="INACTIVE">停用</option>
            </select>
          </label>
        </div>
        <label class="block space-y-1 text-sm text-slate-700">
          <span>封面图 URL</span>
          <input name="coverImageUrl" type="url" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" placeholder="https://example.com/image.jpg" />
        </label>
        <label class="block space-y-1 text-sm text-slate-700">
          <span>商品描述</span>
          <textarea name="description" rows="3" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" placeholder="请输入商品描述"></textarea>
        </label>
        <p data-role="form-error" class="hidden text-sm text-red-600"></p>
        <div class="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" data-role="cancel" class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">取消</button>
          <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">确认创建</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const closeButtons = modal.querySelectorAll('[data-role="close"], [data-role="cancel"]');
  closeButtons.forEach((button) => {
    button.addEventListener('click', () => closeCreateModal());
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeCreateModal();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCreateModal();
    }
  });

  const form = modal.querySelector('form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentForm = event.currentTarget;
    if (!(currentForm instanceof HTMLFormElement)) {
      return;
    }

    const errorElement = currentForm.querySelector('[data-role="form-error"]');
    const submitButton = currentForm.querySelector('button[type="submit"]');
    if (!(submitButton instanceof HTMLButtonElement)) {
      return;
    }

    const values = collectFormData(currentForm);
    if (!values.name) {
      if (errorElement) {
        errorElement.textContent = '请先填写商品名称。';
        errorElement.classList.remove('hidden');
      }
      return;
    }
    if (errorElement) {
      errorElement.classList.add('hidden');
    }

    submitButton.disabled = true;
    submitButton.textContent = '创建中...';

    try {
      const selectedCategoryId = getCategoryById(values.categoryKey) ? values.categoryKey : '';
      const categoryLabel = resolveCategoryLabelById(selectedCategoryId);
      const nextValues = {
        ...values,
        categoryKey: selectedCategoryId
      };
      if (state.context?.mode === 'dev' && selectedCategoryId) {
        const payload = {
          name: values.name,
          categoryId: selectedCategoryId,
          description: values.description || undefined,
          coverImageUrl: values.coverImageUrl || undefined,
          images: values.coverImageUrl ? [values.coverImageUrl] : undefined,
          tags: [categoryLabel, '标准档']
        };
        const response = await createCatalogProduct(payload);
        if (response.status !== 201 || !response.data?.product) {
          throw new Error('后端创建失败，请稍后重试。');
        }
        appendProductRow({
          id: safeText(response.data.product.id, `SPU-${Date.now()}`),
          name: safeText(response.data.product.name, values.name),
          coverImageUrl: safeText(response.data.product.images?.[0], values.coverImageUrl),
          categoryId: safeText(response.data.product.categoryId, selectedCategoryId),
          tags: [categoryLabel, '标准档'],
          inventory: values.inventory,
          status: values.status
        });
      } else {
        appendProductRow(createLocalProduct(nextValues));
      }
      closeCreateModal();
      showToast('新建商品成功。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '新建商品失败，请稍后重试。';
      if (state.context?.mode === 'dev') {
        appendProductRow(createLocalProduct(values));
        closeCreateModal();
        showToast(`后端创建失败，已在前端暂存。原因：${message}`, 'error');
      } else {
        if (errorElement) {
          errorElement.textContent = message;
          errorElement.classList.remove('hidden');
        }
        showToast(message, 'error');
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '确认创建';
    }
  });

  return modal;
};

const bindCreateProductAction = () => {
  const createButton = document.querySelector('#create-product-btn');
  if (!createButton) {
    return;
  }
  ensureCreateModal();
  createButton.addEventListener('click', () => {
    openCreateModal();
  });
};

const rebuildProductsAfterCategoryChange = () => {
  state.allProducts = state.allProducts.map((item, index) => normalizeProductItem(item, index));
  rebuildProductIndexes();
  syncCategorySelectOptions();
  renderCurrentPage();
};

const toCategoryPayload = (name, sort, parentId) => {
  return {
    name,
    sort,
    parentId: parentId || null
  };
};

const shouldUseLocalCategoryStore = () => {
  return state.context?.mode !== 'dev';
};

const toDisplayCategoryPayload = (item, index = 0) => {
  return {
    id: safeText(item?.id, '').trim(),
    name: safeText(item?.name, '').trim(),
    iconKey: safeText(item?.iconKey, inferDisplayCategoryIconKey(safeText(item?.name, ''), 'apps'))
      .trim()
      .toLowerCase(),
    sort: toNumber(item?.sort, index + 1),
    enabled: item?.enabled !== false
  };
};

const persistDisplayCategories = async (items) => {
  const payloadItems = items.map((item, index) => toDisplayCategoryPayload(item, index)).filter((item) => item.id && item.name);
  if (state.context?.mode === 'dev') {
    const response = await replaceMiniappDisplayCategories({
      items: payloadItems
    });
    if (response.status !== 200 || !Array.isArray(response.data?.items)) {
      throw new Error('后端保存展示类目失败。');
    }
    setDisplayCategories(response.data.items, { persist: false });
    return;
  }
  setDisplayCategories(payloadItems, { persist: true });
};

const loadDisplayCategories = async () => {
  if (state.context?.mode === 'dev') {
    try {
      const response = await fetchMiniappDisplayCategories();
      if (response.status === 200 && Array.isArray(response.data?.items)) {
        setDisplayCategories(response.data.items, { persist: false });
        return;
      }
    } catch {
      // ignore and fallback
    }
  }

  const stored = readDisplayCategoriesFromStorage();
  if (stored.length > 0) {
    setDisplayCategories(stored, { persist: false });
    return;
  }
  setDisplayCategories(DEFAULT_DISPLAY_CATEGORIES, { persist: true });
};

const closeDisplayCategoryManagerModal = () => {
  const modal = document.querySelector('#display-category-manager-modal');
  if (!(modal instanceof HTMLElement)) {
    return;
  }
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

const renderDisplayCategoryPreview = (modal) => {
  const preview = modal.querySelector('[data-role="display-category-preview"]');
  if (!(preview instanceof HTMLElement)) {
    return;
  }

  const enabledItems = state.displayCategories.filter((item) => item.enabled);
  if (enabledItems.length === 0) {
    preview.innerHTML =
      '<div class="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">暂无启用中的展示类目。</div>';
    return;
  }

  preview.innerHTML = enabledItems
    .map((item) => {
      return `
        <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div class="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <span class="material-symbols-outlined text-base">${escape(resolveDisplayCategoryIconSymbol(item.iconKey))}</span>
          </div>
          <p class="line-clamp-1 text-sm font-semibold text-slate-900">${escape(item.name)}</p>
          <p class="mt-1 text-xs text-slate-500">排序：${escape(item.sort)}</p>
        </div>
      `;
    })
    .join('');
};

const renderDisplayCategoryManagerBody = (modal) => {
  const body = modal.querySelector('[data-role="display-category-list-body"]');
  if (!(body instanceof HTMLElement)) {
    return;
  }

  if (state.displayCategories.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" class="px-4 py-8 text-center text-sm text-slate-500">当前没有展示类目，请先新增。</td></tr>';
    renderDisplayCategoryPreview(modal);
    return;
  }

  body.innerHTML = state.displayCategories
    .map((item) => {
      return `
        <tr class="border-b border-slate-100 last:border-0" data-display-category-id="${escape(item.id)}">
          <td class="px-4 py-3">
            <input data-role="display-category-name" type="text" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(item.name)}" />
          </td>
          <td class="px-4 py-3">
            <select data-role="display-category-icon" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary">
              ${buildDisplayCategoryIconOptions(item.iconKey)}
            </select>
          </td>
          <td class="px-4 py-3">
            <input data-role="display-category-sort" type="number" class="w-24 rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(item.sort)}" />
          </td>
          <td class="px-4 py-3">
            <label class="inline-flex items-center gap-2 text-sm text-slate-700">
              <input data-role="display-category-enabled" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" ${
                item.enabled ? 'checked' : ''
              } />
              <span>${item.enabled ? '启用中' : '已停用'}</span>
            </label>
          </td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-2">
              <button type="button" data-role="save-display-category" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">保存</button>
              <button type="button" data-role="delete-display-category" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  renderDisplayCategoryPreview(modal);
};

const ensureDisplayCategoryManagerModal = () => {
  const existed = document.querySelector('#display-category-manager-modal');
  if (existed instanceof HTMLElement) {
    return existed;
  }

  const modal = document.createElement('div');
  modal.id = 'display-category-manager-modal';
  modal.className = 'fixed inset-0 z-[93] hidden flex items-center justify-center bg-slate-900/50 p-4';
  modal.innerHTML = `
    <div class="w-full max-w-5xl rounded-xl bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">展示类目管理</h3>
          <p class="text-xs text-slate-500">管理小程序首页/分类页的展示类目（Admin 改动会同步到小程序）。</p>
        </div>
        <button type="button" data-role="close-display-category-manager" class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="space-y-5 px-6 py-5">
        <form class="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[2fr_1fr_110px_110px_auto]" data-role="create-display-category-form">
          <input name="name" type="text" required class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" placeholder="新增展示类目名称" />
          <select name="iconKey" class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary">
            ${buildDisplayCategoryIconOptions('apps')}
          </select>
          <input name="sort" type="number" class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" placeholder="排序" value="100" />
          <label class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input name="enabled" type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary" checked />
            <span>启用</span>
          </label>
          <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">新增类目</button>
        </form>
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-slate-700">小程序展示预览（仅展示启用项）</h4>
          <div data-role="display-category-preview" class="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4"></div>
        </div>
        <div class="overflow-hidden rounded-xl border border-slate-200">
          <table class="w-full border-collapse text-left">
            <thead class="bg-slate-50">
              <tr class="text-xs font-bold tracking-wider text-slate-500 uppercase">
                <th class="px-4 py-3">类目名称</th>
                <th class="px-4 py-3">图标</th>
                <th class="px-4 py-3">排序</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody data-role="display-category-list-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('[data-role="close-display-category-manager"]')?.addEventListener('click', () => closeDisplayCategoryManagerModal());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeDisplayCategoryManagerModal();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeDisplayCategoryManagerModal();
    }
  });

  const createForm = modal.querySelector('[data-role="create-display-category-form"]');
  if (createForm instanceof HTMLFormElement) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const name = safeText(formData.get('name'), '').trim();
      if (!name) {
        showToast('展示类目名称不能为空。', 'error');
        return;
      }
      const sort = toNumber(formData.get('sort'), state.displayCategories.length + 1);
      const enabled = formData.get('enabled') !== null;
      const requestedIconKey = safeText(formData.get('iconKey'), '').trim().toLowerCase();
      const iconKey = getDisplayIconOption(requestedIconKey)?.value || inferDisplayCategoryIconKey(name, 'apps');
      const nextItem = normalizeDisplayCategoryItem(
        {
          id: `display-cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name,
          iconKey,
          sort,
          enabled
        },
        state.displayCategories.length
      );
      if (!nextItem) {
        showToast('新增展示类目失败，请稍后重试。', 'error');
        return;
      }
      try {
        await persistDisplayCategories([...state.displayCategories, nextItem]);
        renderDisplayCategoryManagerBody(modal);
        createForm.reset();
        const iconSelect = createForm.elements.namedItem('iconKey');
        if (iconSelect instanceof HTMLSelectElement) {
          iconSelect.value = 'apps';
        }
        const enabledInput = createForm.elements.namedItem('enabled');
        if (enabledInput instanceof HTMLInputElement) {
          enabledInput.checked = true;
        }
        showToast('展示类目已新增。');
      } catch (error) {
        const reason = toMinimalErrorReason(error);
        showToast(`新增展示类目失败：${reason}`, 'error');
      }
    });
  }

  const listBody = modal.querySelector('[data-role="display-category-list-body"]');
  listBody?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionButton = target.closest('[data-role="save-display-category"], [data-role="delete-display-category"]');
    if (!(actionButton instanceof HTMLButtonElement)) {
      return;
    }
    const row = actionButton.closest('tr');
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const categoryId = safeText(row.dataset.displayCategoryId, '');
    if (!categoryId) {
      return;
    }

    if (actionButton.dataset.role === 'delete-display-category') {
      const current = getDisplayCategoryById(categoryId);
      const categoryName = safeText(current?.name, '当前展示类目');
      if (!window.confirm(`确定删除展示类目“${categoryName}”吗？`)) {
        return;
      }
      try {
        const nextItems = state.displayCategories.filter((item) => item.id !== categoryId);
        await persistDisplayCategories(nextItems);
        renderDisplayCategoryManagerBody(modal);
        showToast('展示类目已删除。');
      } catch (error) {
        const reason = toMinimalErrorReason(error);
        showToast(`删除展示类目失败：${reason}`, 'error');
      }
      return;
    }

    const nameInput = row.querySelector('[data-role="display-category-name"]');
    const iconSelect = row.querySelector('[data-role="display-category-icon"]');
    const sortInput = row.querySelector('[data-role="display-category-sort"]');
    const enabledInput = row.querySelector('[data-role="display-category-enabled"]');

    const name = safeText(nameInput?.value, '').trim();
    if (!name) {
      showToast('展示类目名称不能为空。', 'error');
      return;
    }
    const sort = toNumber(sortInput?.value, 100);
    const iconCandidate = safeText(iconSelect?.value, '').trim().toLowerCase();
    const iconKey = getDisplayIconOption(iconCandidate)?.value || inferDisplayCategoryIconKey(name, 'apps');
    const enabled = enabledInput instanceof HTMLInputElement ? enabledInput.checked : true;
    const current = getDisplayCategoryById(categoryId);
    const currentIndex = state.displayCategories.findIndex((item) => item.id === categoryId);
    const updated = normalizeDisplayCategoryItem(
      {
        id: categoryId,
        name,
        iconKey,
        sort,
        enabled
      },
      currentIndex < 0 ? 0 : currentIndex
    );
    if (!updated) {
      showToast('保存展示类目失败，请稍后重试。', 'error');
      return;
    }
    const nextItems = state.displayCategories.map((item) => {
      if (item.id !== categoryId) {
        return item;
      }
      return {
        ...item,
        ...updated,
        id: safeText(current?.id, categoryId)
      };
    });
    try {
      await persistDisplayCategories(nextItems);
      renderDisplayCategoryManagerBody(modal);
      showToast('展示类目已更新。');
    } catch (error) {
      const reason = toMinimalErrorReason(error);
      showToast(`保存展示类目失败：${reason}`, 'error');
    }
  });

  renderDisplayCategoryManagerBody(modal);
  return modal;
};

const openDisplayCategoryManagerModal = () => {
  const modal = ensureDisplayCategoryManagerModal();
  renderDisplayCategoryManagerBody(modal);
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

const bindDisplayCategoryManageAction = () => {
  const manageButton = document.querySelector('#display-category-manage-btn') || document.querySelector('#export-products-btn');
  if (!(manageButton instanceof HTMLButtonElement)) {
    return;
  }
  ensureDisplayCategoryManagerModal();
  manageButton.addEventListener('click', () => {
    openDisplayCategoryManagerModal();
  });
};

const closeCategoryManagerModal = () => {
  const modal = document.querySelector('#category-manager-modal');
  if (!(modal instanceof HTMLElement)) {
    return;
  }
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
};

const buildCategoryParentOptions = (selectedParentId = '', currentCategoryId = '') => {
  const options = ['<option value="">无上级</option>'];
  state.categories.forEach((category) => {
    if (category.id === currentCategoryId) {
      return;
    }
    options.push(`<option value="${escape(category.id)}"${category.id === selectedParentId ? ' selected' : ''}>${escape(category.name)}</option>`);
  });
  return options.join('');
};

const renderCategoryManagerBody = (modal) => {
  const body = modal.querySelector('[data-role="category-list-body"]');
  const parentSelect = modal.querySelector('[data-role="create-category-parent"]');
  if (!(body instanceof HTMLElement)) {
    return;
  }
  if (parentSelect instanceof HTMLSelectElement) {
    parentSelect.innerHTML = buildCategoryParentOptions();
    parentSelect.value = '';
  }

  if (state.categories.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-sm text-slate-500">当前没有类目，商品的类目将显示“无”。</td></tr>`;
    return;
  }

  body.innerHTML = state.categories
    .map((category) => {
      return `
        <tr class="border-b border-slate-100 last:border-0" data-category-id="${escape(category.id)}">
          <td class="px-4 py-3">
            <input data-role="category-name" type="text" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(category.name)}" />
          </td>
          <td class="px-4 py-3">
            <input data-role="category-sort" type="number" class="w-24 rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" value="${escape(category.sort)}" />
          </td>
          <td class="px-4 py-3">
            <select data-role="category-parent" class="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary">
              ${buildCategoryParentOptions(safeText(category.parentId, ''), category.id)}
            </select>
          </td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-2">
              <button type="button" data-role="save-category" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">保存</button>
              <button type="button" data-role="delete-category" class="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
};

const ensureCategoryManagerModal = () => {
  const existed = document.querySelector('#category-manager-modal');
  if (existed instanceof HTMLElement) {
    return existed;
  }

  const modal = document.createElement('div');
  modal.id = 'category-manager-modal';
  modal.className = 'fixed inset-0 z-[92] hidden flex items-center justify-center bg-slate-900/50 p-4';
  modal.innerHTML = `
    <div class="w-full max-w-4xl rounded-xl bg-white shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900">类目管理</h3>
          <p class="text-xs text-slate-500">商品高于类目；没有类目时，商品展示“无”。</p>
        </div>
        <button type="button" data-role="close-category-manager" class="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="space-y-5 px-6 py-5">
        <form class="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[2fr_120px_1fr_auto]" data-role="create-category-form">
          <input name="name" type="text" required class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" placeholder="新增类目名称" />
          <input name="sort" type="number" class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary" placeholder="排序" value="100" />
          <select name="parentId" data-role="create-category-parent" class="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"></select>
          <button type="submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">新增类目</button>
        </form>
        <div class="overflow-hidden rounded-xl border border-slate-200">
          <table class="w-full border-collapse text-left">
            <thead class="bg-slate-50">
              <tr class="text-xs font-bold tracking-wider text-slate-500 uppercase">
                <th class="px-4 py-3">类目名称</th>
                <th class="px-4 py-3">排序</th>
                <th class="px-4 py-3">上级类目</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody data-role="category-list-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('[data-role="close-category-manager"]')?.addEventListener('click', () => closeCategoryManagerModal());
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeCategoryManagerModal();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeCategoryManagerModal();
    }
  });

  const createForm = modal.querySelector('[data-role="create-category-form"]');
  if (createForm instanceof HTMLFormElement) {
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const name = safeText(formData.get('name'), '').trim();
      if (!name) {
        showToast('类目名称不能为空。', 'error');
        return;
      }
      const sort = toNumber(formData.get('sort'), 100);
      const parentIdValue = safeText(formData.get('parentId'), '').trim();
      const parentId = getCategoryById(parentIdValue) ? parentIdValue : '';

      try {
        let nextCategory;
        if (state.context?.mode === 'dev') {
          const response = await createCatalogCategory(toCategoryPayload(name, sort, parentId));
          if (response.status !== 201 || !response.data?.id) {
            throw new Error('后端新增类目失败，请稍后重试。');
          }
          nextCategory = response.data;
        } else {
          nextCategory = {
            id: `LOCAL-CAT-${Date.now()}`,
            name,
            sort,
            parentId: parentId || null
          };
        }

        setCategories([...state.categories, nextCategory], {
          persist: shouldUseLocalCategoryStore()
        });
        rebuildProductsAfterCategoryChange();
        renderCategoryManagerBody(modal);
        createForm.reset();
        const parentSelect = createForm.elements.namedItem('parentId');
        if (parentSelect instanceof HTMLSelectElement) {
          parentSelect.value = '';
        }
        showToast('类目已新增。');
      } catch (error) {
        const reason = toMinimalErrorReason(error);
        showToast(`新增类目失败：${reason}`, 'error');
      }
    });
  }

  const listBody = modal.querySelector('[data-role="category-list-body"]');
  listBody?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const actionButton = target.closest('[data-role="save-category"], [data-role="delete-category"]');
    if (!(actionButton instanceof HTMLButtonElement)) {
      return;
    }
    const row = actionButton.closest('tr');
    if (!(row instanceof HTMLTableRowElement)) {
      return;
    }
    const categoryId = safeText(row.dataset.categoryId, '');
    if (!categoryId) {
      return;
    }

    if (actionButton.dataset.role === 'delete-category') {
      const current = getCategoryById(categoryId);
      const categoryName = safeText(current?.name, '当前类目');
      if (!window.confirm(`确定删除类目“${categoryName}”吗？`)) {
        return;
      }

      try {
        if (state.context?.mode === 'dev') {
          const response = await deleteCatalogCategory(categoryId);
          if (response.status !== 204) {
            throw new Error('后端删除类目失败，请稍后重试。');
          }
        }
        const remaining = state.categories
          .filter((item) => item.id !== categoryId)
          .map((item) => {
            if (item.parentId === categoryId) {
              return {
                ...item,
                parentId: null
              };
            }
            return item;
          });
        setCategories(remaining, {
          persist: shouldUseLocalCategoryStore()
        });
        rebuildProductsAfterCategoryChange();
        renderCategoryManagerBody(modal);
        showToast('类目已删除。');
      } catch (error) {
        const reason = toMinimalErrorReason(error);
        showToast(`删除类目失败：${reason}`, 'error');
      }
      return;
    }

    const nameInput = row.querySelector('[data-role="category-name"]');
    const sortInput = row.querySelector('[data-role="category-sort"]');
    const parentSelect = row.querySelector('[data-role="category-parent"]');
    const name = safeText(nameInput?.value, '').trim();
    if (!name) {
      showToast('类目名称不能为空。', 'error');
      return;
    }
    const sort = toNumber(sortInput?.value, 100);
    const parentIdValue = safeText(parentSelect?.value, '').trim();
    if (parentIdValue && parentIdValue === categoryId) {
      showToast('类目不能设置自己为上级。', 'error');
      return;
    }
    const parentId = getCategoryById(parentIdValue) ? parentIdValue : '';

    try {
      let updated;
      if (state.context?.mode === 'dev') {
        const response = await updateCatalogCategory(categoryId, toCategoryPayload(name, sort, parentId));
        if (response.status !== 200 || !response.data?.id) {
          throw new Error('后端更新类目失败，请稍后重试。');
        }
        updated = response.data;
      } else {
        updated = {
          id: categoryId,
          name,
          sort,
          parentId: parentId || null
        };
      }
      const nextCategories = state.categories.map((item) => {
        if (item.id !== categoryId) {
          return item;
        }
        return normalizeCategoryItem(updated) || item;
      });
      setCategories(nextCategories, {
        persist: shouldUseLocalCategoryStore()
      });
      rebuildProductsAfterCategoryChange();
      renderCategoryManagerBody(modal);
      showToast('类目已更新。');
    } catch (error) {
      const reason = toMinimalErrorReason(error);
      showToast(`更新类目失败：${reason}`, 'error');
    }
  });

  renderCategoryManagerBody(modal);
  return modal;
};

const openCategoryManagerModal = () => {
  const modal = ensureCategoryManagerModal();
  renderCategoryManagerBody(modal);
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
};

const bindCategoryManageAction = () => {
  const manageButton = document.querySelector('#manage-category-btn');
  if (!(manageButton instanceof HTMLButtonElement)) {
    return;
  }
  ensureCategoryManagerModal();
  manageButton.addEventListener('click', () => {
    openCategoryManagerModal();
  });
};

const loadCategories = async () => {
  if (state.context?.mode === 'dev') {
    try {
      const response = await fetchCatalogCategories();
      const categoryItems = Array.isArray(response.data?.items) ? response.data.items : [];
      if (response.status === 200) {
        setCategories(categoryItems, { persist: false });
        return;
      }
    } catch {
      // ignore
    }
    setCategories([], { persist: false });
    return;
  }

  const stored = readCategoriesFromStorage();
  if (stored.length > 0) {
    setCategories(stored, { persist: false });
    return;
  }
  setCategories(DEFAULT_CATEGORIES, { persist: true });
};

const initProducts = async () => {
  const context = await ensureProtectedPage();
  if (!context) {
    return;
  }
  state.context = context;
  await loadCategories();
  await loadDisplayCategories();
  state.total = 0;
  hydrateStaticRows();
  bindProductRowActions();
  bindSelectionActions();
  bindPaginationActions();
  ensureEditDrawer();
  bindCreateProductAction();
  bindDisplayCategoryManageAction();
  bindCategoryManageAction();
  syncCategorySelectOptions();
  syncSelectAllProductsState();
  bindFilterActions();

  if (context.mode !== 'dev') {
    const mockItems = createMockProducts(30);
    applyProducts(mockItems, mockItems.length, 1);
    return;
  }

  const response = await fetchProducts(buildProductsQueryParams(1));
  if (response.status !== 200 || !response.data) {
    return;
  }

  renderProducts(response.data, 1);
};

void initProducts();
