import { isAlipay, isWeapp } from '@tmo/platform-adapter'
import type { PaymentChannel } from '@tmo/payment-services'

import { runtimeEnv } from '../config/runtime-env'
import { loadBootstrap } from './bootstrap'

export interface PaymentAvailability {
  available: boolean
  channel?: PaymentChannel
  unavailableMessage: string
}

export const buildOrderPaymentIdempotencyKey = (orderId: string): string => `order-payment-${orderId}`

export const resolvePaymentAvailability = async (): Promise<PaymentAvailability> => {
  const flags = (await loadBootstrap())?.featureFlags
  if (flags?.paymentEnabled !== true) {
    return unavailable('在线支付暂未开通，请等待销售确认。')
  }
  if (isWeapp()) {
    return flags.wechatPayEnabled === true
      ? available('wechat')
      : unavailable('微信支付暂未开通，请等待销售确认。')
  }
  if (isAlipay()) {
    return runtimeEnv.isIsolatedMock && flags.alipayPayEnabled === true
      ? available('alipay')
      : unavailable('支付宝支付尚未接入，请等待销售确认。')
  }
  return unavailable('当前平台暂不支持在线支付，请等待销售确认。')
}

const available = (channel: PaymentChannel): PaymentAvailability => ({ available: true, channel, unavailableMessage: '' })
const unavailable = (unavailableMessage: string): PaymentAvailability => ({ available: false, unavailableMessage })
