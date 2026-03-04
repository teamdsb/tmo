import { createCommerceServices, type CommerceServices } from '@tmo/commerce-services'
import { requireCommerceBaseUrl, runtimeEnv } from '../config/runtime-env'
import { createMockCommerceServices } from './mock/commerce'

const createCommerceServicesRuntime = (): CommerceServices => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockCommerceServices()
  }

  return createCommerceServices({
    baseUrl: requireCommerceBaseUrl(),
    devToken: runtimeEnv.commerceDevToken
  })
}

export const commerceServices = createCommerceServicesRuntime()
