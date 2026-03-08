import {
  canonicalCategories,
  canonicalDisplayCategories,
  canonicalProducts
} from '../../../../../../packages/shared/src/mock-data/index.js';

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type ProductStatusTone = 'active' | 'inactive' | 'draft';

export type ProductModel = {
  basePrice: number;
  code: string;
  name: string;
};

export type ProductTier = {
  discountRate: number;
  minQty: number;
};

export type ProductRecord = {
  categoryId: string;
  coverImageUrl: string;
  description: string;
  id: string;
  inventory: number;
  models: ProductModel[];
  name: string;
  status: ProductStatus;
  tierPricing: ProductTier[];
};

export type CategoryItem = {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
};

export type DisplayCategoryItem = {
  enabled: boolean;
  iconKey: string;
  id: string;
  name: string;
  sort: number;
};

export const CATEGORY_EMPTY_LABEL = '无';
export const NO_CATEGORY_FILTER = '__NO_CATEGORY__';
export const CATEGORY_STORAGE_KEY = 'admin-web-products-categories';
export const DISPLAY_CATEGORY_STORAGE_KEY = 'admin-web-miniapp-display-categories';
export const MOCK_IMPORTED_PRODUCTS_STORAGE_KEY = 'admin-web-mock-imported-products';
export const PRODUCTS_PAGE_SIZE = 10;
export const MIN_TIER_QTY = 2;
export const MAX_TIER_DISCOUNT_RATE = 90;
export const DEFAULT_MODEL_NAME = '默认型号';
export const DEFAULT_MODEL_CODE = 'STD';

export const STATUS_FILTER_ITEMS: ReadonlyArray<{ label: string; value: string }> = [
  { value: '', label: '状态：全部' },
  { value: 'ACTIVE', label: '状态：启用' },
  { value: 'INACTIVE', label: '状态：停用' },
  { value: 'DRAFT', label: '状态：草稿' }
];

export const DISPLAY_CATEGORY_ICON_ITEMS: ReadonlyArray<{ label: string; symbol: string; value: string }> = [
  { value: 'setting', label: '紧固/工业', symbol: 'settings' },
  { value: 'desktop', label: '电气/电子', symbol: 'desktop_windows' },
  { value: 'shield', label: '安全防护', symbol: 'shield' },
  { value: 'notes', label: '办公/文具', symbol: 'description' },
  { value: 'brush', label: '清洁保洁', symbol: 'cleaning_services' },
  { value: 'hot', label: '茶歇/休闲', symbol: 'local_fire_department' },
  { value: 'apps', label: '通用图标', symbol: 'apps' }
];

export const CATEGORY_BADGE_CLASS: Record<string, string> = {
  紧固件: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  电气: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  安全防护: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  工具: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  仪器仪表: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  劳保清洁: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  办公文具: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  包装耗材: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  无: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  未分类: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
};

export const MODEL_CLASS_BADGE: Record<'单型号' | '多型号', string> = {
  单型号: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  多型号: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
};

export const STATUS_BADGE_CLASS: Record<ProductStatusTone, { dot: string; wrapper: string }> = {
  active: {
    wrapper:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  inactive: {
    wrapper:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  draft: {
    wrapper:
      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-100 dark:border-amber-800',
    dot: 'bg-amber-500'
  }
};

const MOCK_IMAGE_POOL = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCQoEH4gfPeWzK1H0fbTKGpdPsPEiVMSPpMe3jLG-QgVaadYTF5qCKXGMjK_UTCXUpALUF4RYSCB-uwdUYyEqrynzyRupEFmfWY0O4Y55MSNjHpEcnbyyoMgg9bnSiWa-xAQg9jjGABk35lkIoQYRcnYbRoheyqYHOwhN_dwLyq9p73TGuxxF4apYmpLHY9xpto3PvnH_aZ0I9bo4tHrTLkleRHk2Dxhp9kINeVt8_ELlHoEiskagOOP2omXZCUmUVbFac5vdDDsIY',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBEIgPW6ZBOTgr9Q108MfixPSYHRAYslI2QJq5jutI_I44OsmzXgS1DKgmv5bhUsoq8uj3sJsOGNsSVWTxV-MqVI5WZyd9Na0avk4Xb8Otkz0-SiSM9aoveA6AAYyaUAwwF7giqaUqikM6MKXWA62Lwkru6jttI92nQEEjAV7JrQewS4-8dgwyn_ivXI_iTPPk25_065zBjkvwThYjMA4WwJVvz0y9d0fZGYtJE111hzA0c9BL7tlLKI6GITyug2_lvbIU_qwqC5zs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAjfY9aErprDgMbNW85Bo1S8v946mPEkkDWaZzNHNBAYFo0m9XuCqFAv_SQv6LrE3AWOXealNtJiOQyGWyme10Dbf7sCna3NN2mr5lmmr9LG1DfWfVdbieVgjgFL9GHTkXi1tQJJdOYdR3YNQ8BM9KTCk0tuqJy0mtF_ha6Zar8OLDXFX51Fn6j7VCOSOmzIYgcuePgboazKpD8MCDDowKOK0VVUXHGHw50ztZCmTk1rfOmEFE_shi0E59oj3ZN72S3-T1R8lMP3TA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuATkU8VA_t7SGJYwPViJASvA_fn8uMFTdL9xTEl4WMsqfhxAvbR0nh2-_l1eL9GnV59mItV7WjLwXeKx6QdfbOXt-t02wb9ZDuQy7Ct-lJmuBaM2-N-eeAFCqQ_D-3lGfNZIyw5cdug2IE8WXiSN4Li-asDIj6cWCwM1GyC0Nq5xdNe1uaZ9zPdG0O57cR0GdpfWmpSfIaD3W3zsEa98n0M1GF0hB5VJGZMW3fESRS-sXsDmwHPEzklvk_cawQVRfgqmbWWeJSiV_s',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0dVU3CbsDZyVFNGcLshF6YPBJMXxeAkydfB9oG-gpqraaY3swuQGA6DlAzox0skc9W3gMDHpbOY7Ui6Dyfi72SLBagGUh5ASqADVL1jdp6k9txxiAxXeotx6YaP8KAeq_-eMws7k2lB-ugkiyFet-VpTh98336NktWjqnterKtgihC0oJOobwVBu322iP86hzYMstZBx7ItnBXjsjex5nGodo7N27yiGtEIvurLh64yG0d_g9NrQMb0bw9L9p4EHj3e2KWUbeq1c'
];

const toText = (value: unknown, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
};

const asRecord = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object') {
    return value as Record<string, any>;
  }
  return {};
};

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toStatus = (value: unknown): ProductStatus => {
  const normalized = toText(value, 'DRAFT').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'ON_SHELF' || normalized === 'ENABLED') {
    return 'ACTIVE';
  }
  if (normalized === 'INACTIVE' || normalized === 'OFF_SHELF' || normalized === 'DISABLED') {
    return 'INACTIVE';
  }
  return 'DRAFT';
};

const normalizeModelCode = (value: unknown, fallback = DEFAULT_MODEL_CODE) => {
  const code = toText(value, fallback)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9\-_]/g, '');
  return code || fallback;
};

const normalizeTierPricing = (value: unknown): ProductTier[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const tiers = value
    .map((item) => ({
      minQty: Math.max(MIN_TIER_QTY, Math.round(toNumber(item?.minQty, 0))),
      discountRate: Math.max(0, Math.min(MAX_TIER_DISCOUNT_RATE - 1, toNumber(item?.discountRate, 0)))
    }))
    .filter((item) => item.minQty >= MIN_TIER_QTY && item.discountRate > 0)
    .sort((left, right) => left.minQty - right.minQty);
  return tiers.filter((item, index) => index === 0 || tiers[index - 1]?.minQty !== item.minQty);
};

const normalizeModels = (value: unknown, fallbackName: string): ProductModel[] => {
  const item = asRecord(value);
  const candidates = Array.isArray(item.models) ? item.models : [];
  if (candidates.length === 0) {
    const fallbackPrice = toNumber(item.basePrice, 0);
    return [
      {
        name: DEFAULT_MODEL_NAME,
        code: normalizeModelCode(item.sku || item.code || fallbackName, DEFAULT_MODEL_CODE),
        basePrice: fallbackPrice
      }
    ];
  }
  return candidates.map((model, index) => ({
    name: toText(model?.name, `${DEFAULT_MODEL_NAME} ${index + 1}`),
    code: normalizeModelCode(model?.code, `${DEFAULT_MODEL_CODE}-${index + 1}`),
    basePrice: Math.max(0, toNumber(model?.basePrice, toNumber(item.basePrice, 0)))
  }));
};

export const formatCurrency = (value: number) => {
  return `¥${Math.max(0, toNumber(value, 0)).toFixed(2)}`;
};

export const formatInventory = (value: number) => {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.round(toNumber(value, 0))));
};

export const formatDiscountFold = (discountRate: number) => {
  const fold = Math.max(0.1, (100 - toNumber(discountRate, 0)) / 10);
  return `${fold.toFixed(1)} 折`;
};

export const getStatusMeta = (status: ProductStatus): { label: string; tone: ProductStatusTone } => {
  if (status === 'ACTIVE') {
    return { label: '启用', tone: 'active' };
  }
  if (status === 'INACTIVE') {
    return { label: '停用', tone: 'inactive' };
  }
  return { label: '草稿', tone: 'draft' };
};

export const getModelClass = (product: ProductRecord): '单型号' | '多型号' => {
  return product.models.length > 1 ? '多型号' : '单型号';
};

export const buildTierSummary = (tierPricing: ProductTier[]) => {
  if (!tierPricing.length) {
    return '标准档';
  }
  const maxDiscount = tierPricing.reduce((max, item) => Math.max(max, item.discountRate), 0);
  if (maxDiscount >= 10) {
    return '设置分层价格';
  }
  if (maxDiscount >= 5) {
    return '二档启用';
  }
  return '标准档';
};

export const resolveCategoryLabel = (categoryId: string, categories: CategoryItem[]) => {
  if (!categoryId) {
    return CATEGORY_EMPTY_LABEL;
  }
  return categories.find((item) => item.id === categoryId)?.name || CATEGORY_EMPTY_LABEL;
};

export const normalizeCategoryItem = (value: unknown, index = 0): CategoryItem => {
  const item = asRecord(value);
  return {
    id: toText(item.id, `category-${index + 1}`),
    name: toText(item.name, `类目 ${index + 1}`),
    sort: toNumber(item.sort, (index + 1) * 10),
    parentId: toText(item.parentId, '') || null
  };
};

export const normalizeDisplayCategoryItem = (value: unknown, index = 0): DisplayCategoryItem => {
  const item = asRecord(value);
  return {
    id: toText(item.id, `display-category-${index + 1}`),
    name: toText(item.name, `展示类目 ${index + 1}`),
    iconKey: toText(item.iconKey, 'apps').toLowerCase(),
    sort: toNumber(item.sort, index + 1),
    enabled: item.enabled !== false
  };
};

export const sortCategories = (items: CategoryItem[]) => {
  return [...items].sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, 'zh-CN'));
};

export const sortDisplayCategories = (items: DisplayCategoryItem[]) => {
  return [...items].sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, 'zh-CN'));
};

export const getDisplayIconOption = (iconKey: string) => {
  return DISPLAY_CATEGORY_ICON_ITEMS.find((item) => item.value === iconKey) || DISPLAY_CATEGORY_ICON_ITEMS[DISPLAY_CATEGORY_ICON_ITEMS.length - 1]!;
};

export const getDisplayIconSymbol = (iconKey: string) => getDisplayIconOption(iconKey).symbol;

export const readStoredJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const writeStoredJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write failures
  }
};

export const buildDefaultCategories = () => {
  return sortCategories(canonicalCategories.map((item, index) => normalizeCategoryItem(item, index)));
};

export const buildDefaultDisplayCategories = () => {
  return sortDisplayCategories(canonicalDisplayCategories.map((item, index) => normalizeDisplayCategoryItem(item, index)));
};

export const normalizeProduct = (item: unknown, index = 0): ProductRecord => {
  const record = asRecord(item);
  const id = toText(record.id, `MOCK-${String(index + 1).padStart(4, '0')}`);
  const categoryId = toText(record.categoryId, '');
  const models = normalizeModels(record, id);
  return {
    id,
    name: toText(record.name, `模拟商品 ${index + 1}`),
    categoryId,
    coverImageUrl: toText(record.coverImageUrl, MOCK_IMAGE_POOL[index % MOCK_IMAGE_POOL.length]),
    description: toText(record.description, ''),
    inventory: Math.max(0, Math.round(toNumber(record.inventory ?? record.inventoryQty ?? record.stock, 0))),
    status: toStatus(record.status),
    models,
    tierPricing: normalizeTierPricing(record.tierPricing)
  };
};

export const buildMockProducts = (count = 30): ProductRecord[] => {
  const templates = Array.isArray(canonicalProducts) && canonicalProducts.length > 0 ? canonicalProducts : [];
  if (templates.length === 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    const suffix = index < templates.length ? '' : ` ${index + 1}`;
    const next = normalizeProduct(
      {
        ...template,
        id: suffix ? `${toText(template?.id, `mock-${index + 1}`)}-${index + 1}` : template?.id,
        name: `${toText(template?.name, `模拟商品 ${index + 1}`)}${suffix}`,
        inventory: toNumber(template?.inventory, 0) + (index % 7) * 13,
        coverImageUrl: toText(template?.coverImageUrl, MOCK_IMAGE_POOL[index % MOCK_IMAGE_POOL.length])
      },
      index
    );
    return next;
  });
};

export const mergeImportedMockProducts = (baseItems: ProductRecord[]) => {
  const stored = readStoredJson<unknown[]>(MOCK_IMPORTED_PRODUCTS_STORAGE_KEY);
  if (!Array.isArray(stored) || stored.length === 0) {
    return baseItems;
  }
  const imported = stored.map((item, index) => normalizeProduct(item, index));
  const importedCodes = new Set(
    imported.flatMap((item) => item.models.map((model, modelIndex) => normalizeModelCode(model.code, `${item.id}-${modelIndex + 1}`)))
  );
  const filteredBase = baseItems.filter((item) => (
    !item.models.some((model, index) => importedCodes.has(normalizeModelCode(model.code, `${item.id}-${index + 1}`)))
  ));
  return [...imported, ...filteredBase];
};
