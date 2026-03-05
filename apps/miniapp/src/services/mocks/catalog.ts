import type {
  Category,
  DisplayCategory,
  PriceTier,
  ProductDetail,
  ProductSummary,
  Sku
} from '@tmo/api-client'
import {
  buildCanonicalProductDetail,
  canonicalCategories,
  canonicalDisplayCategories,
  canonicalProductDetailsById,
  canonicalProducts,
  canonicalSkuById
} from '../../../../../packages/shared/src/mock-data/index.js'

const clonePriceTiers = (tiers: unknown): PriceTier[] => {
  if (!Array.isArray(tiers)) {
    return []
  }
  return tiers.map((tier) => ({
    minQty: Number((tier as PriceTier).minQty || 1),
    maxQty: (tier as PriceTier).maxQty ?? null,
    unitPriceFen: Number((tier as PriceTier).unitPriceFen || 0)
  }))
}

const cloneSku = (sku: Sku): Sku => ({
  id: sku.id,
  spuId: sku.spuId,
  skuCode: sku.skuCode,
  name: sku.name,
  spec: sku.spec,
  attributes: sku.attributes ? { ...sku.attributes } : undefined,
  priceTiers: clonePriceTiers(sku.priceTiers),
  unit: sku.unit,
  isActive: Boolean(sku.isActive)
})

const cloneDetail = (detail: ProductDetail): ProductDetail => ({
  product: {
    id: detail.product.id,
    name: detail.product.name,
    categoryId: detail.product.categoryId,
    description: detail.product.description,
    images: Array.isArray(detail.product.images) ? [...detail.product.images] : [],
    filterDimensions: Array.isArray(detail.product.filterDimensions)
      ? [...detail.product.filterDimensions]
      : undefined
  },
  skus: Array.isArray(detail.skus) ? detail.skus.map((sku) => cloneSku(sku)) : []
})

const toCategory = (item: any): Category => ({
  id: String(item?.id || ''),
  name: String(item?.name || ''),
  parentId: item?.parentId ?? null,
  sort: Number(item?.sort || 0)
})

const toDisplayCategory = (item: any): DisplayCategory => ({
  id: String(item?.id || ''),
  name: String(item?.name || ''),
  iconKey: String(item?.iconKey || 'apps') as DisplayCategory['iconKey'],
  sort: Number(item?.sort || 0),
  enabled: Boolean(item?.enabled)
})

const toProductSummary = (item: any): ProductSummary => ({
  id: String(item?.id || ''),
  name: String(item?.name || ''),
  categoryId: String(item?.categoryId || ''),
  tags: Array.isArray(item?.tags) ? [...item.tags] : [],
  coverImageUrl: item?.coverImageUrl ? String(item.coverImageUrl) : undefined
})

const toDetailMap = (): Record<string, ProductDetail> => {
  const entries = Object.entries(canonicalProductDetailsById as Record<string, ProductDetail>)
  return entries.reduce<Record<string, ProductDetail>>((acc, [spuId, detail]) => {
    acc[spuId] = cloneDetail(detail)
    return acc
  }, {})
}

const toSkuMap = (): Record<string, Sku> => {
  const entries = Object.entries(canonicalSkuById as Record<string, Sku>)
  return entries.reduce<Record<string, Sku>>((acc, [skuId, sku]) => {
    acc[skuId] = cloneSku(sku)
    return acc
  }, {})
}

export const mockCategories: Category[] = (canonicalCategories as any[]).map((item) => toCategory(item))

export const mockDisplayCategories: DisplayCategory[] = (canonicalDisplayCategories as any[]).map((item) =>
  toDisplayCategory(item)
)

export const mockProducts: ProductSummary[] = (canonicalProducts as any[]).map((item) => toProductSummary(item))

export const mockProductDetails: Record<string, ProductDetail> = toDetailMap()

export const mockSkusById: Record<string, Sku> = toSkuMap()

export const findMockSkuById = (skuId: string): Sku | null => {
  const found = mockSkusById[skuId]
  if (!found) {
    return null
  }
  return cloneSku(found)
}

export const buildMockProductDetail = (spuId: string): ProductDetail | null => {
  const fromMap = mockProductDetails[spuId]
  if (fromMap) {
    return cloneDetail(fromMap)
  }

  const fallback = buildCanonicalProductDetail(spuId) as ProductDetail | null
  if (!fallback) {
    return null
  }

  return cloneDetail(fallback)
}
