import { createGatewayServices } from '@tmo/gateway-services'
import { requireGatewayBaseUrl, runtimeEnv } from '../config/runtime-env'

export const gatewayServices = createGatewayServices({
  baseUrl: requireGatewayBaseUrl(),
  devToken: runtimeEnv.gatewayDevToken
})
