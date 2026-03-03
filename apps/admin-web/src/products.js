import { createCatalogProduct, fetchProducts } from './lib/api';
import { ensureProtectedPage } from './lib/guard';
import { escape, safeText } from './lib/render';

const DEFAULT_PAGE_SIZE = 10;

const state = {
  context: null,
  total: 0,
  allProducts: [],
  categoryIdByLabel: {},
  productsById: {},
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

const CATEGORY_META = {
  apparel: { label: '服饰', categoryId: 'apparel' },
  electronics: { label: '电子产品', categoryId: 'electronics' },
  accessories: { label: '配件', categoryId: 'accessories' },
  homeDecor: { label: '家居装饰', categoryId: 'home-decor' },
  footwear: { label: '鞋履', categoryId: 'footwear' }
};

const CATEGORY_KEY_BY_LABEL = Object.entries(CATEGORY_META).reduce((accumulator, [key, value]) => {
  accumulator[value.label] = key;
  return accumulator;
}, {});

const CATEGORY_BADGE_CLASS = {
  服饰: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  电子产品: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  配件: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  家居装饰: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  鞋履: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  未分类: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
};

const MOCK_IMAGE_POOL = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCQoEH4gfPeWzK1H0fbTKGpdPsPEiVMSPpMe3jLG-QgVaadYTF5qCKXGMjK_UTCXUpALUF4RYSCB-uwdUYyEqrynzyRupEFmfWY0O4Y55MSNjHpEcnbyyoMgg9bnSiWa-xAQg9jjGABk35lkIoQYRcnYbRoheyqYHOwhN_dwLyq9p73TGuxxF4apYmpLHY9xpto3PvnH_aZ0I9bo4tHrTLkleRHk2Dxhp9kINeVt8_ELlHoEiskagOOP2omXZCUmUVbFac5vdDDsIY',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBEIgPW6ZBOTgr9Q108MfixPSYHRAYslI2QJq5jutI_I44OsmzXgS1DKgmv5bhUsoq8uj3sJsOGNsSVWTxV-MqVI5WZyd9Na0avk4Xb8Otkz0-SiSM9aoveA6AAYyaUAwwF7giqaUqikM6MKXWA62Lwkru6jttI92nQEEjAV7JrQewS4-8dgwyn_ivXI_iTPPk25_065zBjkvwThYjMA4WwJVvz0y9d0fZGYtJE111hzA0c9BL7tlLKI6GITyug2_lvbIU_qwqC5zs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAjfY9aErprDgMbNW85Bo1S8v946mPEkkDWaZzNHNBAYFo0m9XuCqFAv_SQv6LrE3AWOXealNtJiOQyGWyme10Dbf7sCna3NN2mr5lmmr9LG1DfWfVdbieVgjgFL9GHTkXi1tQJJdOYdR3YNQ8BM9KTCk0tuqJy0mtF_ha6Zar8OLDXFX51Fn6j7VCOSOmzIYgcuePgboazKpD8MCDDowKOK0VVUXHGHw50ztZCmTk1rfOmEFE_shi0E59oj3ZN72S3-T1R8lMP3TA',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuATkU8VA_t7SGJYwPViJASvA_fn8uMFTdL9xTEl4WMsqfhxAvbR0nh2-_l1eL9GnV59mItV7WjLwXeKx6QdfbOXt-t02wb9ZDuQy7Ct-lJmuBaM2-N-eeAFCqQ_D-3lGfNZIyw5cdug2IE8WXiSN4Li-asDIj6cWCwM1GyC0Nq5xdNe1uaZ9zPdG0O57cR0GdpfWmpSfIaD3W3zsEa98n0M1GF0hB5VJGZMW3fESRS-sXsDmwHPEzklvk_cawQVRfgqmbWWeJSiV_s',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA0dVU3CbsDZyVFNGcLshF6YPBJMXxeAkydfB9oG-gpqraaY3swuQGA6DlAzox0skc9W3gMDHpbOY7Ui6Dyfi72SLBagGUh5ASqADVL1jdp6k9txxiAxXeotx6YaP8KAeq_-eMws7k2lB-ugkiyFet-VpTh98336NktWjqnterKtgihC0oJOobwVBu322iP86hzYMstZBx7ItnBXjsjex5nGodo7N27yiGtEIvurLh64yG0d_g9NrQMb0bw9L9p4EHj3e2KWUbeq1c'
];

const MOCK_PRODUCT_TEMPLATES = [
  { name: '经典纯棉 T 恤', categoryKey: 'apparel', tier: '标准档', inventory: 1240, status: 'ACTIVE' },
  { name: '无线耳机 Pro', categoryKey: 'electronics', tier: '设置分层价格', inventory: 45, status: 'INACTIVE' },
  { name: '真皮轻薄钱包', categoryKey: 'accessories', tier: '二档启用', inventory: 320, status: 'ACTIVE' },
  { name: '极简陶瓷花瓶', categoryKey: 'homeDecor', tier: '标准', inventory: 15, status: 'DRAFT' },
  { name: '性能跑鞋', categoryKey: 'footwear', tier: '设置分层价格', inventory: 850, status: 'ACTIVE' },
  { name: '商务双肩包', categoryKey: 'accessories', tier: '标准档', inventory: 268, status: 'ACTIVE' },
  { name: '智能手表 S', categoryKey: 'electronics', tier: '二档启用', inventory: 172, status: 'ACTIVE' },
  { name: '亚麻衬衫', categoryKey: 'apparel', tier: '标准档', inventory: 412, status: 'ACTIVE' },
  { name: '电竞键盘 K87', categoryKey: 'electronics', tier: '设置分层价格', inventory: 69, status: 'INACTIVE' },
  { name: '跑步水壶', categoryKey: 'accessories', tier: '标准', inventory: 506, status: 'ACTIVE' }
];

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
    Uncategorized: '未分类',
    'Standard Tier': '标准档',
    Standard: '标准',
    'Set Tiered Price': '设置分层价格',
    'Tier 2 Active': '二档启用',
    ACTIVE: '已上架',
    INACTIVE: '已下架',
    DRAFT: '草稿'
  };
  return map[key] || key || fallback;
};

const normalizeStatusValue = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  const map = {
    已上架: 'ACTIVE',
    上架: 'ACTIVE',
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

const getPaginationContainer = () => {
  return document.querySelector('[data-role="page-numbers"]');
};

const getPrevPageButton = () => {
  return document.querySelector('[data-role="page-prev"]');
};

const getNextPageButton = () => {
  return document.querySelector('[data-role="page-next"]');
};

const getTotalPages = () => {
  const pages = Math.ceil(state.total / state.pagination.pageSize);
  return Math.max(1, Number.isFinite(pages) ? pages : 1);
};

const updateSummary = (start, end, total) => {
  const summary = getSummaryElement();
  if (!summary) {
    return;
  }
  summary.innerHTML = `显示第 <span class="font-semibold text-slate-900 dark:text-white">${start}</span> 到 <span class="font-semibold text-slate-900 dark:text-white">${end}</span> 条，共 <span class="font-semibold text-slate-900 dark:text-white">${total}</span> 条结果`;
};

const resolveCategoryTag = (item) => {
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    return normalizeProductText(item.tags[0], '未分类');
  }
  return normalizeProductText(item.categoryId, '未分类');
};

const resolveTierLabel = (item) => {
  if (Array.isArray(item.tags) && item.tags.length > 1) {
    return normalizeProductText(item.tags[1], '标准档');
  }
  return '标准档';
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
  const tag = resolveCategoryTag(item);
  const categoryKey = CATEGORY_KEY_BY_LABEL[tag] || 'apparel';
  const categoryMeta = CATEGORY_META[categoryKey] || CATEGORY_META.apparel;
  return {
    ...item,
    id: safeText(item.id, `MOCK-${String(index + 1).padStart(4, '0')}`),
    name: safeText(item.name, `模拟商品 ${index + 1}`),
    categoryId: safeText(item.categoryId, categoryMeta.categoryId),
    tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : [tag, resolveTierLabel(item)],
    inventory: resolveInventory(item),
    status: normalizeStatusValue(item.status),
    coverImageUrl: safeText(item.coverImageUrl, '')
  };
};

const rebuildProductIndexes = () => {
  state.categoryIdByLabel = {};
  state.productsById = {};
  state.allProducts.forEach((item) => {
    const tag = resolveCategoryTag(item);
    const categoryId = safeText(item.categoryId, '');
    if (tag && categoryId) {
      state.categoryIdByLabel[tag] = categoryId;
    }
    upsertProductInState(item);
  });
};

const toProductStatusBadge = (status) => {
  const normalized = String(status || '').toUpperCase();
  const map = {
    ACTIVE: {
      label: '已上架',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    ON_SHELF: {
      label: '已上架',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    ENABLED: {
      label: '已上架',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800',
      dot: 'bg-emerald-500'
    },
    INACTIVE: {
      label: '已下架',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    },
    OFF_SHELF: {
      label: '已下架',
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      dot: 'bg-slate-400'
    },
    DISABLED: {
      label: '已下架',
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

const renderProductRow = (item) => {
  const image = safeText(item.coverImageUrl, '');
  const tag = resolveCategoryTag(item);
  const tier = resolveTierLabel(item);
  const inventory = resolveInventory(item);
  const status = safeText(item.status, 'DRAFT');
  const categoryClass = CATEGORY_BADGE_CLASS[tag] || CATEGORY_BADGE_CLASS.未分类;

  return `
    <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" data-product-id="${escape(safeText(item.id))}">
      <td class="px-6 py-4"><input class="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary bg-transparent" type="checkbox" /></td>
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

const renderPagination = () => {
  const container = getPaginationContainer();
  const prevButton = getPrevPageButton();
  const nextButton = getNextPageButton();
  if (!container || !prevButton || !nextButton) {
    return;
  }

  const totalPages = getTotalPages();
  const currentPage = state.pagination.currentPage;
  const tokens = buildPageTokens(totalPages, currentPage);

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
  nextButton.disabled = currentPage >= totalPages;
};

const renderCurrentPage = () => {
  const tbody = document.querySelector('table tbody');
  if (!tbody) {
    return;
  }

  const totalPages = getTotalPages();
  if (state.pagination.currentPage > totalPages) {
    state.pagination.currentPage = totalPages;
  }
  if (state.pagination.currentPage < 1) {
    state.pagination.currentPage = 1;
  }

  const offset = (state.pagination.currentPage - 1) * state.pagination.pageSize;
  const pageItems = state.pagination.remote
    ? state.allProducts
    : state.allProducts.slice(offset, offset + state.pagination.pageSize);

  if (pageItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-5 text-sm text-slate-500">后端暂无商品数据。</td></tr>';
    updateSummary(0, 0, state.total);
    renderPagination();
    return;
  }

  tbody.innerHTML = pageItems.map((item) => renderProductRow(item)).join('');
  const start = state.total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + pageItems.length, state.total);
  updateSummary(start, end, state.total);
  renderPagination();
};

const applyProducts = (items, total = items.length, currentPage = 1, remote = false) => {
  state.allProducts = items.map((item, index) => normalizeProductItem(item, index));
  state.total = Number.isFinite(Number(total)) ? Number(total) : state.allProducts.length;
  state.pagination.currentPage = currentPage;
  state.pagination.remote = remote;
  rebuildProductIndexes();
  renderCurrentPage();
};

const renderProducts = (payload, currentPage = 1) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const total = Number(payload?.total || items.length);
  applyProducts(items, total, currentPage, state.context?.mode === 'dev');
};

const createMockProducts = (count = 30) => {
  return Array.from({ length: count }, (_, index) => {
    const template = MOCK_PRODUCT_TEMPLATES[index % MOCK_PRODUCT_TEMPLATES.length];
    const categoryMeta = CATEGORY_META[template.categoryKey] || CATEGORY_META.apparel;
    const suffix = index < MOCK_PRODUCT_TEMPLATES.length ? '' : ` ${index + 1}`;
    return {
      id: `MOCK-${String(index + 1).padStart(4, '0')}`,
      name: `${template.name}${suffix}`,
      categoryId: categoryMeta.categoryId,
      tags: [categoryMeta.label, template.tier],
      inventory: Math.max(0, template.inventory + (index % 7) * 13),
      status: template.status,
      coverImageUrl: MOCK_IMAGE_POOL[index % MOCK_IMAGE_POOL.length],
      description: `模拟商品数据 #${index + 1}`
    };
  });
};

const goToPage = async (page) => {
  const totalPages = getTotalPages();
  const nextPage = Math.min(Math.max(page, 1), totalPages);
  if (nextPage === state.pagination.currentPage) {
    return;
  }

  if (state.context?.mode === 'dev') {
    const response = await fetchProducts({ page: nextPage, pageSize: DEFAULT_PAGE_SIZE });
    if (response.status !== 200 || !response.data) {
      showToast('分页加载失败，请稍后重试。', 'error');
      return;
    }
    renderProducts(response.data, nextPage);
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
  const category = CATEGORY_META[formData.categoryKey] || CATEGORY_META.apparel;
  const categoryId = state.categoryIdByLabel[category.label] || category.categoryId;
  return {
    id: `LOCAL-${Date.now()}`,
    name: formData.name,
    coverImageUrl: formData.coverImageUrl,
    categoryId,
    tags: [category.label, '标准档'],
    inventory: formData.inventory,
    status: formData.status
  };
};

const collectFormData = (form) => {
  const formData = new FormData(form);
  return {
    name: safeText(formData.get('name'), '').trim(),
    categoryKey: safeText(formData.get('categoryKey'), 'apparel'),
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
  const categoryLabel = normalizeProductText(row.querySelector('td:nth-child(3) span')?.textContent, '未分类');
  const categoryMeta = CATEGORY_META[CATEGORY_KEY_BY_LABEL[categoryLabel]] || CATEGORY_META.apparel;
  const categoryId = state.categoryIdByLabel[categoryLabel] || categoryMeta.categoryId;
  const tier = safeText(row.querySelector('td:nth-child(4) span')?.textContent, '标准档');
  const inventoryText = safeText(row.querySelector('td:nth-child(5) .font-medium')?.textContent, '0');
  const inventory = Math.max(0, Number(inventoryText.replace(/[^\d.-]/g, '')) || 0);
  const statusText = safeText(row.querySelector('td:nth-child(6) span')?.textContent, '草稿').replace(/\s+/g, '');
  const status = normalizeStatusValue(statusText);
  const thumb = row.querySelector('td:nth-child(2) .size-12');
  const coverImageUrl = readBackgroundImageUrl(thumb?.style?.backgroundImage);
  const cached = state.productsById[rowId] || {};

  return {
    id: rowId,
    name,
    categoryId,
    tags: [categoryLabel, tier],
    inventory,
    status,
    coverImageUrl,
    description: safeText(cached.description, '')
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
  const categoryClass = CATEGORY_BADGE_CLASS[categoryLabel] || CATEGORY_BADGE_CLASS.未分类;
  const categoryBadge = row.querySelector('td:nth-child(3) span');
  if (categoryBadge) {
    categoryBadge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryClass}`;
    categoryBadge.textContent = categoryLabel;
  }

  const tierLabel = resolveTierLabel(product);
  const tierElement = row.querySelector('td:nth-child(4) span');
  if (tierElement) {
    tierElement.textContent = tierLabel;
  }

  const inventoryElement = row.querySelector('td:nth-child(5) .font-medium');
  if (inventoryElement) {
    inventoryElement.textContent = String(resolveInventory(product));
  }

  const statusCell = row.querySelector('td:nth-child(6)');
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
        <select name="categoryKey" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">
          <option value="apparel">服饰</option>
          <option value="electronics">电子产品</option>
          <option value="accessories">配件</option>
          <option value="homeDecor">家居装饰</option>
          <option value="footwear">鞋履</option>
        </select>
      </label>
      <label class="block space-y-1 text-sm text-slate-700">
        <span>分层定价说明</span>
        <input name="tierLabel" type="text" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" />
      </label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block space-y-1 text-sm text-slate-700">
          <span>库存</span>
          <input name="inventory" type="number" min="0" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary" />
        </label>
        <label class="block space-y-1 text-sm text-slate-700">
          <span>状态</span>
          <select name="status" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">
            <option value="ACTIVE">已上架</option>
            <option value="INACTIVE">已下架</option>
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
        const categoryKey = safeText(formData.get('categoryKey'), 'apparel');
        const category = CATEGORY_META[categoryKey] || CATEGORY_META.apparel;
        const tierLabel = safeText(formData.get('tierLabel'), '标准档');
        const status = normalizeStatusValue(formData.get('status'));
        const inventory = Math.max(0, Number(formData.get('inventory') || 0));
        const coverImageUrl = safeText(formData.get('coverImageUrl'), '');
        const description = safeText(formData.get('description'), '');

        const existing = state.productsById[state.drawer.productId] || getProductFromRow(state.drawer.row);
        const nextProduct = {
          ...existing,
          id: state.drawer.productId,
          name,
          categoryId: state.categoryIdByLabel[category.label] || category.categoryId,
          tags: [category.label, tierLabel],
          inventory,
          status,
          coverImageUrl,
          description
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

  const categoryLabel = resolveCategoryTag(product);
  const categoryKey = CATEGORY_KEY_BY_LABEL[categoryLabel] || 'apparel';
  const inventory = resolveInventory(product);
  setFormValue('name', safeText(product.name));
  setFormValue('categoryKey', categoryKey);
  setFormValue('tierLabel', resolveTierLabel(product));
  setFormValue('inventory', String(inventory === '--' ? 0 : inventory));
  setFormValue('status', normalizeStatusValue(product.status));
  setFormValue('coverImageUrl', safeText(product.coverImageUrl));
  setFormValue('description', safeText(product.description, ''));

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
            <span>类目 *</span>
            <select name="categoryKey" class="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary">
              <option value="apparel">服饰</option>
              <option value="electronics">电子产品</option>
              <option value="accessories">配件</option>
              <option value="homeDecor">家居装饰</option>
              <option value="footwear">鞋履</option>
            </select>
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
              <option value="ACTIVE">已上架</option>
              <option value="DRAFT">草稿</option>
              <option value="INACTIVE">已下架</option>
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
      if (state.context?.mode === 'dev') {
        const category = CATEGORY_META[values.categoryKey] || CATEGORY_META.apparel;
        const detectedCategoryId = state.categoryIdByLabel[category.label] || category.categoryId;
        const payload = {
          name: values.name,
          categoryId: detectedCategoryId,
          description: values.description || undefined,
          coverImageUrl: values.coverImageUrl || undefined,
          images: values.coverImageUrl ? [values.coverImageUrl] : undefined,
          tags: [category.label, '标准档']
        };
        const response = await createCatalogProduct(payload);
        if (response.status !== 201 || !response.data?.product) {
          throw new Error('后端创建失败，请稍后重试。');
        }
        appendProductRow({
          id: safeText(response.data.product.id, `SPU-${Date.now()}`),
          name: safeText(response.data.product.name, values.name),
          coverImageUrl: safeText(response.data.product.images?.[0], values.coverImageUrl),
          categoryId: safeText(response.data.product.categoryId, detectedCategoryId),
          tags: [category.label, '标准档'],
          inventory: values.inventory,
          status: values.status
        });
      } else {
        appendProductRow(createLocalProduct(values));
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

const initProducts = async () => {
  const context = await ensureProtectedPage();
  if (!context) {
    return;
  }
  state.context = context;
  state.total = 0;
  hydrateStaticRows();
  bindProductRowActions();
  bindPaginationActions();
  ensureEditDrawer();
  bindCreateProductAction();

  if (context.mode !== 'dev') {
    const mockItems = createMockProducts(30);
    applyProducts(mockItems, mockItems.length, 1);
    return;
  }

  const response = await fetchProducts({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  if (response.status !== 200 || !response.data) {
    return;
  }

  renderProducts(response.data, 1);
};

void initProducts();
