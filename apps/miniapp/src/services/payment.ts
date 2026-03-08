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
import {
  applyPaymentSessionToOrder,
  buildMockPaymentSession,
  loadIsolatedMockState,
  type MockPaymentSession,
  nowIso,
  updateIsolatedMockState
} from './mock/runtime'

const createMockPaymentServices = (): PaymentServices => {
  const loadSession = async (paymentId: string): Promise<MockPaymentSession> => {
    const state = await loadIsolatedMockState()
    const session = Object.values(state.paymentSessionsByOrderId).find((item) => item.id === paymentId)
    if (session) {
      return session
    }

    const order = state.orders.find((item) => item.latestPaymentId === paymentId)
    if (!order) {
      throw new Error(`payment not found: ${paymentId}`)
    }

    return buildMockPaymentSession(order.id, {
      paymentId,
      channel: order.paymentChannel === 'alipay' ? 'alipay' : 'wechat',
      status: String(order.paymentStatus || order.status || 'PAY_PENDING').toUpperCase(),
      paidAt: order.paidAt ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    })
  }

  const saveSession = async (
    orderId: string,
    build: (existing: MockPaymentSession | null) => MockPaymentSession
  ): Promise<MockPaymentSession> => {
    let created: MockPaymentSession | null = null
    await updateIsolatedMockState((state) => {
      const order = state.orders.find((item) => item.id === orderId)
      if (!order) {
        throw new Error(`order not found: ${orderId}`)
      }
      const existing = state.paymentSessionsByOrderId[orderId] ?? null
      created = build(existing)
      const nextOrder = applyPaymentSessionToOrder(order, created)

      return {
        ...state,
        orders: state.orders.map((item) => item.id === orderId ? nextOrder : item),
        paymentSessionsByOrderId: {
          ...state.paymentSessionsByOrderId,
          [orderId]: created
        }
      }
    })

    if (!created) {
      throw new Error(`payment not created: ${orderId}`)
    }
    return created
  }

  return {
    sessions: {
      createForOrder: async (orderId, options) => {
        return saveSession(orderId, (existing) => {
          const timestamp = nowIso()
          return buildMockPaymentSession(orderId, {
            paymentId: existing?.id ?? `pay_mock_${orderId}`,
            channel: options?.channel ?? existing?.channel,
            status: existing?.status === 'PAID' ? 'PAID' : 'PAY_PENDING',
            paidAt: existing?.status === 'PAID' ? (existing.paidAt ?? timestamp) : null,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp
          })
        })
      },
      get: async (paymentId) => loadSession(paymentId),
      recheck: async (paymentId) => {
        const session = await loadSession(paymentId)
        return saveSession(session.orderId, (existing) => buildMockPaymentSession(session.orderId, {
          paymentId: existing?.id ?? session.id,
          channel: existing?.channel ?? session.channel,
          status: existing?.status ?? session.status,
          paidAt: existing?.paidAt ?? session.paidAt,
          createdAt: existing?.createdAt ?? session.createdAt,
          updatedAt: existing?.updatedAt ?? session.updatedAt ?? nowIso()
        }))
      },
      payForOrder: async (orderId, options) => {
        return saveSession(orderId, (existing) => {
          const timestamp = nowIso()
          return buildMockPaymentSession(orderId, {
            paymentId: existing?.id ?? `pay_mock_${orderId}`,
            channel: options?.channel ?? existing?.channel,
            status: 'PAID',
            paidAt: timestamp,
            createdAt: existing?.createdAt ?? timestamp,
            updatedAt: timestamp
          })
        })
      }
    },
    tokens: {
      getToken: async () => runtimeEnv.paymentDevToken ?? null,
      setToken: async () => {}
    }
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
      payForOrder: async (orderId, options) => buildMockPaymentSession(orderId, {
        paymentId: buildDevFakePaymentId(orderId),
        channel: options?.channel,
        status: 'PAID'
      }),
      recheck: async (paymentId) => {
        if (isDevFakePaymentId(paymentId)) {
          const orderId = paymentId.slice('pay_dev_fake_'.length)
          return buildMockPaymentSession(orderId, {
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
