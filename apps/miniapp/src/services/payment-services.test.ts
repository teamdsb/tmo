import { Platform } from '@tmo/shared/enums'
import { ApiError, PaymentCancelledError, createPaymentServices } from '@tmo/payment-services'

const mockSetPaymentApiClientConfig = jest.fn()
const mockPostPaymentsWechatCreate = jest.fn()
const mockPostPaymentsWechatB2bCreate = jest.fn()
const mockPostPaymentsAlipayCreate = jest.fn()
const mockGetPaymentsPaymentId = jest.fn()
const mockPostPaymentsPaymentIdRecheck = jest.fn()
const mockGetPlatform = jest.fn()
const mockPay = jest.fn()
const mockCommonPay = jest.fn()
const mockLogin = jest.fn()
const mockGetStorage = jest.fn(async () => ({ data: null }))
const mockSetStorage = jest.fn(async () => {})
const mockRemoveStorage = jest.fn(async () => {})
const mockRequest = jest.fn()

jest.mock('@tmo/payment-api-client', () => ({
  setPaymentApiClientConfig: (config: unknown) => mockSetPaymentApiClientConfig(config),
  postPaymentsWechatCreate: (payload: unknown, options?: unknown) => mockPostPaymentsWechatCreate(payload, options),
  postPaymentsWechatB2bCreate: (payload: unknown, options?: unknown) => mockPostPaymentsWechatB2bCreate(payload, options),
  postPaymentsAlipayCreate: (payload: unknown, options?: unknown) => mockPostPaymentsAlipayCreate(payload, options),
  getPaymentsPaymentId: (paymentId: string) => mockGetPaymentsPaymentId(paymentId),
  postPaymentsPaymentIdRecheck: (paymentId: string) => mockPostPaymentsPaymentIdRecheck(paymentId)
}))

jest.mock('@tmo/platform-adapter', () => ({
  getPlatform: () => mockGetPlatform(),
  pay: (payload: unknown) => mockPay(payload),
  commonPay: (payload: unknown) => mockCommonPay(payload),
  login: () => mockLogin(),
  getStorage: () => mockGetStorage(),
  setStorage: () => mockSetStorage(),
  removeStorage: () => mockRemoveStorage(),
  request: (payload: unknown) => mockRequest(payload)
}))

describe('payment-services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetPlatform.mockReturnValue(Platform.Weapp)
    mockPay.mockResolvedValue({ resultCode: '9000' })
    mockCommonPay.mockResolvedValue({})
    mockLogin.mockResolvedValue({ code: 'wechat-login-code' })
  })

  it('uses WeChat B2B create API and normalizes common payment params', async () => {
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-1',
        orderId: 'order-1',
        channel: 'WECHAT_B2B',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        commonPayParams: { signData: 'opaque', mode: 'retail_pay_goods', paySig: 'opaque', signature: 'opaque' }
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    const session = await services.sessions.createForOrder('order-1')

    expect(mockPostPaymentsWechatB2bCreate).toHaveBeenCalledWith(
      { orderId: 'order-1', wechatLoginCode: 'wechat-login-code' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String)
        })
      })
    )
    expect(session).toEqual(expect.objectContaining({
      id: 'pay-1',
      orderId: 'order-1',
      channel: 'wechat_b2b',
      status: 'PAY_PENDING',
      commonPayParams: expect.objectContaining({ mode: 'retail_pay_goods' })
    }))
  })

  it('passes explicit idempotency key to create API', async () => {
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-explicit-key',
        orderId: 'order-explicit-key',
        channel: 'WECHAT_B2B',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        commonPayParams: { signData: 'opaque', mode: 'retail_pay_goods', paySig: 'opaque', signature: 'opaque' }
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await services.sessions.createForOrder('order-explicit-key', {
      idempotencyKey: 'stable-order-payment-key'
    })

    expect(mockPostPaymentsWechatB2bCreate).toHaveBeenCalledWith(
      { orderId: 'order-explicit-key', wechatLoginCode: 'wechat-login-code' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': 'stable-order-payment-key'
        })
      })
    )
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
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
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
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-4',
        orderId: 'order-4',
        channel: 'WECHAT_B2B',
        status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z',
        commonPayParams: { signData: 'opaque', mode: 'retail_pay_goods', paySig: 'opaque', signature: 'opaque' }
      }
    })
    mockCommonPay.mockRejectedValue({ resultCode: '6001', message: 'cancel' })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await expect(services.sessions.payForOrder('order-4')).rejects.toBeInstanceOf(PaymentCancelledError)
    expect(mockCommonPay).toHaveBeenCalledWith({ payload: expect.objectContaining({ mode: 'retail_pay_goods' }) })
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
