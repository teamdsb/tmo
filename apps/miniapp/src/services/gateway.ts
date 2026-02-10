import { createGatewayServices } from '@tmo/gateway-services'
import { resolveApiBaseUrl } from './api-base-url'

export const gatewayServices = createGatewayServices({
  baseUrl: resolveApiBaseUrl()
})
