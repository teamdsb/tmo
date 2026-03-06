import type { Cart, CartImportSelection, Sku } from '@tmo/api-client'

export type CartItem = Cart['items'][number]

export type SelectionMap = Record<number, CartImportSelection>

export type ProductNameMap = Record<string, string>

export type ProductImageMap = Record<string, string>

export type SkuOptionsMap = Record<string, Sku[]>

export type ImportTab = 'to-confirm' | 'confirmed'

export type MatchTypeBadge = {
  label: string
  className: string
}
