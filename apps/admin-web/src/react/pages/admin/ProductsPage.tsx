import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import {
  createCatalogCategory,
  createCatalogProduct,
  deleteCatalogCategory,
  fetchCatalogCategories,
  fetchMiniappDisplayCategories,
  fetchProducts,
  replaceMiniappDisplayCategories,
  updateCatalogCategory
} from '../../../lib/api';
import { ensureProtectedPage } from '../../../lib/guard';
import { AdminTopbar } from '../../layout/AdminTopbar';
import {
  buildDefaultCategories,
  buildDefaultDisplayCategories,
  buildMockProducts,
  buildTierSummary,
  CATEGORY_BADGE_CLASS,
  CATEGORY_EMPTY_LABEL,
  CATEGORY_STORAGE_KEY,
  DEFAULT_MODEL_CODE,
  DEFAULT_MODEL_NAME,
  DISPLAY_CATEGORY_ICON_ITEMS,
  DISPLAY_CATEGORY_STORAGE_KEY,
  formatCurrency,
  formatDiscountFold,
  formatInventory,
  getDisplayIconOption,
  getDisplayIconSymbol,
  getModelClass,
  getStatusMeta,
  MAX_TIER_DISCOUNT_RATE,
  mergeImportedMockProducts,
  MIN_TIER_QTY,
  MODEL_CLASS_BADGE,
  NO_CATEGORY_FILTER,
  normalizeCategoryItem,
  normalizeDisplayCategoryItem,
  normalizeProduct,
  PRODUCTS_PAGE_SIZE,
  readStoredJson,
  resolveCategoryLabel,
  sortCategories,
  sortDisplayCategories,
  STATUS_BADGE_CLASS,
  STATUS_FILTER_ITEMS,
  type CategoryItem,
  type DisplayCategoryItem,
  type ProductModel,
  type ProductRecord,
  type ProductTier
} from './products-data';

type PageContext = {
  mode: 'dev' | 'mock';
  session?: unknown;
} | null;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type ProductStatusValue = ProductRecord['status'];

type ToastState = {
  message: string;
  tone: 'error' | 'success';
} | null;

type ProductDraft = {
  categoryId: string;
  coverImageUrl: string;
  description: string;
  inventory: number;
  name: string;
  status: ProductStatusValue;
};

const cloneProduct = (product: ProductRecord): ProductRecord => ({
  ...product,
  models: product.models.map((model) => ({ ...model })),
  tierPricing: product.tierPricing.map((tier) => ({ ...tier }))
});

const buildSummaryText = (total: number, currentPage: number, pageSize: number, visibleCount: number) => {
  if (total === 0 || visibleCount === 0) {
    return (
      <>
        显示第 <span className="font-semibold text-slate-900 dark:text-white">0</span> 到{' '}
        <span className="font-semibold text-slate-900 dark:text-white">0</span> 条，共{' '}
        <span className="font-semibold text-slate-900 dark:text-white">0</span> 条结果
      </>
    );
  }

  const from = (currentPage - 1) * pageSize + 1;
  const to = from + visibleCount - 1;

  return (
    <>
      显示第 <span className="font-semibold text-slate-900 dark:text-white">{from}</span> 到{' '}
      <span className="font-semibold text-slate-900 dark:text-white">{to}</span> 条，共{' '}
      <span className="font-semibold text-slate-900 dark:text-white">{total}</span> 条结果
    </>
  );
};

const buildPageTokens = (totalPages: number, currentPage: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [1];
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

const toCategoryPayload = (item: CategoryItem) => ({
  name: item.name,
  sort: item.sort,
  parentId: item.parentId || null
});

const ToastMessage = ({ toast }: { toast: ToastState }) => {
  if (!toast) {
    return null;
  }

  const className =
    toast.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[120]">
      <div className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${className}`}>{toast.message}</div>
    </div>
  );
};

const ProductStatusBadge = ({ status }: { status: ProductStatusValue }) => {
  const meta = getStatusMeta(status);
  const styles = STATUS_BADGE_CLASS[meta.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${styles.wrapper}`}>
      <span className={`size-1.5 rounded-full ${styles.dot}`}></span>
      {meta.label}
    </span>
  );
};

type CreateProductModalProps = {
  categories: CategoryItem[];
  onClose: () => void;
  onSubmit: (draft: ProductDraft) => Promise<void>;
  open: boolean;
};

const CreateProductModal = ({ categories, onClose, onSubmit, open }: CreateProductModalProps) => {
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    categoryId: '',
    inventory: 0,
    status: 'ACTIVE',
    coverImageUrl: '',
    description: ''
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft({
      name: '',
      categoryId: '',
      inventory: 0,
      status: 'ACTIVE',
      coverImageUrl: '',
      description: ''
    });
    setErrorMessage('');
    setSubmitting(false);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      id="create-product-modal"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">新建商品</h3>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            data-role="close"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form
          className="space-y-4 px-6 py-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.name.trim()) {
              setErrorMessage('请先填写商品名称。');
              return;
            }
            setSubmitting(true);
            setErrorMessage('');
            try {
              await onSubmit({
                ...draft,
                name: draft.name.trim(),
                description: draft.description.trim(),
                coverImageUrl: draft.coverImageUrl.trim(),
                inventory: Math.max(0, Math.round(Number(draft.inventory) || 0))
              });
            } catch (error) {
              setErrorMessage(error instanceof Error ? error.message : '新建商品失败，请稍后重试。');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>商品名称 *</span>
              <input
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                name="name"
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="请输入商品名称"
                type="text"
                value={draft.name}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>类目（可选）</span>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                name="categoryKey"
                onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))}
                value={draft.categoryId}
              >
                <option value="">请选择类目</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>初始库存</span>
              <input
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                min="0"
                name="inventory"
                onChange={(event) => setDraft((current) => ({ ...current, inventory: Number(event.target.value) || 0 }))}
                type="number"
                value={draft.inventory}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>状态</span>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                name="status"
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ProductStatusValue }))}
                value={draft.status}
              >
                <option value="ACTIVE">启用</option>
                <option value="DRAFT">草稿</option>
                <option value="INACTIVE">停用</option>
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm text-slate-700">
            <span>封面图 URL</span>
            <input
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="coverImageUrl"
              onChange={(event) => setDraft((current) => ({ ...current, coverImageUrl: event.target.value }))}
              placeholder="https://example.com/image.jpg"
              type="url"
              value={draft.coverImageUrl}
            />
          </label>
          <label className="block space-y-1 text-sm text-slate-700">
            <span>商品描述</span>
            <textarea
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="description"
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              value={draft.description}
            />
          </label>
          <p className={errorMessage ? 'text-sm text-red-600' : 'hidden'} data-role="form-error">
            {errorMessage}
          </p>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              data-role="cancel"
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? '创建中...' : '确认创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

type ProductEditDrawerProps = {
  categories: CategoryItem[];
  onClose: () => void;
  onSave: (product: ProductRecord) => void;
  open: boolean;
  product: ProductRecord | null;
};

const ProductEditDrawer = ({ categories, onClose, onSave, open, product }: ProductEditDrawerProps) => {
  const [draft, setDraft] = useState<ProductRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!open || !product) {
      setDraft(null);
      setErrorMessage('');
      setPreviewUrl('');
      return;
    }
    setDraft(cloneProduct(product));
    setErrorMessage('');
    setPreviewUrl('');
  }, [open, product]);

  if (!open || !draft) {
    return null;
  }

  const updateModel = (index: number, patch: Partial<ProductModel>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        models: current.models.map((model, modelIndex) => (modelIndex === index ? { ...model, ...patch } : model))
      };
    });
  };

  const updateTier = (index: number, patch: Partial<ProductTier>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        tierPricing: current.tierPricing.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier))
      };
    });
  };

  return (
    <>
      <button
        id="product-drawer-overlay"
        className="fixed inset-0 z-[95] bg-slate-900/25"
        onClick={onClose}
        type="button"
      />
      <aside
        id="product-edit-drawer"
        className="fixed right-0 top-0 z-[96] h-screen w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">编辑商品</h3>
            <p className="text-xs text-slate-500">商品编辑当前仍保存为前端会话态。</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            data-role="close-drawer"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          data-role="drawer-form"
          onSubmit={(event) => {
            event.preventDefault();
            const name = draft.name.trim();
            const cleanedModels = draft.models
              .map((model, index) => ({
                name: model.name.trim(),
                code: model.code.trim().toUpperCase() || `${DEFAULT_MODEL_CODE}-${index + 1}`,
                basePrice: Math.max(0, Number(model.basePrice) || 0)
              }))
              .filter((model) => model.name);
            const cleanedTiers = draft.tierPricing
              .map((tier) => ({
                minQty: Math.max(MIN_TIER_QTY, Math.round(Number(tier.minQty) || 0)),
                discountRate: Math.max(0, Math.min(MAX_TIER_DISCOUNT_RATE - 1, Number(tier.discountRate) || 0))
              }))
              .filter((tier) => tier.discountRate > 0)
              .sort((left, right) => left.minQty - right.minQty);

            if (!name) {
              setErrorMessage('商品名称不能为空。');
              return;
            }
            if (cleanedModels.length === 0) {
              setErrorMessage('至少需要一个型号。');
              return;
            }
            const codeSet = new Set<string>();
            for (const model of cleanedModels) {
              if (codeSet.has(model.code)) {
                setErrorMessage(`型号编码重复：${model.code}`);
                return;
              }
              codeSet.add(model.code);
            }
            for (let index = 0; index < cleanedTiers.length; index += 1) {
              const current = cleanedTiers[index];
              if (current.discountRate <= 0 || current.discountRate >= MAX_TIER_DISCOUNT_RATE) {
                setErrorMessage(`第 ${index + 1} 条阶梯的优惠比例需在 0.1 - ${MAX_TIER_DISCOUNT_RATE} 之间。`);
                return;
              }
              if (index > 0 && cleanedTiers[index - 1].minQty === current.minQty) {
                setErrorMessage(`阶梯起购数量不能重复：${current.minQty}`);
                return;
              }
            }

            onSave({
              ...draft,
              name,
              coverImageUrl: draft.coverImageUrl.trim(),
              description: draft.description.trim(),
              inventory: Math.max(0, Math.round(Number(draft.inventory) || 0)),
              models: cleanedModels,
              tierPricing: cleanedTiers
            });
          }}
        >
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <div className="relative flex aspect-video items-center justify-center bg-slate-100">
              {draft.coverImageUrl ? (
                <img
                  alt="商品预览图"
                  className="h-full w-full cursor-zoom-in object-cover"
                  data-role="drawer-preview-image"
                  onClick={() => setPreviewUrl(draft.coverImageUrl)}
                  src={draft.coverImageUrl}
                />
              ) : (
                <div className="text-sm text-slate-400" data-role="drawer-preview-empty">
                  暂无图片预览
                </div>
              )}
              {draft.coverImageUrl ? (
                <button
                  className="absolute right-2 top-2 rounded bg-slate-900/70 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900"
                  data-role="open-image-preview"
                  onClick={() => setPreviewUrl(draft.coverImageUrl)}
                  type="button"
                >
                  查看大图
                </button>
              ) : null}
            </div>
          </div>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>商品名称 *</span>
            <input
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="name"
              onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)}
              type="text"
              value={draft.name}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>类目</span>
            <select
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="categoryKey"
              onChange={(event) => setDraft((current) => current ? { ...current, categoryId: event.target.value } : current)}
              value={draft.categoryId}
            >
              <option value="">请选择类目</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500">商品高于类目，未设置类目将显示“无”。</span>
          </label>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">型号设置</p>
                <p className="text-xs text-slate-500">可维护多个型号编码与基础售价。</p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                data-role="add-model-row"
                onClick={() => {
                  setDraft((current) => current ? {
                    ...current,
                    models: [
                      ...current.models,
                      {
                        name: `${DEFAULT_MODEL_NAME} ${current.models.length + 1}`,
                        code: `${DEFAULT_MODEL_CODE}-${current.models.length + 1}`,
                        basePrice: current.models[0]?.basePrice || 0
                      }
                    ]
                  } : current);
                }}
                type="button"
              >
                新增型号
              </button>
            </div>

            <div className="space-y-2" data-role="model-list">
              {draft.models.map((model, index) => (
                <div
                  key={`${model.code}-${index}`}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
                  data-role="model-row"
                >
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>型号名称</span>
                    <input
                      className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                      data-field="model-name"
                      onChange={(event) => updateModel(index, { name: event.target.value })}
                      type="text"
                      value={model.name}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>型号编码</span>
                    <input
                      className="w-full rounded-lg border-slate-300 text-sm uppercase focus:border-primary focus:ring-primary"
                      data-field="model-code"
                      onChange={(event) => updateModel(index, { code: event.target.value })}
                      type="text"
                      value={model.code}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">
                    <span>基础售价</span>
                    <input
                      className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                      data-field="model-base-price"
                      min="0"
                      onChange={(event) => updateModel(index, { basePrice: Number(event.target.value) || 0 })}
                      step="0.01"
                      type="number"
                      value={model.basePrice}
                    />
                  </label>
                  <button
                    className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    data-role="remove-model-row"
                    disabled={draft.models.length <= 1}
                    onClick={() => {
                      setDraft((current) => current ? {
                        ...current,
                        models: current.models.length <= 1 ? current.models : current.models.filter((_, itemIndex) => itemIndex !== index)
                      } : current);
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">阶梯定价策略</p>
                <p className="text-xs text-slate-500">买得越多越便宜，按起购数量自动匹配优惠。</p>
              </div>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                data-role="add-tier-row"
                onClick={() => {
                  setDraft((current) => current ? {
                        ...current,
                        tierPricing: [
                          ...current.tierPricing,
                          {
                            minQty: Math.max(
                              MIN_TIER_QTY,
                              ((current.tierPricing[current.tierPricing.length - 1]?.minQty) || MIN_TIER_QTY - 3) + 3
                            ),
                            discountRate: 0
                          }
                    ]
                  } : current);
                }}
                type="button"
              >
                新增阶梯
              </button>
            </div>
            <div className="space-y-2" data-role="tier-list">
              {draft.tierPricing.map((tier, index) => {
                const basePrice = draft.models[0]?.basePrice || 0;
                const tierPrice = basePrice > 0 ? basePrice * (1 - tier.discountRate / 100) : 0;
                return (
                  <div
                    key={`${tier.minQty}-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
                    data-role="tier-row"
                  >
                    <label className="space-y-1 text-xs text-slate-600">
                      <span>起购数量</span>
                      <input
                        className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                        data-field="tier-min-qty"
                        min={MIN_TIER_QTY}
                        onChange={(event) => updateTier(index, { minQty: Number(event.target.value) || MIN_TIER_QTY })}
                        step="1"
                        type="number"
                        value={tier.minQty}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-600">
                      <span>优惠比例（%）</span>
                      <input
                        className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                        data-field="tier-discount-rate"
                        max={MAX_TIER_DISCOUNT_RATE}
                        min="0.1"
                        onChange={(event) => updateTier(index, { discountRate: Number(event.target.value) || 0 })}
                        step="0.1"
                        type="number"
                        value={tier.discountRate}
                      />
                      <p className="text-[11px] text-slate-400" data-role="tier-price-preview">
                        {basePrice > 0 && tier.discountRate > 0
                          ? `预估单价 ${formatCurrency(tierPrice)}（约 ${formatDiscountFold(tier.discountRate)}）`
                          : '填写后自动预估折后单价'}
                      </p>
                    </label>
                    <button
                      className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      data-role="remove-tier-row"
                      onClick={() => {
                        setDraft((current) => current ? {
                          ...current,
                          tierPricing: current.tierPricing.filter((_, itemIndex) => itemIndex !== index)
                        } : current);
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">示例：起购 10 件，优惠 8%，系统将按首型号基础售价预估折后价。</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm text-slate-700">
              <span>库存</span>
              <input
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                min="0"
                name="inventory"
                onChange={(event) => setDraft((current) => current ? { ...current, inventory: Number(event.target.value) || 0 } : current)}
                type="number"
                value={draft.inventory}
              />
            </label>
            <label className="block space-y-1 text-sm text-slate-700">
              <span>状态</span>
              <select
                className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
                name="status"
                onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as ProductStatusValue } : current)}
                value={draft.status}
              >
                <option value="ACTIVE">启用</option>
                <option value="INACTIVE">停用</option>
                <option value="DRAFT">草稿</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>封面图 URL</span>
            <input
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="coverImageUrl"
              onChange={(event) => setDraft((current) => current ? { ...current, coverImageUrl: event.target.value } : current)}
              placeholder="https://example.com/image.jpg"
              type="url"
              value={draft.coverImageUrl}
            />
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>商品描述</span>
            <textarea
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="description"
              onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)}
              rows={4}
              value={draft.description}
            />
          </label>

          <p className={errorMessage ? 'text-sm text-red-600' : 'hidden'} data-role="drawer-error">
            {errorMessage}
          </p>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              data-role="cancel-drawer"
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark" type="submit">
              保存（Mock）
            </button>
          </div>
        </form>
      </aside>

      {previewUrl ? (
        <div
          id="product-image-preview-modal"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/75 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewUrl('');
            }
          }}
        >
          <div className="relative w-full max-w-5xl">
            <button
              className="absolute -top-12 right-0 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-white"
              data-role="close-image-preview"
              onClick={() => setPreviewUrl('')}
              type="button"
            >
              关闭
            </button>
            <img alt="商品大图预览" className="max-h-[85vh] w-full rounded-xl object-contain" data-role="image-preview-target" src={previewUrl} />
          </div>
        </div>
      ) : null}
    </>
  );
};

type CategoryManagerModalProps = {
  categories: CategoryItem[];
  onClose: () => void;
  onCreate: (item: Omit<CategoryItem, 'id'>) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
  onUpdate: (item: CategoryItem) => Promise<void>;
  open: boolean;
};

const CategoryManagerModal = ({ categories, onClose, onCreate, onDelete, onUpdate, open }: CategoryManagerModalProps) => {
  const [rows, setRows] = useState<CategoryItem[]>([]);
  const [createDraft, setCreateDraft] = useState({ name: '', sort: 100, parentId: '' });
  const [pendingId, setPendingId] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setRows(categories.map((item) => ({ ...item })));
    setCreateDraft({ name: '', sort: 100, parentId: '' });
    setPendingId('');
  }, [categories, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      id="category-manager-modal"
      className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">类目管理</h3>
            <p className="text-xs text-slate-500">商品高于类目；没有类目时，商品展示“无”。</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            data-role="close-category-manager"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <form
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[2fr_120px_1fr_auto]"
            data-role="create-category-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!createDraft.name.trim()) {
                return;
              }
              setPendingId('create');
              try {
                await onCreate({
                  name: createDraft.name.trim(),
                  sort: Math.max(0, Math.round(Number(createDraft.sort) || 100)),
                  parentId: createDraft.parentId || null
                });
              } finally {
                setPendingId('');
              }
            }}
          >
            <input
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              name="name"
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="新增类目名称"
              type="text"
              value={createDraft.name}
            />
            <input
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              name="sort"
              onChange={(event) => setCreateDraft((current) => ({ ...current, sort: Number(event.target.value) || 100 }))}
              type="number"
              value={createDraft.sort}
            />
            <select
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              data-role="create-category-parent"
              name="parentId"
              onChange={(event) => setCreateDraft((current) => ({ ...current, parentId: event.target.value }))}
              value={createDraft.parentId}
            >
              <option value="">无上级</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingId === 'create'}
              type="submit"
            >
              新增类目
            </button>
          </form>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  <th className="px-4 py-3">类目名称</th>
                  <th className="px-4 py-3">排序</th>
                  <th className="px-4 py-3">上级类目</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody data-role="category-list-body">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={4}>
                      当前没有类目，商品的类目将显示“无”。
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0" data-category-id={row.id}>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="category-name"
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: value } : item)));
                          }}
                          type="text"
                          value={row.name}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-24 rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="category-sort"
                          onChange={(event) => {
                            const value = Number(event.target.value) || 0;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sort: value } : item)));
                          }}
                          type="number"
                          value={row.sort}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="category-parent"
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, parentId: value || null } : item)));
                          }}
                          value={row.parentId || ''}
                        >
                          <option value="">无上级</option>
                          {categories
                            .filter((category) => category.id !== row.id)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            data-role="save-category"
                            disabled={pendingId === row.id}
                            onClick={async () => {
                              setPendingId(row.id);
                              try {
                                await onUpdate({
                                  ...row,
                                  name: row.name.trim(),
                                  parentId: row.parentId || null,
                                  sort: Math.max(0, Math.round(Number(row.sort) || 0))
                                });
                              } finally {
                                setPendingId('');
                              }
                            }}
                            type="button"
                          >
                            保存
                          </button>
                          <button
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            data-role="delete-category"
                            disabled={pendingId === row.id}
                            onClick={async () => {
                              if (!window.confirm(`确定删除类目“${row.name}”吗？`)) {
                                return;
                              }
                              setPendingId(row.id);
                              try {
                                await onDelete(row.id);
                              } finally {
                                setPendingId('');
                              }
                            }}
                            type="button"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

type DisplayCategoryManagerModalProps = {
  items: DisplayCategoryItem[];
  onClose: () => void;
  onSaveAll: (items: DisplayCategoryItem[]) => Promise<void>;
  open: boolean;
};

const DisplayCategoryManagerModal = ({ items, onClose, onSaveAll, open }: DisplayCategoryManagerModalProps) => {
  const [rows, setRows] = useState<DisplayCategoryItem[]>([]);
  const [createDraft, setCreateDraft] = useState({ name: '', iconKey: 'apps', sort: 100, enabled: true });
  const [createFeedback, setCreateFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [lastAddedRowId, setLastAddedRowId] = useState('');
  const [saving, setSaving] = useState(false);
  const rowNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setRows(items.map((item) => ({ ...item })));
    setCreateDraft({ name: '', iconKey: 'apps', sort: 100, enabled: true });
    setCreateFeedback(null);
    setLastAddedRowId('');
    setSaving(false);
  }, [items, open]);

  useEffect(() => {
    if (!open || !lastAddedRowId) {
      return;
    }
    const target = rowNameInputRefs.current[lastAddedRowId];
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus();
    target.select();
    setLastAddedRowId('');
  }, [lastAddedRowId, open, rows]);

  if (!open) {
    return null;
  }

  const enabledItems = rows.filter((item) => item.enabled);
  const canCreateDisplayCategory = createDraft.name.trim().length > 0;

  return (
    <div
      id="display-category-manager-modal"
      className="fixed inset-0 z-[93] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">展示类目管理</h3>
            <p className="text-xs text-slate-500">管理小程序首页的展示类目（Admin 改动会同步到小程序首页）。</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            data-role="close-display-category-manager"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <form
            className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[2fr_1fr_110px_110px_auto]"
            data-role="create-display-category-form"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmedName = createDraft.name.trim();
              if (!trimmedName) {
                setCreateFeedback({ message: '请先填写展示类目名称。', tone: 'error' });
                return;
              }
              const nextId = `display-cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              setRows((current) => sortDisplayCategories([
                ...current,
                normalizeDisplayCategoryItem(
                  {
                    id: nextId,
                    name: trimmedName,
                    iconKey: createDraft.iconKey,
                    sort: createDraft.sort,
                    enabled: createDraft.enabled
                  },
                  current.length
                )
              ]));
              setCreateDraft({ name: '', iconKey: 'apps', sort: 100, enabled: true });
              setCreateFeedback({ message: '已加入列表，记得点击“保存全部变更”。', tone: 'success' });
              setLastAddedRowId(nextId);
            }}
          >
            <input
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              name="name"
              onChange={(event) => {
                const value = event.target.value;
                setCreateDraft((current) => ({ ...current, name: value }));
                if (createFeedback) {
                  setCreateFeedback(null);
                }
              }}
              placeholder="新增展示类目名称"
              type="text"
              value={createDraft.name}
            />
            <select
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              name="iconKey"
              onChange={(event) => setCreateDraft((current) => ({ ...current, iconKey: event.target.value }))}
              value={createDraft.iconKey}
            >
              {DISPLAY_CATEGORY_ICON_ITEMS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
              name="sort"
              onChange={(event) => setCreateDraft((current) => ({ ...current, sort: Number(event.target.value) || 100 }))}
              type="number"
              value={createDraft.sort}
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <input
                checked={createDraft.enabled}
                className="rounded border-slate-300 text-primary focus:ring-primary"
                name="enabled"
                onChange={(event) => setCreateDraft((current) => ({ ...current, enabled: event.target.checked }))}
                type="checkbox"
              />
              <span>启用</span>
            </label>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canCreateDisplayCategory}
              type="submit"
            >
              新增类目
            </button>
          </form>

          {createFeedback ? (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                createFeedback.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {createFeedback.message}
            </div>
          ) : null}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">小程序展示预览（仅展示启用项）</h4>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-4" data-role="display-category-preview">
              {enabledItems.length === 0 ? (
                <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                  暂无启用中的展示类目。
                </div>
              ) : (
                enabledItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <span className="material-symbols-outlined text-base">{getDisplayIconSymbol(item.iconKey)}</span>
                    </div>
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">排序：{item.sort}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  <th className="px-4 py-3">类目名称</th>
                  <th className="px-4 py-3">图标</th>
                  <th className="px-4 py-3">排序</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody data-role="display-category-list-body">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={5}>
                      当前没有展示类目，请先新增。
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0" data-display-category-id={row.id}>
                      <td className="px-4 py-3">
                        <input
                          className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="display-category-name"
                          ref={(node) => {
                            rowNameInputRefs.current[row.id] = node;
                          }}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, name: value } : item)));
                          }}
                          type="text"
                          value={row.name}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="display-category-icon"
                          onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, iconKey: value } : item)));
                          }}
                          value={row.iconKey}
                        >
                          {DISPLAY_CATEGORY_ICON_ITEMS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className="w-24 rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                          data-role="display-category-sort"
                          onChange={(event) => {
                            const value = Number(event.target.value) || 0;
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sort: value } : item)));
                          }}
                          type="number"
                          value={row.sort}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            checked={row.enabled}
                            className="rounded border-slate-300 text-primary focus:ring-primary"
                            data-role="display-category-enabled"
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, enabled: checked } : item)));
                            }}
                            type="checkbox"
                          />
                          <span>{row.enabled ? '启用中' : '已停用'}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            data-role="save-display-category"
                            onClick={async () => {
                              setSaving(true);
                              try {
                                await onSaveAll(sortDisplayCategories(rows));
                              } finally {
                                setSaving(false);
                              }
                            }}
                            type="button"
                          >
                            保存
                          </button>
                          <button
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            data-role="delete-display-category"
                            onClick={() => {
                              if (!window.confirm(`确定删除展示类目“${row.name}”吗？`)) {
                                return;
                              }
                              setRows((current) => current.filter((item) => item.id !== row.id));
                            }}
                            type="button"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSaveAll(sortDisplayCategories(rows.map((item, index) => normalizeDisplayCategoryItem(item, index))));
                } finally {
                  setSaving(false);
                }
              }}
              type="button"
            >
              {saving ? '保存中...' : '保存全部变更'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 商品页（React 接管商品列表、编辑抽屉、类目管理和展示类目管理）。
export const ProductsPage = () => {
  const [context, setContext] = useState<PageContext>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState<ToastState>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [displayCategories, setDisplayCategories] = useState<DisplayCategoryItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState('');
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [displayCategoryManagerOpen, setDisplayCategoryManagerOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setLoadState('loading');
      const nextContext = await ensureProtectedPage();
      if (!active || !nextContext) {
        return;
      }
      setContext({
        mode: nextContext.mode === 'dev' ? 'dev' : 'mock',
        session: nextContext.session
      });

      try {
        const [loadedCategories, loadedDisplayCategories] = await Promise.all([
          (async () => {
            if (nextContext.mode === 'dev') {
              try {
                const response = await fetchCatalogCategories();
                if (response.status === 200 && Array.isArray(response.data?.items)) {
                  return sortCategories(response.data.items.map((item, index) => normalizeCategoryItem(item, index)));
                }
              } catch {
                return [];
              }
              return [];
            }

            const stored = readStoredJson<unknown[]>(CATEGORY_STORAGE_KEY);
            if (Array.isArray(stored) && stored.length > 0) {
              return sortCategories(stored.map((item, index) => normalizeCategoryItem(item, index)));
            }
            const defaults = buildDefaultCategories();
            localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(defaults));
            return defaults;
          })(),
          (async () => {
            if (nextContext.mode === 'dev') {
              try {
                const response = await fetchMiniappDisplayCategories();
                if (response.status === 200 && Array.isArray(response.data?.items)) {
                  return sortDisplayCategories(response.data.items.map((item, index) => normalizeDisplayCategoryItem(item, index)));
                }
              } catch {
                // ignore and fallback
              }
            }
            const stored = readStoredJson<unknown[]>(DISPLAY_CATEGORY_STORAGE_KEY);
            if (Array.isArray(stored) && stored.length > 0) {
              return sortDisplayCategories(stored.map((item, index) => normalizeDisplayCategoryItem(item, index)));
            }
            const defaults = buildDefaultDisplayCategories();
            localStorage.setItem(DISPLAY_CATEGORY_STORAGE_KEY, JSON.stringify(defaults));
            return defaults;
          })()
        ]);

        let loadedProducts: ProductRecord[] = [];
        if (nextContext.mode === 'dev') {
          const response = await fetchProducts({ page: 1, pageSize: 200 });
          loadedProducts =
            response.status === 200 && Array.isArray(response.data?.items)
              ? response.data.items.map((item, index) => normalizeProduct(item, index))
              : [];
        } else {
          loadedProducts = mergeImportedMockProducts(buildMockProducts(30));
        }

        if (!active) {
          return;
        }

        setCategories(loadedCategories);
        setDisplayCategories(loadedDisplayCategories);
        setProducts(loadedProducts);
        setLoadState('ready');
        setErrorMessage('');
      } catch (error) {
        if (!active) {
          return;
        }
        setLoadState('error');
        setErrorMessage(error instanceof Error ? error.message : '商品页加载失败，请稍后重试。');
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredProducts = useMemo(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter === NO_CATEGORY_FILTER && product.categoryId) {
        return false;
      }
      if (categoryFilter && categoryFilter !== NO_CATEGORY_FILTER && product.categoryId !== categoryFilter) {
        return false;
      }
      if (statusFilter && product.status !== statusFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const haystacks = [
        product.name,
        product.id,
        resolveCategoryLabel(product.categoryId, categories),
        ...product.models.map((model) => `${model.name} ${model.code}`)
      ];
      return haystacks.some((value) => value.toLowerCase().includes(keyword));
    });
  }, [categories, categoryFilter, deferredSearchTerm, products, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pagedProducts = useMemo(() => {
    const offset = (currentPageSafe - 1) * PRODUCTS_PAGE_SIZE;
    return filteredProducts.slice(offset, offset + PRODUCTS_PAGE_SIZE);
  }, [currentPageSafe, filteredProducts]);

  useEffect(() => {
    if (currentPage !== currentPageSafe) {
      setCurrentPage(currentPageSafe);
    }
  }, [currentPage, currentPageSafe]);

  const pageIds = pagedProducts.map((product) => product.id);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const editingProduct = useMemo(() => {
    return products.find((item) => item.id === editingProductId) || null;
  }, [editingProductId, products]);

  const showToast = (message: string, tone: 'error' | 'success' = 'success') => {
    setToast({ message, tone });
  };

  const persistCategories = (nextCategories: CategoryItem[], persistLocal: boolean) => {
    const sorted = sortCategories(nextCategories.map((item, index) => normalizeCategoryItem(item, index)));
    setCategories(sorted);
    if (persistLocal) {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(sorted));
    }
  };

  const persistDisplayCategories = async (nextItems: DisplayCategoryItem[]) => {
    const normalized = sortDisplayCategories(nextItems.map((item, index) => normalizeDisplayCategoryItem(item, index)));
    if (context?.mode === 'dev') {
      const payload = {
        items: normalized.map((item) => ({
          id: item.id,
          name: item.name,
          iconKey: getDisplayIconOption(item.iconKey).value,
          sort: item.sort,
          enabled: item.enabled
        }))
      };
      const response = await replaceMiniappDisplayCategories(payload);
      if (response.status !== 200 || !Array.isArray(response.data?.items)) {
        throw new Error('后端保存展示类目失败。');
      }
      const saved = sortDisplayCategories(response.data.items.map((item, index) => normalizeDisplayCategoryItem(item, index)));
      setDisplayCategories(saved);
      showToast('展示类目已更新。');
      return;
    }

    setDisplayCategories(normalized);
    localStorage.setItem(DISPLAY_CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
    showToast('展示类目已更新。');
  };

  const createLocalProduct = (draft: ProductDraft): ProductRecord => {
    return normalizeProduct(
      {
        id: `LOCAL-${Date.now()}`,
        name: draft.name,
        categoryId: draft.categoryId,
        coverImageUrl: draft.coverImageUrl,
        description: draft.description,
        inventory: draft.inventory,
        status: draft.status,
        models: [
          {
            name: DEFAULT_MODEL_NAME,
            code: DEFAULT_MODEL_CODE,
            basePrice: 0
          }
        ],
        tierPricing: []
      },
      0
    );
  };

  return (
    <>
      <ToastMessage toast={toast} />
      <AdminTopbar
        searchPlaceholder="搜索订单、商品..."
        leftSlot={
          <div className="flex items-center gap-4">
            <div className="size-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-2xl">grid_view</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">商品中心</h2>
          </div>
        }
      />

      <main className="mx-auto flex-1 w-full max-w-[1400px] px-6 py-8 md:px-10 lg:px-12">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl">商品与 SKU 管理</h1>
            <p className="max-w-2xl text-lg text-slate-500 dark:text-slate-400">集中管理库存、分层定价和类目展示，逐步替换旧版 DOM 脚本页面。</p>
          </div>
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-light px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-surface-dark dark:text-slate-200 dark:hover:bg-slate-800"
              id="display-category-manage-btn"
              onClick={() => setDisplayCategoryManagerOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">view_cozy</span>
              <span>展示类目管理</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-light px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-surface-dark dark:text-slate-200 dark:hover:bg-slate-800"
              id="manage-category-btn"
              onClick={() => setCategoryManagerOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">category</span>
              <span>类目管理</span>
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-bold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary-dark"
              id="create-product-btn"
              onClick={() => setCreateModalOpen(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              <span>新建商品</span>
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-surface-light p-4 shadow-sm dark:border-slate-800 dark:bg-surface-dark">
          <div className="flex flex-wrap items-center gap-4">
            <div className="mr-2 flex items-center gap-2 text-sm font-medium tracking-wider text-slate-500 uppercase dark:text-slate-400">
              <span className="material-symbols-outlined text-lg">filter_list</span>
              筛选
            </div>
            <div className="group relative">
              <select
                className="h-10 w-[180px] rounded-lg border border-slate-200 bg-slate-100 px-4 pr-9 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:border-primary focus:bg-white focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-900"
                id="products-category-filter"
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => {
                    setCategoryFilter(value);
                    setCurrentPage(1);
                  });
                }}
                value={categoryFilter}
              >
                <option value="">类目：全部</option>
                <option value={NO_CATEGORY_FILTER}>类目：未分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    类目：{category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="group relative">
              <select
                className="h-10 w-[160px] rounded-lg border border-slate-200 bg-slate-100 px-4 pr-9 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:border-primary focus:bg-white focus:ring-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-900"
                id="products-status-filter"
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  });
                }}
                value={statusFilter}
              >
                {STATUS_FILTER_ITEMS.map((item) => (
                  <option key={item.value || 'all'} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative min-w-[200px] flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                className="w-full rounded-lg border-transparent bg-slate-100 py-2 pl-10 pr-4 text-sm text-slate-900 transition-all placeholder-slate-400 focus:border-primary focus:bg-white focus:ring-0 dark:bg-slate-800 dark:text-white dark:focus:bg-slate-900"
                onChange={(event) => {
                  const value = event.target.value;
                  startTransition(() => {
                    setSearchTerm(value);
                    setCurrentPage(1);
                  });
                }}
                placeholder="按 SPU 名称或 SKU 编号搜索..."
                type="text"
                value={searchTerm}
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface-light shadow-sm dark:border-slate-800 dark:bg-surface-dark">
          {loadState === 'loading' ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">正在加载商品数据...</div>
          ) : loadState === 'error' ? (
            <div className="px-6 py-16 text-center text-sm text-red-600">{errorMessage || '商品页加载失败。'}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left" data-role="products-table">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                      <th className="w-[60px] px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                        <input
                          checked={allSelectedOnPage}
                          className="rounded border-slate-300 bg-transparent text-primary focus:ring-primary dark:border-slate-600"
                          data-role="select-all-products"
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedIds((current) => {
                              const next = new Set(current);
                              pageIds.forEach((id) => {
                                if (checked) {
                                  next.add(id);
                                } else {
                                  next.delete(id);
                                }
                              });
                              return next;
                            });
                          }}
                          type="checkbox"
                        />
                      </th>
                      <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">商品信息（SPU/SKU）</th>
                      <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">类目</th>
                      <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">型号分类</th>
                      <th className="px-6 py-4 text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">分层定价</th>
                      <th className="px-6 py-4 text-right text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">库存</th>
                      <th className="px-6 py-4 text-center text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">状态</th>
                      <th className="px-6 py-4 text-right text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pagedProducts.length === 0 ? (
                      <tr>
                        <td className="px-6 py-5 text-sm text-slate-500" colSpan={8}>
                          {products.length > 0 ? '暂无符合筛选条件的商品。' : '当前没有可展示的商品。'}
                        </td>
                      </tr>
                    ) : (
                      pagedProducts.map((product) => {
                        const categoryLabel = resolveCategoryLabel(product.categoryId, categories);
                        const categoryClass = CATEGORY_BADGE_CLASS[categoryLabel] || CATEGORY_BADGE_CLASS[CATEGORY_EMPTY_LABEL];
                        const modelClass = getModelClass(product);

                        return (
                          <tr
                            key={product.id}
                            className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            data-product-id={product.id}
                          >
                            <td className="px-6 py-4">
                              <input
                                checked={selectedIds.has(product.id)}
                                className="rounded border-slate-300 bg-transparent text-primary focus:ring-primary dark:border-slate-600"
                                data-role="select-product-row"
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  setSelectedIds((current) => {
                                    const next = new Set(current);
                                    if (checked) {
                                      next.add(product.id);
                                    } else {
                                      next.delete(product.id);
                                    }
                                    return next;
                                  });
                                }}
                                type="checkbox"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div
                                  className="size-12 shrink-0 rounded bg-slate-200 bg-cover bg-center dark:bg-slate-700"
                                  style={product.coverImageUrl ? { backgroundImage: `url("${product.coverImageUrl}")` } : undefined}
                                ></div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{product.name}</div>
                                  <div className="mt-0.5 text-xs font-mono text-slate-500">SPU {product.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryClass}`}>
                                {categoryLabel}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${MODEL_CLASS_BADGE[modelClass]}`}>
                                {modelClass}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-600 dark:text-slate-300">{buildTierSummary(product.tierPricing)}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-medium text-slate-900 dark:text-white">{formatInventory(product.inventory)}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <ProductStatusBadge status={product.status} />
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-primary"
                                data-role="open-product-drawer"
                                onClick={() => setEditingProductId(product.id)}
                                title="编辑商品"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                                <span className="hidden sm:inline">编辑</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-sm text-slate-500 dark:text-slate-400" data-role="products-summary">
                  {buildSummaryText(filteredProducts.length, currentPageSafe, PRODUCTS_PAGE_SIZE, pagedProducts.length)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded p-2 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:hover:bg-slate-800"
                    data-role="page-prev"
                    disabled={currentPageSafe <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  <div className="flex items-center gap-2" data-role="page-numbers">
                    {buildPageTokens(totalPages, currentPageSafe).map((token) => {
                      if (typeof token !== 'number') {
                        return (
                          <span key={token} className="text-slate-400">
                            ...
                          </span>
                        );
                      }
                      const active = token === currentPageSafe;
                      return (
                        <button
                          key={token}
                          className={
                            active
                              ? 'size-8 rounded bg-primary text-sm font-medium text-white'
                              : 'size-8 rounded text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800'
                          }
                          data-page={token}
                          data-role="page-number"
                          onClick={() => setCurrentPage(token)}
                          type="button"
                        >
                          {token}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="rounded p-2 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:hover:bg-slate-800"
                    data-role="page-next"
                    disabled={currentPageSafe >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <CreateProductModal
        categories={categories}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={async (draft) => {
          let nextProduct = createLocalProduct(draft);
          if (context?.mode === 'dev' && draft.categoryId) {
            try {
              const categoryLabel = resolveCategoryLabel(draft.categoryId, categories);
              const response = await createCatalogProduct({
                name: draft.name,
                categoryId: draft.categoryId,
                description: draft.description || undefined,
                coverImageUrl: draft.coverImageUrl || undefined,
                images: draft.coverImageUrl ? [draft.coverImageUrl] : undefined,
                tags: [categoryLabel, '标准档']
              });
              if (response.status !== 201 || !response.data?.product) {
                throw new Error('后端创建失败，请稍后重试。');
              }
              nextProduct = normalizeProduct(
                {
                  ...response.data.product,
                  coverImageUrl: response.data.product.images?.[0] || draft.coverImageUrl,
                  inventory: draft.inventory,
                  status: draft.status
                },
                products.length
              );
            } catch (error) {
              showToast(`后端创建失败，已在前端暂存。原因：${error instanceof Error ? error.message : '未知错误'}`, 'error');
            }
          }

          setProducts((current) => [nextProduct, ...current]);
          setCurrentPage(1);
          setCreateModalOpen(false);
          showToast('新建商品成功。');
        }}
        open={createModalOpen}
      />

      <ProductEditDrawer
        categories={categories}
        onClose={() => setEditingProductId('')}
        onSave={(updatedProduct) => {
          setProducts((current) => current.map((item) => (item.id === updatedProduct.id ? cloneProduct(updatedProduct) : item)));
          setEditingProductId('');
          showToast('保存成功。');
        }}
        open={Boolean(editingProductId)}
        product={editingProduct}
      />

      <CategoryManagerModal
        categories={categories}
        onClose={() => setCategoryManagerOpen(false)}
        onCreate={async (item) => {
          if (!item.name.trim()) {
            throw new Error('类目名称不能为空。');
          }

          if (context?.mode === 'dev') {
            const response = await createCatalogCategory(toCategoryPayload({ ...item, id: '', parentId: item.parentId || null }));
            if (response.status !== 201 || !response.data?.id) {
              throw new Error('后端新增类目失败，请稍后重试。');
            }
            persistCategories([...categories, normalizeCategoryItem(response.data, categories.length)], false);
          } else {
            persistCategories(
              [
                ...categories,
                {
                  id: `LOCAL-CAT-${Date.now()}`,
                  name: item.name,
                  sort: item.sort,
                  parentId: item.parentId || null
                }
              ],
              true
            );
          }
          showToast('类目已新增。');
        }}
        onDelete={async (categoryId) => {
          if (context?.mode === 'dev') {
            const response = await deleteCatalogCategory(categoryId);
            if (response.status !== 204) {
              throw new Error('后端删除类目失败，请稍后重试。');
            }
          }
          const nextCategories = categories
            .filter((item) => item.id !== categoryId)
            .map((item) => (item.parentId === categoryId ? { ...item, parentId: null } : item));
          persistCategories(nextCategories, context?.mode !== 'dev');
          setProducts((current) => current.map((item) => (item.categoryId === categoryId ? { ...item, categoryId: '' } : item)));
          showToast('类目已删除。');
        }}
        onUpdate={async (item) => {
          if (!item.name.trim()) {
            throw new Error('类目名称不能为空。');
          }
          if (item.parentId && item.parentId === item.id) {
            throw new Error('类目不能设置自己为上级。');
          }

          if (context?.mode === 'dev') {
            const response = await updateCatalogCategory(item.id, toCategoryPayload(item));
            if (response.status !== 200 || !response.data?.id) {
              throw new Error('后端更新类目失败，请稍后重试。');
            }
            persistCategories(
              categories.map((category) => (category.id === item.id ? normalizeCategoryItem(response.data) : category)),
              false
            );
          } else {
            persistCategories(categories.map((category) => (category.id === item.id ? { ...item, name: item.name.trim() } : category)), true);
          }
          showToast('类目已更新。');
        }}
        open={categoryManagerOpen}
      />

      <DisplayCategoryManagerModal
        items={displayCategories}
        onClose={() => setDisplayCategoryManagerOpen(false)}
        onSaveAll={persistDisplayCategories}
        open={displayCategoryManagerOpen}
      />
    </>
  );
};
