import { createIdentityServices } from '@tmo/identity-services'
import { requireIdentityBaseUrl, runtimeEnv } from '../config/runtime-env'
import { recoverUnauthorizedSession } from './auth-recovery'
import { createMockIdentityServices } from './mock/identity'

const createIdentityServicesRuntime = () => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockIdentityServices()
  }
  return createIdentityServices({
    baseUrl: requireIdentityBaseUrl(),
    devToken: runtimeEnv.identityDevToken,
    onUnauthorized: recoverUnauthorizedSession
  })
}

export const identityServices = createIdentityServicesRuntime()
