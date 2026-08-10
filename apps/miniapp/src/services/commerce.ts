import { createCommerceServices, type CommerceServices } from '@tmo/commerce-services'
import { requireCommerceBaseUrl, runtimeEnv } from '../config/runtime-env'
import { recoverUnauthorizedSession } from './auth-recovery'
import { createMockCommerceServices } from './mock/commerce'

const createCommerceServicesRuntime = (): CommerceServices => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockCommerceServices()
  }

  return createCommerceServices({
    baseUrl: requireCommerceBaseUrl(),
    devToken: runtimeEnv.commerceDevToken,
    timeoutMs: 10_000,
    onUnauthorized: recoverUnauthorizedSession
  })
}

export const commerceServices = createCommerceServicesRuntime()
