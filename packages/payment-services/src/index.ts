import { getPlatform, pay as platformPay } from '@tmo/platform-adapter'
import { Platform } from '@tmo/shared/enums'
import {
  getPaymentsPaymentId,
  postPaymentsAlipayCreate,
  postPaymentsPaymentIdRecheck,
  postPaymentsWechatCreate,
  setPaymentApiClientConfig,
  type AlipayPayCreateResponse,
  type ApiClientConfig,
  type ApiClientRequester,
  type PaymentDetail,
  type WechatPayCreateResponse
} from '@tmo/payment-api-client'

import {
  defaultTokenStorageKey,
  legacyTokenStorageKey,
  resolveBaseUrl,
  resolveDevToken,
  type PaymentServicesConfig
} from './config'
import { ApiError, isApiError, isPaymentCancelled, PaymentCancelledError } from './errors'
import { createRequester } from './requester'
import { createTokenStore, type TokenStore } from './token'

export type PaymentChannel = 'wechat' | 'alipay'

export interface PaymentSession {
  id: string
  orderId: string
  channel: PaymentChannel
  status: string
  amountFen?: number
  currency?: string
  createdAt?: string
  updatedAt?: string
  paidAt?: string | null
  expiresAt?: string
  prepayId?: string
  package?: string
  nonceStr?: string
  timeStamp?: string
  signType?: string
  paySign?: string
  tradeNo?: string
  payParams?: Record<string, unknown>
  providerTradeNo?: string | null
  providerPrepayId?: string | null
  failureCode?: string | null
  failureMessage?: string | null
}

export interface PaymentServices {
  sessions: {
    createForOrder: (orderId: string, options?: { channel?: PaymentChannel; idempotencyKey?: string }) => Promise<PaymentSession>
    get: (paymentId: string) => Promise<PaymentSession>
    recheck: (paymentId: string) => Promise<PaymentSession>
    payForOrder: (orderId: string, options?: { channel?: PaymentChannel; idempotencyKey?: string }) => Promise<PaymentSession>
  }
  tokens: TokenStore
}

const assertBaseUrl = (baseUrl: string): string => {
  const value = baseUrl.trim()
  if (value) {
    return value
  }
  throw new Error(
    '[payment-services] baseUrl is required. Pass config.baseUrl or set TARO_APP_API_BASE_URL/TARO_APP_PAYMENT_BASE_URL.'
  )
}

const generateIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `payment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

const detectPaymentChannel = (): PaymentChannel => {
  switch (getPlatform()) {
    case Platform.Weapp:
      return 'wechat'
    case Platform.Alipay:
      return 'alipay'
    default:
      throw new Error('payment is not supported on this platform')
  }
}

const toApiChannel = (channel: PaymentChannel): 'WECHAT' | 'ALIPAY' => {
  return channel === 'wechat' ? 'WECHAT' : 'ALIPAY'
}

const normalizeChannel = (channel: string): PaymentChannel => {
  return String(channel).toUpperCase() === 'ALIPAY' ? 'alipay' : 'wechat'
}

const normalizePaymentSession = (
  session: PaymentDetail | WechatPayCreateResponse | AlipayPayCreateResponse
): PaymentSession => {
  if ('paymentId' in session) {
    return {
      id: session.paymentId,
      orderId: session.orderId,
      channel: normalizeChannel(session.channel),
      status: session.status,
      expiresAt: session.expiresAt,
      prepayId: 'prepayId' in session ? session.prepayId : undefined,
      package: 'package' in session ? session.package : undefined,
      nonceStr: 'nonceStr' in session ? session.nonceStr : undefined,
      timeStamp: 'timeStamp' in session ? session.timeStamp : undefined,
      signType: 'signType' in session ? session.signType : undefined,
      paySign: 'paySign' in session ? session.paySign : undefined,
      tradeNo: 'tradeNo' in session ? session.tradeNo : undefined,
      payParams: 'payParams' in session ? session.payParams : undefined
    }
  }

  return {
    id: session.id,
    orderId: session.orderId,
    channel: normalizeChannel(session.channel),
    status: session.status,
    amountFen: session.amountFen,
    currency: session.currency,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    paidAt: session.paidAt ?? null,
    providerTradeNo: session.providerTradeNo ?? null,
    providerPrepayId: session.providerPrepayId ?? null,
    failureCode: session.failureCode ?? null,
    failureMessage: session.failureMessage ?? null
  }
}

const toPlatformPayload = (session: PaymentSession): Record<string, unknown> => {
  if (session.channel === 'wechat') {
    return {
      timeStamp: session.timeStamp,
      nonceStr: session.nonceStr,
      package: session.package,
      signType: session.signType ?? 'RSA',
      paySign: session.paySign
    }
  }

  if (session.payParams && Object.keys(session.payParams).length > 0) {
    return session.payParams
  }

  return {
    tradeNO: session.tradeNo
  }
}

const isCancelError = (error: unknown): boolean => {
  if (isPaymentCancelled(error)) {
    return true
  }
  if (!error || typeof error !== 'object') {
    return false
  }

  const message = String(
    (error as { errMsg?: string; errorMessage?: string; message?: string }).errMsg
    ?? (error as { errorMessage?: string }).errorMessage
    ?? (error as { message?: string }).message
    ?? ''
  ).toLowerCase()

  const code = String(
    (error as { resultCode?: string; code?: string }).resultCode
    ?? (error as { code?: string }).code
    ?? ''
  ).toLowerCase()

  return message.includes('cancel') || message.includes('取消') || code === '6001'
}

const unwrapPaymentResponse = <T>(response: { status: number; data: unknown }): T => {
  if (response.status >= 200 && response.status < 300) {
    return response.data as T
  }

  const payload = (response.data ?? {}) as {
    code?: string
    message?: string
    requestId?: string
    details?: Record<string, unknown> | null
  }

  throw new ApiError(payload.message ?? 'payment request failed', response.status, {
    code: payload.code,
    requestId: payload.requestId,
    details: payload.details,
    raw: response.data
  })
}

export const createPaymentServices = (config: PaymentServicesConfig = {}): PaymentServices => {
  const baseUrl = assertBaseUrl(resolveBaseUrl(config.baseUrl))
  const devToken = resolveDevToken(config.devToken)
  const tokenKey = config.tokenStorageKey ?? defaultTokenStorageKey

  const tokens = createTokenStore(tokenKey, devToken, legacyTokenStorageKey)
  const requester: ApiClientRequester = config.requester ?? createRequester({
    getToken: tokens.getToken,
    timeoutMs: config.timeoutMs
  })

  const apiClientConfig: ApiClientConfig = {
    baseUrl,
    requester
  }
  setPaymentApiClientConfig(apiClientConfig)

  const createSession = async (
    orderId: string,
    options?: { channel?: PaymentChannel; idempotencyKey?: string }
  ): Promise<PaymentSession> => {
    const channel = options?.channel ?? detectPaymentChannel()
    const idempotencyKey = options?.idempotencyKey ?? generateIdempotencyKey()
    const requestOptions: RequestInit = {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    }

    const response = toApiChannel(channel) === 'WECHAT'
      ? await postPaymentsWechatCreate({ orderId }, requestOptions)
      : await postPaymentsAlipayCreate({ orderId }, requestOptions)

    return normalizePaymentSession(unwrapPaymentResponse<WechatPayCreateResponse | AlipayPayCreateResponse>(response))
  }

  return {
    sessions: {
      createForOrder: createSession,
      get: async (paymentId: string): Promise<PaymentSession> => {
        const response = await getPaymentsPaymentId(paymentId)
        return normalizePaymentSession(unwrapPaymentResponse<PaymentDetail>(response))
      },
      recheck: async (paymentId: string): Promise<PaymentSession> => {
        const response = await postPaymentsPaymentIdRecheck(paymentId)
        return normalizePaymentSession(unwrapPaymentResponse<PaymentDetail>(response))
      },
      payForOrder: async (orderId: string, options?: { channel?: PaymentChannel; idempotencyKey?: string }): Promise<PaymentSession> => {
        const session = await createSession(orderId, options)
        try {
          await platformPay({
            payload: toPlatformPayload(session)
          })
        } catch (error) {
          if (isCancelError(error)) {
            throw new PaymentCancelledError('payment cancelled', error)
          }
          throw error
        }

        return postPaymentsPaymentIdRecheck(session.id).then((response) =>
          normalizePaymentSession(unwrapPaymentResponse<PaymentDetail>(response))
        )
      }
    },
    tokens
  }
}

export type { PaymentServicesConfig }
export { ApiError, isApiError, isPaymentCancelled, PaymentCancelledError }
