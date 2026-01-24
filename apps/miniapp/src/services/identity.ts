import { createIdentityServices } from '@tmo/identity-services'

export const identityServices = createIdentityServices({
  baseUrl: process.env.TARO_APP_API_BASE_URL ?? '',
  devToken: process.env.TARO_APP_IDENTITY_DEV_TOKEN
})
