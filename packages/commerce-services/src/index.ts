import { setApiClientConfig, type ApiClientConfig } from '@tmo/api-client'

import { defaultTokenStorageKey, legacyTokenStorageKey, resolveBaseUrl, resolveDevToken, type CommerceServicesConfig } from './config'
import { createOrderIdempotency } from './idempotency'
import { createRequester } from './requester'
import { createTokenStore, type TokenStore } from './token'
import { chooseExcelFile, createUploadClient } from './uploads'
import { createCartService, type CartService } from './services/cart'
import { createCatalogService, type CatalogService } from './services/catalog'
import { createWishlistService, type WishlistService } from './services/wishlist'
import { createOrdersService, type OrdersService } from './services/orders'
import { createProductRequestService, type ProductRequestService } from './services/product-requests'
import { createAfterSalesService, type AfterSalesService } from './services/after-sales'
import { createInquiryService, type InquiryService } from './services/inquiries'
import { createTrackingService, type TrackingService } from './services/tracking'

export interface CommerceServices {
  catalog: CatalogService
  cart: CartService
  orders: OrdersService
  tracking: TrackingService
  wishlist: WishlistService
  productRequests: ProductRequestService
  afterSales: AfterSalesService
  inquiries: InquiryService
  tokens: TokenStore
  files: {
    chooseExcelFile: typeof chooseExcelFile
  }
}

const assertBaseUrl = (baseUrl: string): string => {
  const value = baseUrl.trim()
  if (value) {
    return value
  }
  throw new Error(
    '[commerce-services] baseUrl is required. Pass config.baseUrl or set TARO_APP_API_BASE_URL/TARO_APP_COMMERCE_BASE_URL.'
  )
}

export const createCommerceServices = (config: CommerceServicesConfig = {}): CommerceServices => {
  const baseUrl = assertBaseUrl(resolveBaseUrl(config.baseUrl))
  const devToken = resolveDevToken(config.devToken)
  const tokenKey = config.tokenStorageKey ?? defaultTokenStorageKey

  const tokens = createTokenStore(tokenKey, devToken, legacyTokenStorageKey)
  const requester = config.requester ?? createRequester({
    getToken: tokens.getToken,
    timeoutMs: config.timeoutMs
  })

  const apiClientConfig: ApiClientConfig = {
    baseUrl,
    requester
  }
  setApiClientConfig(apiClientConfig)

  const uploadClient = createUploadClient({
    baseUrl,
    getAuthHeaders: async () => {
      const token = await tokens.getToken()
      const headers: Record<string, string> = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
      return headers
    },
    timeoutMs: config.uploadTimeoutMs
  })

  const idempotency = createOrderIdempotency()

  return {
    catalog: createCatalogService(),
    cart: createCartService(uploadClient),
    orders: createOrdersService(idempotency),
    tracking: createTrackingService(uploadClient),
    wishlist: createWishlistService(),
    productRequests: createProductRequestService(),
    afterSales: createAfterSalesService(),
    inquiries: createInquiryService(),
    tokens,
    files: {
      chooseExcelFile
    }
  }
}

export type { CommerceServicesConfig }
export { ApiError, isApiError } from './errors'
export type { ApiClientRequester } from '@tmo/api-client'
