const mockSetPaymentApiClientConfig = jest.fn()
const mockPostPaymentsWechatCreate = jest.fn()
const mockPostPaymentsAlipayCreate = jest.fn()
const mockGetPaymentsPaymentId = jest.fn()
const mockPostPaymentsPaymentIdRecheck = jest.fn()
const mockGetPlatform = jest.fn()
const mockPay = jest.fn()
const mockGetStorage = jest.fn(async () => ({ data: null }))
const mockSetStorage = jest.fn(async () => {})
const mockRemoveStorage = jest.fn(async () => {})
const mockRequest = jest.fn()

jest.mock('@tmo/payment-api-client', () => ({
  setPaymentApiClientConfig: (config: unknown) => mockSetPaymentApiClientConfig(config),
  postPaymentsWechatCreate: (payload: unknown, options?: unknown) => mockPostPaymentsWechatCreate(payload, options),
  postPaymentsAlipayCreate: (payload: unknown, options?: unknown) => mockPostPaymentsAlipayCreate(payload, options),
  getPaymentsPaymentId: (paymentId: string) => mockGetPaymentsPaymentId(paymentId),
  postPaymentsPaymentIdRecheck: (paymentId: string) => mockPostPaymentsPaymentIdRecheck(paymentId)
}))

jest.mock('@tmo/platform-adapter', () => ({
  getPlatform: () => mockGetPlatform(),
  pay: (payload: unknown) => mockPay(payload),
  getStorage: () => mockGetStorage(),
  setStorage: () => mockSetStorage(),
  removeStorage: () => mockRemoveStorage(),
  request: (payload: unknown) => mockRequest(payload)
}))

import { Platform } from '@tmo/shared/enums'
import { ApiError, PaymentCancelledError, createPaymentServices } from '@tmo/payment-services'

describe('payment-services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPlatform.mockReturnValue(Platform.Weapp)
    mockPay.mockResolvedValue({ resultCode: '9000' })
  })

  it('uses wechat create API and normalizes response', async () => {
    mockPostPaymentsWechatCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-1',
        orderId: 'order-1',
        channel: 'WECHAT',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        prepayId: 'prepay-1',
        package: 'prepay_id=prepay-1',
        nonceStr: 'nonce-1',
        timeStamp: '1234567890',
        signType: 'RSA',
        paySign: 'sign-1'
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    const session = await services.sessions.createForOrder('order-1')

    expect(mockPostPaymentsWechatCreate).toHaveBeenCalledWith(
      { orderId: 'order-1' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String)
        })
      })
    )
    expect(session).toEqual(expect.objectContaining({
      id: 'pay-1',
      orderId: 'order-1',
      channel: 'wechat',
      status: 'PAY_PENDING',
      prepayId: 'prepay-1'
    }))
  })

  it('uses alipay create API on Alipay platform and normalizes tradeNo', async () => {
    mockGetPlatform.mockReturnValue(Platform.Alipay)
    mockPostPaymentsAlipayCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-2',
        orderId: 'order-2',
        channel: 'ALIPAY',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        tradeNo: 'trade-2',
        payParams: {
          tradeNO: 'trade-2'
        }
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    const session = await services.sessions.createForOrder('order-2')

    expect(mockPostPaymentsAlipayCreate).toHaveBeenCalled()
    expect(session).toEqual(expect.objectContaining({
      id: 'pay-2',
      orderId: 'order-2',
      channel: 'alipay',
      tradeNo: 'trade-2'
    }))
  })

  it('wraps non-2xx create response as ApiError', async () => {
    mockPostPaymentsWechatCreate.mockResolvedValue({
      status: 403,
      data: {
        code: 'feature_disabled',
        message: 'payment is disabled'
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await expect(services.sessions.createForOrder('order-3')).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      statusCode: 403,
      code: 'feature_disabled'
    }))
    expect(ApiError).toBeDefined()
  })

  it('converts cancel result to PaymentCancelledError', async () => {
    mockPostPaymentsWechatCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-4',
        orderId: 'order-4',
        channel: 'WECHAT',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        prepayId: 'prepay-4',
        package: 'prepay_id=prepay-4',
        nonceStr: 'nonce-4',
        timeStamp: '1234567890',
        signType: 'RSA',
        paySign: 'sign-4'
      }
    })
    mockPay.mockRejectedValue({ resultCode: '6001', message: 'cancel' })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await expect(services.sessions.payForOrder('order-4')).rejects.toBeInstanceOf(PaymentCancelledError)
  })

  it('normalizes payment detail on get and recheck', async () => {
    mockGetPaymentsPaymentId.mockResolvedValue({
      status: 200,
      data: {
        id: 'pay-5',
        orderId: 'order-5',
        channel: 'ALIPAY',
        status: 'PAID',
        amountFen: 5200,
        currency: 'CNY',
        paidAt: '2026-03-06T10:00:00Z',
        createdAt: '2026-03-06T09:50:00Z',
        updatedAt: '2026-03-06T10:00:00Z'
      }
    })
    mockPostPaymentsPaymentIdRecheck.mockResolvedValue({
      status: 200,
      data: {
        id: 'pay-5',
        orderId: 'order-5',
        channel: 'ALIPAY',
        status: 'PAID',
        amountFen: 5200,
        currency: 'CNY',
        paidAt: '2026-03-06T10:00:00Z',
        createdAt: '2026-03-06T09:50:00Z',
        updatedAt: '2026-03-06T10:00:00Z'
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    const detail = await services.sessions.get('pay-5')
    const rechecked = await services.sessions.recheck('pay-5')

    expect(detail.channel).toBe('alipay')
    expect(detail.amountFen).toBe(5200)
    expect(rechecked.status).toBe('PAID')
  })
})
