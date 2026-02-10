import { createIdentityServices } from '@tmo/identity-services'
import { requireIdentityBaseUrl, runtimeEnv } from '../config/runtime-env'

export const identityServices = createIdentityServices({
  baseUrl: requireIdentityBaseUrl(),
  devToken: runtimeEnv.identityDevToken
})
