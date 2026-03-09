import { useEffect, useState } from 'react'
import type { ProductDetail, ProductSummary, Sku } from '@tmo/api-client'
import { commerceServices } from '../services/commerce'

const formatFen = (fen: number) => `¥${(fen / 100).toFixed(2)}`

const getStartingPriceFen = (skus: Sku[] | undefined): number | null => {
  if (!Array.isArray(skus) || skus.length === 0) {
    return null
  }

  return skus.reduce<number | null>((currentMin, sku) => {
    if (!Array.isArray(sku.priceTiers) || sku.priceTiers.length === 0) {
      return currentMin
    }

    const skuMin = sku.priceTiers.reduce<number | null>((tierMin, tier) => {
      if (!Number.isFinite(tier.unitPriceFen)) {
        return tierMin
      }
      if (tierMin === null) {
        return tier.unitPriceFen
      }
      return Math.min(tierMin, tier.unitPriceFen)
    }, null)

    if (skuMin === null) {
      return currentMin
    }
    if (currentMin === null) {
      return skuMin
    }
    return Math.min(currentMin, skuMin)
  }, null)
}

export const formatProductStartingPriceLabel = (detail: ProductDetail | null | undefined): string => {
  const minPriceFen = getStartingPriceFen(detail?.skus)
  if (minPriceFen === null) {
    return '询价'
  }
  return `${formatFen(minPriceFen)} 起`
}

export const useProductStartingPrices = (products: ProductSummary[]) => {
  const [priceMap, setPriceMap] = useState<Record<string, string>>({})

  useEffect(() => {
    const ids = Array.from(new Set(products.map((item) => item.id).filter(Boolean)))
    if (ids.length === 0) {
      setPriceMap({})
      return
    }

    let cancelled = false

    void (async () => {
      const entries = await Promise.all(ids.map(async (id) => {
        try {
          const detail = await commerceServices.catalog.getProductDetail(id)
          return [id, formatProductStartingPriceLabel(detail)] as const
        } catch (error) {
          console.warn('load product starting price failed', id, error)
          return [id, '询价'] as const
        }
      }))

      if (!cancelled) {
        setPriceMap(Object.fromEntries(entries))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [products])

  return priceMap
}
