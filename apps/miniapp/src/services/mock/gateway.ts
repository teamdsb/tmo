import type { GatewayServices } from '@tmo/gateway-services'
import { runtimeEnv } from '../../config/runtime-env'
import {
  buildIsolatedMockBootstrap,
  createIsolatedTokenStore
} from './runtime'

export const createMockGatewayServices = (): GatewayServices => {
  const tokens = createIsolatedTokenStore(runtimeEnv.gatewayDevToken)
  return {
    bootstrap: {
      get: async () => {
        const token = await tokens.getToken()
        return buildIsolatedMockBootstrap(token)
      }
    },
    tokens
  }
}
