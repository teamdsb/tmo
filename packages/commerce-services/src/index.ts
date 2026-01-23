import { setApiClientConfig, type ApiClientConfig } from '@tmo/api-client'

import { defaultTokenStorageKey, resolveBaseUrl, resolveDevToken, type CommerceServicesConfig } from './config'
import { createOrderIdempotency } from './idempotency'
import { createRequester } from './requester'
import { createTokenStore, type TokenStore } from './token'
import { chooseExcelFile, createUploadClient } from './uploads'
import { createCartService, type CartService } from './services/cart'
import { createCatalogService, type CatalogService } from './services/catalog'
import { createOrdersService, type OrdersService } from './services/orders'
import { createTrackingService, type TrackingService } from './services/tracking'

export interface CommerceServices {
  catalog: CatalogService
  cart: CartService
  orders: OrdersService
  tracking: TrackingService
  tokens: TokenStore
  files: {
    chooseExcelFile: typeof chooseExcelFile
  }
}

export const createCommerceServices = (config: CommerceServicesConfig = {}): CommerceServices => {
  const baseUrl = resolveBaseUrl(config.baseUrl)
  const devToken = resolveDevToken(config.devToken)
  const tokenKey = config.tokenStorageKey ?? defaultTokenStorageKey

  const tokens = createTokenStore(tokenKey, devToken)
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
    tokens,
    files: {
      chooseExcelFile
    }
  }
}

export type { CommerceServicesConfig }
export { ApiError, isApiError } from './errors'
export type { ApiClientRequester } from '@tmo/api-client'
