import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import {
  createCatalogSku,
  createCatalogCategory,
  createCatalogProduct,
  deleteCatalogCategory,
  deleteCatalogProduct,
  fetchCatalogCategories,
  fetchMiniappDisplayCategories,
  fetchProductDetail,
  fetchProducts,
  replaceMiniappDisplayCategories,
  updateCatalogSku,
  updateCatalogCategory,
  updateCatalogProduct,
  uploadCatalogProductImage
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
  insertCategoryAtPosition,
  MAX_PRODUCT_IMAGES,
  MAX_TIER_DISCOUNT_RATE,
  mergeImportedMockProducts,
  MIN_TIER_QTY,
  MODEL_CLASS_BADGE,
  moveCategoryToPosition,
  MOCK_PRODUCTS_STORAGE_KEY,
  NO_CATEGORY_FILTER,
  normalizeCategoryItem,
  normalizeDisplayCategoryItem,
  normalizeProduct,
  PRODUCTS_PAGE_SIZE,
  readStoredJson,
  removeCategoryAndCompact,
  resolveCategoryLabel,
  sortCategories,
  sortDisplayCategories,
  sortProductsByStatus,
  STATUS_BADGE_CLASS,
  STATUS_FILTER_ITEMS,
  type CategoryItem,
  type DisplayCategoryItem,
  type ProductModel,
  type ProductRecord,
  type ProductTier,
  writeStoredJson
} from './products-data';

type PageContext = {
  mode: 'dev' | 'mock';
  session?: unknown;
} | null;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type ProductStatusValue = ProductRecord['status'];

type BulkProductResult = {
  failedIds: string[];
  succeededIds: string[];
};

type ToastState = {
  message: string;
  tone: 'error' | 'success';
} | null;

type ProductDraft = {
  categoryId: string;
  description: string;
  images: string[];
  inventory: number;
  name: string;
  status: ProductStatusValue;
};

const MAX_MODEL_CODE_LENGTH = 20;
const BULK_PRODUCT_CONCURRENCY = 5;

const sanitizeModelCode = (value: string) => value.toUpperCase().slice(0, MAX_MODEL_CODE_LENGTH);
const sanitizeComposingModelCode = (value: string) => value.slice(0, MAX_MODEL_CODE_LENGTH);

const runBulkProductRequests = async (
  productIds: string[],
  request: (productId: string) => Promise<boolean>
): Promise<BulkProductResult> => {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  for (let index = 0; index < productIds.length; index += BULK_PRODUCT_CONCURRENCY) {
    const batch = productIds.slice(index, index + BULK_PRODUCT_CONCURRENCY);
    const results = await Promise.all(batch.map(async (productId) => {
      try {
        return await request(productId);
      } catch {
        return false;
      }
    }));
    results.forEach((succeeded, resultIndex) => {
      const productId = batch[resultIndex];
      if (!productId) {
        return;
      }
      if (succeeded) {
        succeededIds.push(productId);
      } else {
        failedIds.push(productId);
      }
    });
  }

  return { failedIds, succeededIds };
};

type EditableProductTier = {
  discountRate: ProductTier['discountRate'] | '';
  minQty: ProductTier['minQty'] | '';
};

type EditableProductRecord = Omit<ProductRecord, 'tierPricing'> & {
  tierPricing: EditableProductTier[];
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('图片读取失败，请重试。'));
    };
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'));
    reader.readAsDataURL(file);
  });

type ProductImageGalleryUploaderProps = {
  fileInputTestId?: string;
  onChange: (value: string[]) => void;
  onError: (message: string) => void;
  onPreview?: (value: string) => void;
  uploadImage?: (file: File) => Promise<string>;
  uploadTestId?: string;
  value: string[];
};

const ProductImageGalleryUploader = ({
  fileInputTestId,
  onChange,
  onError,
  onPreview,
  uploadImage,
  uploadTestId,
  value
}: ProductImageGalleryUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) {
      return;
    }
    const remainingSlots = Math.max(0, MAX_PRODUCT_IMAGES - value.length);
    if (remainingSlots === 0) {
      onError(`每个商品最多上传 ${MAX_PRODUCT_IMAGES} 张图片。`);
      return;
    }
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const invalidCount = files.length - imageFiles.length;
    const acceptedFiles = imageFiles.slice(0, remainingSlots);
    const overflowCount = imageFiles.length - acceptedFiles.length;
    if (acceptedFiles.length === 0) {
      onError('只能上传图片文件。');
      return;
    }
    let nextImages = [...value];
    let succeeded = 0;
    let failed = invalidCount;
    try {
      setUploading(true);
      for (const file of acceptedFiles) {
        try {
          const imageUrl = uploadImage ? await uploadImage(file) : await readFileAsDataUrl(file);
          if (!nextImages.includes(imageUrl)) {
            nextImages = [...nextImages, imageUrl];
            onChange(nextImages);
          }
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }
      const messages: string[] = [];
      if (failed > 0) {
        messages.push(`成功 ${succeeded} 张，失败 ${failed} 张`);
      }
      if (overflowCount > 0) {
        messages.push(`超过上限的 ${overflowCount} 张未上传`);
      }
      onError(messages.join('；'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    onChange(value.filter((_, imageIndex) => imageIndex !== index));
    onError('');
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= value.length) {
      return;
    }
    const nextImages = [...value];
    const [movedImage] = nextImages.splice(fromIndex, 1);
    if (!movedImage) {
      return;
    }
    nextImages.splice(toIndex, 0, movedImage);
    onChange(nextImages);
    onError('');
  };

  return (
    <div className="space-y-2 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <span>商品图片</span>
        <span className="text-xs text-slate-500" data-role="product-image-count">{value.length}/{MAX_PRODUCT_IMAGES}</span>
      </div>
      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-role="product-image-gallery">
          {value.map((imageUrl, index) => (
            <div
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              data-image-index={index}
              data-role="product-image-item"
              draggable
              key={`${imageUrl}-${index}`}
              onDragEnd={() => setDraggedImageIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedImageIndex(index)}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedImageIndex !== null) {
                  moveImage(draggedImageIndex, index);
                }
                setDraggedImageIndex(null);
              }}
            >
              <img
                alt={`商品图片 ${index + 1}`}
                className="h-full w-full object-cover"
                data-role="product-image-preview"
                onClick={() => onPreview?.(imageUrl)}
                src={imageUrl}
              />
              {index === 0 ? (
                <span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs font-semibold text-white">封面</span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/65 p-1.5 opacity-0 transition group-hover:opacity-100">
                <button
                  aria-label={`图片 ${index + 1} 左移`}
                  className="rounded bg-white/90 px-2 py-1 text-slate-700 disabled:opacity-40"
                  data-role="move-image-left"
                  disabled={index === 0}
                  onClick={() => moveImage(index, index - 1)}
                  type="button"
                >←</button>
                <button
                  aria-label={`图片 ${index + 1} 右移`}
                  className="rounded bg-white/90 px-2 py-1 text-slate-700 disabled:opacity-40"
                  data-role="move-image-right"
                  disabled={index === value.length - 1}
                  onClick={() => moveImage(index, index + 1)}
                  type="button"
                >→</button>
                <button
                  aria-label={`删除图片 ${index + 1}`}
                  className="rounded bg-red-500 px-2 py-1 text-white"
                  data-role="remove-product-image"
                  onClick={() => removeImage(index)}
                  type="button"
                >删除</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        data-testid={fileInputTestId}
        multiple
        name="productImageFiles"
        onChange={(event) => void applyFiles(Array.from(event.target.files || []))}
        type="file"
      />
      {value.length < MAX_PRODUCT_IMAGES ? (
        <button
          className={`group relative flex min-h-28 w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed px-4 py-4 text-center transition ${
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-slate-300 bg-slate-50 hover:border-primary/60 hover:bg-slate-50/80'
          }`}
          data-testid={uploadTestId}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            setDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            void applyFiles(Array.from(event.dataTransfer.files || []));
          }}
          type="button"
        >
            <span className="material-symbols-outlined mb-2 text-4xl text-slate-400 transition-colors group-hover:text-primary">
              add_photo_alternate
            </span>
            <span className="text-sm font-semibold text-slate-800">{uploading ? '图片上传中...' : '拖动图片到这里，或点击选择多张图片'}</span>
            <span className="mt-1 text-xs text-slate-500">按顺序上传，第一张自动作为封面</span>
        </button>
      ) : null}
    </div>
  );
};

const cloneProduct = (product: ProductRecord): ProductRecord => ({
  ...product,
  images: [...product.images],
  models: product.models.map((model) => ({ ...model })),
  tierPricing: product.tierPricing.map((tier) => ({ ...tier }))
});

const cloneProductForEdit = (product: ProductRecord): EditableProductRecord => ({
  ...product,
  images: [...product.images],
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

const toProductUpdatePayload = (product: ProductRecord) => {
  const images = product.images.map((image) => image.trim()).filter(Boolean);
  const coverImageUrl = images[0] || '';
  const payload: {
    categoryId?: string;
    coverImageUrl: string | null;
    description: string | null;
    images: string[];
    name: string;
    status: ProductStatusValue;
  } = {
    name: product.name,
    description: product.description.trim() || null,
    coverImageUrl: coverImageUrl || null,
    images,
    status: product.status
  };
  if (product.categoryId) {
    payload.categoryId = product.categoryId;
  }
  return payload;
};

const deriveTierPricingFromSkus = (skus: any): ProductTier[] => {
  if (!Array.isArray(skus)) {
    return [];
  }
  const skuWithTiers = skus.find((sku) => Array.isArray(sku?.priceTiers) && sku.priceTiers.length > 1);
  if (!skuWithTiers) {
    return [];
  }
  const tiers = skuWithTiers.priceTiers
    .map((tier: any) => ({
      minQty: Math.max(1, Math.round(Number(tier?.minQty) || 0)),
      unitPriceFen: Math.max(0, Math.round(Number(tier?.unitPriceFen) || 0))
    }))
    .filter((tier: { minQty: number; unitPriceFen: number }) => tier.minQty >= 1 && tier.unitPriceFen > 0)
    .sort((left: { minQty: number }, right: { minQty: number }) => left.minQty - right.minQty);
  const baseTier = tiers[0];
  if (!baseTier?.unitPriceFen) {
    return [];
  }
  return tiers.slice(1).map((tier: { minQty: number; unitPriceFen: number }) => ({
    minQty: tier.minQty,
    // Price tiers are persisted in whole fen, so deriving two decimal places
    // exposes cent-rounding noise (for example 6% becomes 6.21% at ¥1.45).
    discountRate: Math.round(Math.max(0, ((baseTier.unitPriceFen - tier.unitPriceFen) / baseTier.unitPriceFen) * 100))
  }));
};

const toProductRecordFromDetail = (detail: any, fallback: ProductRecord, index = 0): ProductRecord => {
  const skus = detail?.skus;
  const tierPricing = deriveTierPricingFromSkus(skus);
  return normalizeProduct(
    {
      ...fallback,
      ...(detail?.product || {}),
      coverImageUrl: detail?.product?.coverImageUrl || fallback.coverImageUrl,
      images: Array.isArray(detail?.product?.images) ? detail.product.images : fallback.images,
      inventory: fallback.inventory,
      models: detail?.models,
      skus,
      tierPricing: tierPricing.length > 0 ? tierPricing : fallback.tierPricing
    },
    index
  );
};

const toSkuPayload = (model: ProductModel, tierPricing: ProductTier[]) => {
  const unitPriceFen = Math.max(0, Math.round((Number(model.basePrice) || 0) * 100));
  const sortedTiers = [...tierPricing]
    .map((tier) => ({
      minQty: Math.max(MIN_TIER_QTY, Math.round(Number(tier.minQty) || 0)),
      discountRate: Math.max(0, Math.min(MAX_TIER_DISCOUNT_RATE - 1, Number(tier.discountRate) || 0))
    }))
    .filter((tier) => tier.discountRate > 0)
    .sort((left, right) => left.minQty - right.minQty);
  const priceTiers = [
    {
      minQty: 1,
      maxQty: sortedTiers.length > 0 ? sortedTiers[0].minQty - 1 : null,
      unitPriceFen
    },
    ...sortedTiers.map((tier, index) => ({
      minQty: tier.minQty,
      maxQty: sortedTiers[index + 1] ? sortedTiers[index + 1].minQty - 1 : null,
      unitPriceFen: Math.max(0, Math.round(unitPriceFen * (1 - tier.discountRate / 100)))
    }))
  ];
  return {
    name: model.name,
    skuCode: model.code || undefined,
    spec: model.name,
    priceTiers,
    isActive: true
  };
};

const extractResponseMessage = (response: unknown) => {
  const data = (response as { data?: { message?: unknown } } | null)?.data;
  return typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : '';
};

const readProductIdFromUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return String(new URLSearchParams(window.location.search).get('productId') || '').trim();
};

const syncProductIdToUrl = (productId: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (productId) {
    url.searchParams.set('productId', productId);
  } else {
    url.searchParams.delete('productId');
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
};

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
  uploadImage?: (file: File) => Promise<string>;
};

const CreateProductModal = ({ categories, onClose, onSubmit, open, uploadImage }: CreateProductModalProps) => {
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    categoryId: '',
    inventory: 0,
    status: 'ACTIVE',
    images: [],
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
      images: [],
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
            if (draft.images.length > MAX_PRODUCT_IMAGES) {
              setErrorMessage(`每个商品最多上传 ${MAX_PRODUCT_IMAGES} 张图片。`);
              return;
            }
            setSubmitting(true);
            setErrorMessage('');
            try {
              await onSubmit({
                ...draft,
                name: draft.name.trim(),
                description: draft.description.trim(),
                images: draft.images,
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
          <ProductImageGalleryUploader
            fileInputTestId="create-product-image-files"
            onChange={(images) => setDraft((current) => ({ ...current, images }))}
            onError={setErrorMessage}
            uploadImage={uploadImage}
            uploadTestId="create-product-image-upload"
            value={draft.images}
          />
          <label className="block space-y-1 text-sm text-slate-700">
            <span>商品简介</span>
            <textarea
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="description"
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="填写商品简介，前台商品详情页会展示这里的内容。"
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
  onSave: (product: ProductRecord) => Promise<void>;
  open: boolean;
  product: ProductRecord | null;
  uploadImage?: (file: File) => Promise<string>;
};

const ProductEditDrawer = ({ categories, onClose, onSave, open, product, uploadImage }: ProductEditDrawerProps) => {
  const [draft, setDraft] = useState<EditableProductRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modelRowKeys, setModelRowKeys] = useState<string[]>([]);
  const [tierRowKeys, setTierRowKeys] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const modelRowKeyCounterRef = useRef(0);
  const tierRowKeyCounterRef = useRef(0);

  useEffect(() => {
    if (!open || !product) {
      setDraft(null);
      setModelRowKeys([]);
      setTierRowKeys([]);
      setErrorMessage('');
      setPreviewUrl('');
      return;
    }
    setDraft(cloneProductForEdit(product));
    setModelRowKeys(product.models.map((_, index) => `${product.id}-model-${index}`));
    setTierRowKeys(product.tierPricing.map((_, index) => `${product.id}-tier-${index}`));
    setErrorMessage('');
    setIsSaving(false);
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

  const updateTier = (index: number, patch: Partial<EditableProductTier>) => {
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
            <p className="text-xs text-slate-500">保存后同步更新小程序商品目录。</p>
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
            if (isSaving) {
              return;
            }
            const name = draft.name.trim();
            const cleanedModels = draft.models
              .map((model, index) => ({
                id: model.id,
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
            if (draft.images.length > MAX_PRODUCT_IMAGES) {
              setErrorMessage(`每个商品最多上传 ${MAX_PRODUCT_IMAGES} 张图片。`);
              return;
            }

            setIsSaving(true);
            setErrorMessage('');
            void onSave({
              ...draft,
              name,
              coverImageUrl: draft.images[0] || '',
              images: draft.images,
              description: draft.description.trim(),
              inventory: Math.max(0, Math.round(Number(draft.inventory) || 0)),
              models: cleanedModels,
              tierPricing: cleanedTiers
            }).catch((error) => {
              setErrorMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。');
            }).finally(() => {
              setIsSaving(false);
            });
          }}
        >
          <ProductImageGalleryUploader
            fileInputTestId="edit-product-cover-file"
            onChange={(images) => setDraft((current) => current ? {
              ...current,
              coverImageUrl: images[0] || '',
              images
            } : current)}
            onError={setErrorMessage}
            onPreview={setPreviewUrl}
            uploadImage={uploadImage}
            uploadTestId="edit-product-cover-upload"
            value={draft.images}
          />

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
                  const nextKey = `${draft.id}-model-new-${modelRowKeyCounterRef.current}`;
                  modelRowKeyCounterRef.current += 1;
                  setModelRowKeys((current) => [...current, nextKey]);
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
                  key={modelRowKeys[index] || `${draft.id}-model-${index}`}
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
                      className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                      data-field="model-code"
                      inputMode="text"
                      maxLength={MAX_MODEL_CODE_LENGTH}
                      onChange={(event) => {
                        const isComposing = (event.nativeEvent as InputEvent).isComposing;
                        updateModel(index, {
                          code: isComposing
                            ? sanitizeComposingModelCode(event.target.value)
                            : sanitizeModelCode(event.target.value)
                        });
                      }}
                      onCompositionEnd={(event) => updateModel(index, { code: sanitizeModelCode(event.currentTarget.value) })}
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
                      setModelRowKeys((current) => current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
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
                  const nextKey = `${draft.id}-tier-new-${tierRowKeyCounterRef.current}`;
                  tierRowKeyCounterRef.current += 1;
                  setTierRowKeys((current) => [...current, nextKey]);
                  setDraft((current) => current ? {
                        ...current,
                        tierPricing: [
                          ...current.tierPricing,
                          {
                            minQty: Math.max(
                              MIN_TIER_QTY,
                              (Number(current.tierPricing[current.tierPricing.length - 1]?.minQty) || MIN_TIER_QTY - 3) + 3
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
                const discountRateValue = Number(tier.discountRate) || 0;
                const tierPrice = basePrice > 0 ? basePrice * (1 - discountRateValue / 100) : 0;
                return (
                  <div
                    key={tierRowKeys[index] || `${draft.id}-tier-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
                    data-role="tier-row"
                  >
                    <label className="space-y-1 text-xs text-slate-600">
                      <span>起购数量</span>
                      <input
                        className="w-full rounded-lg border-slate-300 text-sm focus:border-primary focus:ring-primary"
                        data-field="tier-min-qty"
                        min={MIN_TIER_QTY}
                        onChange={(event) => updateTier(index, {
                          minQty: event.target.value === '' ? '' : Number(event.target.value)
                        })}
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
                        onChange={(event) => updateTier(index, {
                          discountRate: event.target.value === '' ? '' : Number(event.target.value)
                        })}
                        step="0.1"
                        type="number"
                        value={tier.discountRate}
                      />
                      <p className="text-[11px] text-slate-400" data-role="tier-price-preview">
                        {basePrice > 0 && discountRateValue > 0
                          ? `预估单价 ${formatCurrency(tierPrice)}（约 ${formatDiscountFold(discountRateValue)}）`
                          : '填写后自动预估折后单价'}
                      </p>
                    </label>
                    <button
                      className="mt-5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
                      data-role="remove-tier-row"
                      onClick={() => {
                        setTierRowKeys((current) => current.filter((_, itemIndex) => itemIndex !== index));
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
            <span>商品简介</span>
            <textarea
              className="w-full rounded-lg border-slate-300 focus:border-primary focus:ring-primary"
              name="description"
              onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)}
              placeholder="填写商品简介，前台商品详情页会展示这里的内容。"
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
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              取消
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSaving}
              type="submit"
            >
              {isSaving ? '保存中...' : '保存'}
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

type EditableCategoryItem = Omit<CategoryItem, 'sort'> & { sort: number | '' };

const readCategorySortInput = (value: string): number | '' => value === '' ? '' : Number(value);

const CategoryManagerModal = ({ categories, onClose, onCreate, onDelete, onUpdate, open }: CategoryManagerModalProps) => {
  const [rows, setRows] = useState<EditableCategoryItem[]>([]);
  const [createDraft, setCreateDraft] = useState<{ name: string; sort: number | ''; parentId: string }>({ name: '', sort: 1, parentId: '' });
  const [pendingId, setPendingId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setRows(categories.map((item) => ({ ...item })));
    setCreateDraft({ name: '', sort: categories.length + 1, parentId: '' });
    setPendingId('');
    setErrorMessage('');
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
              if (!createDraft.name.trim() || createDraft.sort === '' || !Number.isInteger(createDraft.sort) || createDraft.sort < 1) {
                setErrorMessage('请输入类目名称和大于 0 的整数排序。');
                return;
              }
              setErrorMessage('');
              setPendingId('create');
              try {
                await onCreate({
                  name: createDraft.name.trim(),
                  sort: createDraft.sort,
                  parentId: createDraft.parentId || null
                });
              } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : '新增类目失败，请稍后重试。');
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
              min="1"
              onChange={(event) => setCreateDraft((current) => ({ ...current, sort: readCategorySortInput(event.target.value) }))}
              step="1"
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
          {errorMessage ? <p className="text-sm text-red-600" data-role="category-error">{errorMessage}</p> : null}
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
                            const value = readCategorySortInput(event.target.value);
                            setRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sort: value } : item)));
                          }}
                          min="1"
                          step="1"
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
                              if (!row.name.trim() || row.sort === '' || !Number.isInteger(row.sort) || row.sort < 1) {
                                setErrorMessage('请输入类目名称和大于 0 的整数排序。');
                                return;
                              }
                              setErrorMessage('');
                              setPendingId(row.id);
                              try {
                                await onUpdate({
                                  ...row,
                                  name: row.name.trim(),
                                  parentId: row.parentId || null,
                                  sort: row.sort
                                });
                              } catch (error) {
                                setErrorMessage(error instanceof Error ? error.message : '保存类目失败，请稍后重试。');
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
      className="fixed inset-0 z-[93] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-6 py-4">
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
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
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
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState('');
  const [editingProductDetail, setEditingProductDetail] = useState<ProductRecord | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [displayCategoryManagerOpen, setDisplayCategoryManagerOpen] = useState(false);
  const requestedProductIdRef = useRef(readProductIdFromUrl());

  const loadBackendProducts = useCallback(async () => {
    const response = await fetchProducts({ page: 1, pageSize: 200, status: 'ALL' });
    if (response.status !== 200 || !Array.isArray(response.data?.items)) {
      const serverMessage = extractResponseMessage(response);
      throw new Error(serverMessage || '商品列表加载失败，请稍后重试。');
    }
    return response.data.items.map((item, index) => normalizeProduct(item, index));
  }, []);

  const loadBackendCategories = useCallback(async () => {
    const response = await fetchCatalogCategories();
    if (response.status !== 200 || !Array.isArray(response.data?.items)) {
      const serverMessage = extractResponseMessage(response);
      throw new Error(serverMessage || '类目列表加载失败，请稍后重试。');
    }
    return sortCategories(response.data.items.map((item, index) => normalizeCategoryItem(item, index)));
  }, []);

  const refreshBackendCategories = useCallback(async () => {
    const nextCategories = await loadBackendCategories();
    setCategories(nextCategories);
    return nextCategories;
  }, [loadBackendCategories]);

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
                return await loadBackendCategories();
              } catch {
                return [];
              }
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
          loadedProducts = await loadBackendProducts();
        } else {
          const storedProducts = readStoredJson<unknown[]>(MOCK_PRODUCTS_STORAGE_KEY);
          const mockBaseProducts = Array.isArray(storedProducts) && storedProducts.length > 0
            ? storedProducts.map((item, index) => normalizeProduct(item, index))
            : buildMockProducts(30);
          loadedProducts = mergeImportedMockProducts(mockBaseProducts);
          writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, loadedProducts);
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
  }, [loadBackendCategories, loadBackendProducts]);

  const refreshBackendProducts = useCallback(async () => {
    if (context?.mode !== 'dev') {
      return;
    }
    const loadedProducts = await loadBackendProducts();
    setProducts(loadedProducts);
  }, [context?.mode, loadBackendProducts]);

  const uploadBackendCatalogProductImage = useCallback(async (file: File) => {
    const response = await uploadCatalogProductImage(file);
    const imageUrl = typeof response.data?.url === 'string' ? response.data.url.trim() : '';
    if (response.status !== 201 || !imageUrl) {
      const serverMessage = extractResponseMessage(response);
      throw new Error(serverMessage ? `图片上传失败：${serverMessage}` : '图片上传失败，请稍后重试。');
    }
    return imageUrl;
  }, []);

  useEffect(() => {
    if (context?.mode !== 'dev') {
      return;
    }

    let active = true;
    const refresh = () => {
      if (!active || document.visibilityState === 'hidden') {
        return;
      }
      void refreshBackendProducts().catch((error) => {
        console.warn('商品列表刷新失败', error);
      });
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [context?.mode, refreshBackendProducts]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredProducts = useMemo(() => {
    const keyword = deferredSearchTerm.trim().toLowerCase();
    return sortProductsByStatus(products.filter((product) => {
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
    }));
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [categoryFilter, searchTerm, statusFilter]);

  const pageIds = pagedProducts.map((product) => product.id);
  const allSelectedOnPage = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const editingProduct = useMemo(() => {
    if (editingProductDetail?.id === editingProductId) {
      return editingProductDetail;
    }
    return products.find((item) => item.id === editingProductId) || null;
  }, [editingProductDetail, editingProductId, products]);

  const showToast = (message: string, tone: 'error' | 'success' = 'success') => {
    setToast({ message, tone });
  };

  const openProductEditor = useCallback((product: ProductRecord) => {
    setEditingProductDetail(null);
    setEditingProductId(product.id);
    if (context?.mode !== 'dev') {
      return;
    }
    void fetchProductDetail(product.id).then((response) => {
      if (response.status !== 200 || !response.data?.product) {
        const serverMessage = extractResponseMessage(response);
        throw new Error(serverMessage || '商品详情加载失败。');
      }
      setEditingProductDetail(toProductRecordFromDetail(response.data, product));
    }).catch((error) => {
      showToast(error instanceof Error ? error.message : '商品详情加载失败。', 'error');
    });
  }, [context?.mode]);

  const closeProductEditor = useCallback(() => {
    if (requestedProductIdRef.current) {
      requestedProductIdRef.current = '';
      syncProductIdToUrl('');
    }
    setEditingProductId('');
    setEditingProductDetail(null);
  }, []);

  useEffect(() => {
    const requestedProductId = requestedProductIdRef.current;
    if (loadState !== 'ready' || !requestedProductId || editingProductId === requestedProductId) {
      return;
    }
    const targetProduct = products.find((item) => item.id === requestedProductId);
    if (!targetProduct) {
      requestedProductIdRef.current = '';
      syncProductIdToUrl('');
      showToast('目标商品不存在或无法访问。', 'error');
      return;
    }
    openProductEditor(targetProduct);
  }, [editingProductId, loadState, openProductEditor, products]);

  const deleteProduct = async (product: ProductRecord) => {
    if (!window.confirm(`确定删除商品“${product.name}”吗？`)) {
      return;
    }
    if (context?.mode === 'dev') {
      const response = await deleteCatalogProduct(product.id);
      if (response.status !== 204) {
        const serverMessage = extractResponseMessage(response);
        showToast(serverMessage ? `删除失败：${serverMessage}` : '删除失败，请稍后重试。', 'error');
        return;
      }
      await refreshBackendProducts();
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      showToast('商品已删除。');
      return;
    }

    setProducts((current) => {
      const nextProducts = current.filter((item) => item.id !== product.id);
      writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, nextProducts);
      return nextProducts;
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(product.id);
      return next;
    });
    showToast('商品已删除。');
  };

  const showBulkResult = (label: string, result: BulkProductResult) => {
    if (result.failedIds.length === 0) {
      showToast(`${label}完成：成功 ${result.succeededIds.length} 项。`);
      return;
    }
    showToast(`${label}完成：成功 ${result.succeededIds.length} 项，失败 ${result.failedIds.length} 项。`, 'error');
  };

  const updateSelectedProductStatus = async (status: ProductStatusValue, label: string) => {
    const productIds = Array.from(selectedIds);
    if (productIds.length === 0 || bulkActionPending) {
      return;
    }

    setBulkActionPending(true);
    try {
      let result: BulkProductResult;
      if (context?.mode === 'dev') {
        result = await runBulkProductRequests(productIds, async (productId) => {
          const response = await updateCatalogProduct(productId, { status });
          return response.status === 200;
        });
        await refreshBackendProducts();
      } else {
        setProducts((current) => {
          const nextProducts = current.map((product) => selectedIds.has(product.id) ? { ...product, status } : product);
          writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, nextProducts);
          return nextProducts;
        });
        result = { succeededIds: productIds, failedIds: [] };
      }
      setSelectedIds(new Set(result.failedIds));
      showBulkResult(label, result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `${label}失败，请刷新后重试。`, 'error');
    } finally {
      setBulkActionPending(false);
    }
  };

  const deleteSelectedProducts = async () => {
    const productIds = Array.from(selectedIds);
    if (productIds.length === 0 || bulkActionPending) {
      return;
    }
    if (!window.confirm(`确定删除已选择的 ${productIds.length} 个商品吗？此操作不可恢复。`)) {
      return;
    }

    setBulkActionPending(true);
    try {
      let result: BulkProductResult;
      if (context?.mode === 'dev') {
        result = await runBulkProductRequests(productIds, async (productId) => {
          const response = await deleteCatalogProduct(productId);
          return response.status === 204;
        });
        await refreshBackendProducts();
      } else {
        setProducts((current) => {
          const nextProducts = current.filter((product) => !selectedIds.has(product.id));
          writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, nextProducts);
          return nextProducts;
        });
        result = { succeededIds: productIds, failedIds: [] };
      }
      setSelectedIds(new Set(result.failedIds));
      showBulkResult('批量删除', result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量删除失败，请刷新后重试。', 'error');
    } finally {
      setBulkActionPending(false);
    }
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
        coverImageUrl: draft.images[0] || '',
        description: draft.description,
        images: draft.images,
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

        {selectedIds.size > 0 ? (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm dark:border-blue-900 dark:bg-blue-950/40"
            data-role="bulk-product-toolbar"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-900 dark:text-blue-100" data-role="bulk-selection-count">
                已选择 {selectedIds.size} 项
              </span>
              <button
                className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50 dark:text-blue-300"
                disabled={bulkActionPending}
                onClick={() => setSelectedIds(new Set())}
                type="button"
              >
                取消选择
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                data-role="bulk-set-active"
                disabled={bulkActionPending}
                onClick={() => void updateSelectedProductStatus('ACTIVE', '批量启用')}
                type="button"
              >
                批量启用
              </button>
              <button
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                data-role="bulk-set-draft"
                disabled={bulkActionPending}
                onClick={() => void updateSelectedProductStatus('DRAFT', '批量转草稿')}
                type="button"
              >
                批量转草稿
              </button>
              <button
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                data-role="bulk-set-inactive"
                disabled={bulkActionPending}
                onClick={() => void updateSelectedProductStatus('INACTIVE', '批量停用')}
                type="button"
              >
                批量停用
              </button>
              <button
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                data-role="bulk-delete-products"
                disabled={bulkActionPending}
                onClick={() => void deleteSelectedProducts()}
                type="button"
              >
                批量删除
              </button>
            </div>
          </div>
        ) : null}

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
                              <div className="flex justify-end gap-2">
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-primary"
                                  data-role="open-product-drawer"
                                  onClick={() => openProductEditor(product)}
                                  title="编辑商品"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                  <span className="hidden sm:inline">编辑</span>
                                </button>
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                  data-role="delete-product"
                                  onClick={() => void deleteProduct(product)}
                                  title="删除商品"
                                  type="button"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                  <span className="hidden sm:inline">删除</span>
                                </button>
                              </div>
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
          if (context?.mode === 'dev') {
            if (!draft.categoryId) {
              throw new Error('请选择类目后再创建商品。');
            }
            const categoryLabel = resolveCategoryLabel(draft.categoryId, categories);
            const response = await createCatalogProduct({
              name: draft.name,
              categoryId: draft.categoryId,
              description: draft.description || undefined,
              coverImageUrl: draft.images[0] || undefined,
              images: draft.images.length > 0 ? draft.images : undefined,
              status: draft.status,
              tags: [categoryLabel, '标准档']
            });
            if (response.status !== 201 || !response.data?.product) {
              const serverMessage = extractResponseMessage(response);
              throw new Error(serverMessage ? `后端创建失败：${serverMessage}` : '后端创建失败，请稍后重试。');
            }
            await refreshBackendProducts();
            setCurrentPage(1);
            setCreateModalOpen(false);
            showToast('新建商品成功。');
            return;
          }

          const nextProduct = createLocalProduct(draft);
          setProducts((current) => {
            const nextProducts = [nextProduct, ...current];
            writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, nextProducts);
            return nextProducts;
          });
          setCurrentPage(1);
          setCreateModalOpen(false);
          showToast('新建商品成功。');
        }}
        open={createModalOpen}
        uploadImage={context?.mode === 'dev' ? uploadBackendCatalogProductImage : undefined}
      />

      <ProductEditDrawer
        categories={categories}
        onClose={closeProductEditor}
        onSave={async (updatedProduct) => {
          if (context?.mode === 'dev') {
            const response = await updateCatalogProduct(updatedProduct.id, toProductUpdatePayload(updatedProduct));
            if (response.status !== 200 || !response.data?.product) {
              const serverMessage = extractResponseMessage(response);
              throw new Error(serverMessage ? `保存失败：${serverMessage}` : '保存失败，请稍后重试。');
            }
            for (const model of updatedProduct.models) {
              const payload = toSkuPayload(model, updatedProduct.tierPricing);
              const skuResponse = model.id
                ? await updateCatalogSku(updatedProduct.id, model.id, payload)
                : await createCatalogSku(updatedProduct.id, payload);
              if (!((model.id && skuResponse.status === 200) || (!model.id && skuResponse.status === 201))) {
                const serverMessage = extractResponseMessage(skuResponse);
                throw new Error(serverMessage ? `型号保存失败：${serverMessage}` : '型号保存失败，请稍后重试。');
              }
            }
            await refreshBackendProducts();
            closeProductEditor();
            showToast('保存成功。');
            return;
          }

          const nextProduct = cloneProduct(updatedProduct);
          setProducts((current) => {
            const nextProducts = current.map((item) => (item.id === updatedProduct.id ? nextProduct : item));
            writeStoredJson(MOCK_PRODUCTS_STORAGE_KEY, nextProducts);
            return nextProducts;
          });
          closeProductEditor();
          showToast('保存成功。');
        }}
        open={Boolean(editingProductId)}
        product={editingProduct}
        uploadImage={context?.mode === 'dev' ? uploadBackendCatalogProductImage : undefined}
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
            await refreshBackendCategories();
          } else {
            persistCategories(
              insertCategoryAtPosition(categories, {
                id: `LOCAL-CAT-${Date.now()}`,
                name: item.name,
                sort: item.sort,
                parentId: item.parentId || null
              }),
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
            await refreshBackendCategories();
          } else {
            const nextCategories = removeCategoryAndCompact(
              categories.map((item) => (item.parentId === categoryId ? { ...item, parentId: null } : item)),
              categoryId
            );
            persistCategories(nextCategories, true);
          }
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
            await refreshBackendCategories();
          } else {
            persistCategories(moveCategoryToPosition(categories, { ...item, name: item.name.trim() }), true);
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
