import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProductDetail, Sku } from '@tmo/api-client'
import { commerceServices } from '../../services/commerce'
import { normalizeSpuId } from './helpers'
import type { CartItem, ProductImageMap, ProductNameMap, SkuOptionsMap } from './types'

type UseCartProductDetailsResult = {
  productImageBySpuId: ProductImageMap
  productNameBySpuId: ProductNameMap
  loadSkuOptions: (spuId: string) => Promise<Sku[]>
}

export function useCartProductDetails(cartItems: CartItem[], enabled: boolean): UseCartProductDetailsResult {
  const [productNameBySpuId, setProductNameBySpuId] = useState<ProductNameMap>({})
  const [productImageBySpuId, setProductImageBySpuId] = useState<ProductImageMap>({})
  const [skuOptionsBySpuId, setSkuOptionsBySpuId] = useState<SkuOptionsMap>({})
  const productNameBySpuIdRef = useRef<ProductNameMap>({})
  const skuOptionsBySpuIdRef = useRef<SkuOptionsMap>({})
  const spuDetailRequestByIdRef = useRef<Partial<Record<string, Promise<ProductDetail | null>>>>({})

  useEffect(() => {
    productNameBySpuIdRef.current = productNameBySpuId
  }, [productNameBySpuId])

  useEffect(() => {
    skuOptionsBySpuIdRef.current = skuOptionsBySpuId
  }, [skuOptionsBySpuId])

  const cacheSpuDetail = useCallback((spuId: string, detail: ProductDetail): void => {
    const productName = detail.product?.name?.trim()
    if (productName) {
      setProductNameBySpuId((prev) => {
        if (prev[spuId] === productName) {
          return prev
        }
        const next = { ...prev, [spuId]: productName }
        productNameBySpuIdRef.current = next
        return next
      })
    }

    const productImage = detail.product?.images?.find((image) => typeof image === 'string' && image.trim())?.trim()
    if (productImage) {
      setProductImageBySpuId((prev) => {
        if (prev[spuId] === productImage) {
          return prev
        }
        return { ...prev, [spuId]: productImage }
      })
    }

    const nextSkus = Array.isArray(detail.skus) ? detail.skus : []
    if (nextSkus.length > 0) {
      setSkuOptionsBySpuId((prev) => {
        const current = prev[spuId] ?? []
        if (current.length === nextSkus.length && current.every((sku, index) => sku.id === nextSkus[index]?.id)) {
          return prev
        }
        const next = { ...prev, [spuId]: nextSkus }
        skuOptionsBySpuIdRef.current = next
        return next
      })
    }
  }, [])

  const fetchSpuDetail = useCallback(async (spuId: string): Promise<ProductDetail | null> => {
    const normalizedSpuId = normalizeSpuId(spuId)
    if (!normalizedSpuId) {
      return null
    }

    const inflightRequest = spuDetailRequestByIdRef.current[normalizedSpuId]
    if (inflightRequest) {
      return inflightRequest
    }

    const task = (async () => {
      try {
        const detail = await commerceServices.catalog.getProductDetail(normalizedSpuId)
        cacheSpuDetail(normalizedSpuId, detail)
        return detail
      } catch (error) {
        console.warn('load cart product detail failed', error)
        return null
      } finally {
        delete spuDetailRequestByIdRef.current[normalizedSpuId]
      }
    })()

    spuDetailRequestByIdRef.current[normalizedSpuId] = task
    return task
  }, [cacheSpuDetail])

  const hydrateProductNames = useCallback(async (items: CartItem[]) => {
    const spuIds = Array.from(new Set(
      items
        .map((item) => normalizeSpuId(item.sku.spuId))
        .filter((spuId): spuId is string => spuId.length > 0)
    ))
    const missingSpuIds = spuIds.filter((spuId) => !productNameBySpuIdRef.current[spuId])
    if (missingSpuIds.length === 0) {
      return
    }
    await Promise.all(missingSpuIds.map((spuId) => fetchSpuDetail(spuId)))
  }, [fetchSpuDetail])

  useEffect(() => {
    if (!enabled || cartItems.length === 0) {
      return
    }
    void hydrateProductNames(cartItems)
  }, [cartItems, enabled, hydrateProductNames])

  const loadSkuOptions = useCallback(async (spuId: string): Promise<Sku[]> => {
    const normalizedSpuId = normalizeSpuId(spuId)
    if (!normalizedSpuId) {
      return []
    }
    const cached = skuOptionsBySpuIdRef.current[normalizedSpuId]
    if (cached && cached.length > 0) {
      return cached
    }
    const detail = await fetchSpuDetail(normalizedSpuId)
    if (!detail?.skus || detail.skus.length === 0) {
      return []
    }
    return detail.skus
  }, [fetchSpuDetail])

  return {
    productImageBySpuId,
    productNameBySpuId,
    loadSkuOptions
  }
}
