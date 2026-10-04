import type { Cart, Sku } from '@tmo/api-client'

export type CartItem = Cart['items'][number]

export type ProductNameMap = Record<string, string>

export type ProductImageMap = Record<string, string>

export type SkuOptionsMap = Record<string, Sku[]>
