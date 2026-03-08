import {
  ApiError,
  createPaymentServices,
  isApiError,
  isPaymentCancelled,
  PaymentCancelledError,
  type PaymentChannel,
  type PaymentSession,
  type PaymentServices
} from '@tmo/payment-services'

import { requirePaymentBaseUrl, runtimeEnv } from '../config/runtime-env'
import { buildDevFakePaymentId, isDevFakePaymentId } from './payment-dev-overrides'

const createMockPaymentServices = (): PaymentServices => {
  return {
    sessions: {
      createForOrder: async (orderId, options) => createMockPaymentSession(orderId, {
        channel: options?.channel,
        status: 'PAY_PENDING'
      }),
      get: async (paymentId) => createMockPaymentSession('mock-order', { paymentId, status: 'PAY_PENDING' }),
      recheck: async (paymentId) => createMockPaymentSession('mock-order', { paymentId, status: 'PAID' }),
      payForOrder: async (orderId, options) => createMockPaymentSession(orderId, {
        paymentId: `pay_mock_${orderId}`,
        channel: options?.channel,
        status: 'PAID'
      })
    },
    tokens: {
      getToken: async () => runtimeEnv.paymentDevToken ?? null,
      setToken: async () => {}
    }
  }
}

const createMockPaymentSession = (
  orderId: string,
  options?: {
    paymentId?: string
    channel?: PaymentChannel
    status?: PaymentSession['status']
  }
): PaymentSession => {
  const now = new Date().toISOString()
  const status = options?.status ?? 'PAY_PENDING'
  return {
    id: options?.paymentId ?? `pay_mock_${orderId}`,
    orderId,
    channel: options?.channel ?? 'wechat',
    status,
    amountFen: 0,
    currency: 'CNY',
    paidAt: status === 'PAID' ? now : undefined,
    createdAt: now,
    updatedAt: now
  }
}

const createDevFakePaymentServices = (): PaymentServices => {
  const realServices = createPaymentServices({
    baseUrl: requirePaymentBaseUrl(),
    devToken: runtimeEnv.paymentDevToken
  })

  return {
    ...realServices,
    sessions: {
      ...realServices.sessions,
      payForOrder: async (orderId, options) => createMockPaymentSession(orderId, {
        paymentId: buildDevFakePaymentId(orderId),
        channel: options?.channel,
        status: 'PAID'
      }),
      recheck: async (paymentId) => {
        if (isDevFakePaymentId(paymentId)) {
          const orderId = paymentId.slice('pay_dev_fake_'.length)
          return createMockPaymentSession(orderId, {
            paymentId,
            status: 'PAID'
          })
        }
        return realServices.sessions.recheck(paymentId)
      }
    }
  }
}

const createPaymentServicesRuntime = (): PaymentServices => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockPaymentServices()
  }

  if (runtimeEnv.devFakePaymentEnabled) {
    return createDevFakePaymentServices()
  }

  return createPaymentServices({
    baseUrl: requirePaymentBaseUrl(),
    devToken: runtimeEnv.paymentDevToken
  })
}

export const paymentServices = createPaymentServicesRuntime()

export type { PaymentChannel, PaymentSession }
export { ApiError, isApiError, isPaymentCancelled, PaymentCancelledError }
