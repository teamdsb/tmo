import { createCommerceServices } from '@tmo/commerce-services'

export const commerceServices = createCommerceServices({
  baseUrl: process.env.TARO_APP_COMMERCE_BASE_URL ?? '',
  devToken: process.env.TARO_APP_COMMERCE_DEV_TOKEN
})
