import type { CartImportPendingItem, Sku } from '@tmo/api-client'
import { matchPriceTier } from '../../utils/price-tier'
import type { CartItem, MatchTypeBadge, ProductNameMap } from './types'

export const MATCH_TYPE_BADGES: Record<string, MatchTypeBadge> = {
  AMBIGUOUS: { label: '匹配不确定', className: 'bg-amber-50 text-amber-600' },
  NOT_FOUND: { label: '未找到', className: 'bg-red-50 text-red-600' }
}

export const QUICK_CART_QTY_OPTIONS = [1, 2, 5, 10]

export const formatPendingMeta = (item: CartImportPendingItem) => {
  const parts = [
    item.rawSpec?.trim() || null,
    item.rawQty ? `数量 ${item.rawQty}` : null,
    `行 ${item.rowNo}`
  ].filter(Boolean)
  return parts.join(' • ')
}

export const formatCartItemMeta = (item: CartItem) => {
  const parts = [
    item.sku.spec?.trim() || null,
    item.sku.skuCode ? `SKU ${item.sku.skuCode}` : null
  ].filter(Boolean)
  return parts.join(' • ')
}

export const formatFen = (fen: number): string => `¥${(fen / 100).toFixed(2)}`

export const getCartItemUnitPriceFen = (item: CartItem): number | null => {
  const tier = matchPriceTier(item.sku.priceTiers, item.qty)
  return typeof tier?.unitPriceFen === 'number' ? tier.unitPriceFen : null
}

export const formatCartItemPrice = (item: CartItem): string => {
  const unitPriceFen = getCartItemUnitPriceFen(item)
  if (unitPriceFen === null) {
    return '询价'
  }
  return formatFen(unitPriceFen)
}

export const normalizeSpuId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

export const getSkuLabel = (sku: Sku): string => {
  const spec = sku.spec?.trim()
  if (spec) {
    return spec
  }
  const name = sku.name?.trim()
  if (name) {
    return name
  }
  return sku.id
}

export const getCartItemTitle = (item: CartItem, productNameBySpuId: ProductNameMap): string => {
  const spuId = normalizeSpuId(item.sku.spuId)
  const productName = spuId ? productNameBySpuId[spuId] : undefined
  if (productName) {
    return productName
  }
  return item.sku.name
}
