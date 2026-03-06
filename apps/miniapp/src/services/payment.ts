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

const createMockPaymentServices = (): PaymentServices => {
  const now = new Date().toISOString()

  return {
    sessions: {
      createForOrder: async (orderId, options) => ({
        id: `pay_mock_${orderId}`,
        orderId,
        channel: options?.channel ?? 'wechat',
        status: 'PAY_PENDING',
        amountFen: 0,
        currency: 'CNY',
        createdAt: now,
        updatedAt: now
      }),
      get: async (paymentId) => ({
        id: paymentId,
        orderId: 'mock-order',
        channel: 'wechat',
        status: 'PAY_PENDING',
        amountFen: 0,
        currency: 'CNY',
        createdAt: now,
        updatedAt: now
      }),
      recheck: async (paymentId) => ({
        id: paymentId,
        orderId: 'mock-order',
        channel: 'wechat',
        status: 'PAID',
        amountFen: 0,
        currency: 'CNY',
        paidAt: now,
        createdAt: now,
        updatedAt: now
      }),
      payForOrder: async (orderId, options) => ({
        id: `pay_mock_${orderId}`,
        orderId,
        channel: options?.channel ?? 'wechat',
        status: 'PAID',
        amountFen: 0,
        currency: 'CNY',
        paidAt: now,
        createdAt: now,
        updatedAt: now
      })
    },
    tokens: {
      getToken: async () => runtimeEnv.paymentDevToken ?? null,
      setToken: async () => {}
    }
  }
}

const createPaymentServicesRuntime = (): PaymentServices => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockPaymentServices()
  }

  return createPaymentServices({
    baseUrl: requirePaymentBaseUrl(),
    devToken: runtimeEnv.paymentDevToken
  })
}

export const paymentServices = createPaymentServicesRuntime()

export type { PaymentChannel, PaymentSession }
export { ApiError, isApiError, isPaymentCancelled, PaymentCancelledError }
