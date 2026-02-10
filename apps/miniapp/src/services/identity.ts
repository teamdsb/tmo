import { createIdentityServices } from '@tmo/identity-services'
import { resolveApiBaseUrl } from './api-base-url'

export const identityServices = createIdentityServices({
  baseUrl: resolveApiBaseUrl()
})
