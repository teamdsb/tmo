import { createGatewayServices } from '@tmo/gateway-services'
import { requireGatewayBaseUrl, runtimeEnv } from '../config/runtime-env'
import { createMockGatewayServices } from './mock/gateway'

const createGatewayServicesRuntime = () => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockGatewayServices()
  }
  return createGatewayServices({
    baseUrl: requireGatewayBaseUrl(),
    devToken: runtimeEnv.gatewayDevToken
  })
}

export const gatewayServices = createGatewayServicesRuntime()
