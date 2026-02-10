import {
  getBffBootstrap,
  setGatewayApiClientConfig,
  type ApiClientConfig,
  type ApiClientRequester,
  type BootstrapResponse
} from '@tmo/gateway-api-client'

import { ApiError, isApiError } from './errors'
import { createRequester } from './requester'
import { createTokenStore, type TokenStore } from './token'
import {
  defaultTokenStorageKey,
  legacyTokenStorageKey,
  resolveBaseUrl,
  resolveDevToken,
  type GatewayServicesConfig
} from './config'

export interface GatewayServices {
  bootstrap: {
    get: () => Promise<BootstrapResponse>
  }
  tokens: TokenStore
}

const assertBaseUrl = (baseUrl: string): string => {
  const value = baseUrl.trim()
  if (value) {
    return value
  }
  throw new Error(
    '[gateway-services] baseUrl is required. Pass config.baseUrl or set TARO_APP_API_BASE_URL/TARO_APP_GATEWAY_BASE_URL.'
  )
}

export const createGatewayServices = (config: GatewayServicesConfig = {}): GatewayServices => {
  const baseUrl = assertBaseUrl(resolveBaseUrl(config.baseUrl))
  const devToken = resolveDevToken(config.devToken)
  const tokenKey = config.tokenStorageKey ?? defaultTokenStorageKey

  const tokens = createTokenStore(tokenKey, devToken, legacyTokenStorageKey)
  const requester: ApiClientRequester = config.requester ?? createRequester({
    getToken: tokens.getToken,
    timeoutMs: config.timeoutMs
  })

  const apiClientConfig: ApiClientConfig = {
    baseUrl,
    requester
  }
  setGatewayApiClientConfig(apiClientConfig)

  const bootstrap = {
    get: async (): Promise<BootstrapResponse> => {
      const response = await getBffBootstrap()
      if (response.status !== 200) {
        throw new ApiError('failed to bootstrap', response.status)
      }
      return response.data
    }
  }

  return {
    bootstrap,
    tokens
  }
}

export type { GatewayServicesConfig }
export { ApiError, isApiError }
