import { getPlatform } from '@tmo/platform-adapter'
import { Platform } from '@tmo/shared/enums'
import type { PaymentChannel } from '@tmo/payment-services'

import { loadBootstrap } from './bootstrap'

export interface PaymentAvailability {
  available: boolean
  channel?: PaymentChannel
  unavailableMessage: string
}

export const buildOrderPaymentIdempotencyKey = (orderId: string): string => `order-payment-${orderId}`

export const resolvePaymentAvailability = async (): Promise<PaymentAvailability> => {
  const platform = getPlatform()
  const bootstrap = await loadBootstrap()
  const flags = bootstrap?.featureFlags

  if (flags?.paymentEnabled === false) {
    return unavailable('支付暂未开通，请等待销售确认。')
  }

  if (platform === Platform.Weapp) {
    if (flags?.wechatPayEnabled === false) {
      return unavailable('微信支付暂未开通，请等待销售确认。')
    }
    return available('wechat_b2b')
  }

  if (platform === Platform.Alipay) {
    if (flags?.alipayPayEnabled === false) {
      return unavailable('支付宝支付暂未开通，请等待销售确认。')
    }
    return available('alipay')
  }

  return unavailable('当前平台暂不支持在线支付，请等待销售确认。')
}

const available = (channel: PaymentChannel): PaymentAvailability => ({
  available: true,
  channel,
  unavailableMessage: ''
})

const unavailable = (unavailableMessage: string): PaymentAvailability => ({
  available: false,
  unavailableMessage
})
