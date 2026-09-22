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
  postPaymentsPaymentIdRecheck: (paymentId: string, body?: unknown) => mockPostPaymentsPaymentIdRecheck(paymentId, body)
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
    mockLogin.mockResolvedValue({ code: 'fresh-login-code' })
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

    const session = await services.sessions.createForOrder('order-1', { channel: 'wechat' })

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

  it('defaults WeChat to B2B create and wx.requestCommonPayment without calling ordinary payment', async () => {
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-b2b', orderId: 'order-b2b', channel: 'WECHAT_B2B', status: 'PAY_PENDING',
        expiresAt: '2026-09-19T13:00:00Z',
        commonPayParams: { signData: 'opaque', mode: 'retail_pay_goods', paySig: 'pay-signature', signature: 'session-signature' }
      }
    })
    mockPostPaymentsPaymentIdRecheck.mockResolvedValue({
      status: 200,
      data: {
        id: 'pay-b2b', orderId: 'order-b2b', channel: 'WECHAT_B2B', status: 'PAY_PENDING',
        amountFen: 1, currency: 'CNY', createdAt: '2026-09-19T12:45:00Z', updatedAt: '2026-09-19T12:45:00Z'
      }
    })

    const services = createPaymentServices({ baseUrl: 'https://payment.example.com', requester: jest.fn() })
    await expect(services.sessions.payForOrder('order-b2b', {
      idempotencyKey: 'order-payment-order-b2b'
    })).resolves.toEqual(expect.objectContaining({ id: 'pay-b2b', channel: 'wechat_b2b', status: 'PAY_PENDING' }))

    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(mockPostPaymentsWechatB2bCreate).toHaveBeenCalledWith(
      { orderId: 'order-b2b', wechatLoginCode: 'fresh-login-code' },
      expect.objectContaining({ headers: { 'Idempotency-Key': 'order-payment-order-b2b' } })
    )
    expect(mockCommonPay).toHaveBeenCalledWith({
      payload: expect.objectContaining({ mode: 'retail_pay_goods', paySig: 'pay-signature' })
    })
    expect(mockPay).not.toHaveBeenCalled()
    expect(mockPostPaymentsPaymentIdRecheck).toHaveBeenCalledWith('pay-b2b', expect.objectContaining({ clientResult: 'SUCCESS' }))
  })

  it('does not reopen a payment panel when an idempotent replay is already paid', async () => {
    mockPostPaymentsWechatB2bCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-paid', orderId: 'order-paid', channel: 'WECHAT_B2B', status: 'PAID',
        expiresAt: '2026-09-19T13:00:00Z', commonPayParams: {}
      }
    })
    const services = createPaymentServices({ baseUrl: 'https://payment.example.com', requester: jest.fn() })
    await expect(services.sessions.payForOrder('order-paid', { channel: 'wechat_b2b' })).resolves.toEqual(
      expect.objectContaining({ id: 'pay-paid', status: 'PAID' })
    )
    expect(mockCommonPay).not.toHaveBeenCalled()
    expect(mockPay).not.toHaveBeenCalled()
    expect(mockPostPaymentsPaymentIdRecheck).not.toHaveBeenCalled()
  })

  it('surfaces the explicit not-implemented response on Alipay', async () => {
    mockGetPlatform.mockReturnValue(Platform.Alipay)
    mockPostPaymentsAlipayCreate.mockResolvedValue({
      status: 501,
      data: {
        code: 'not_implemented',
        message: 'alipay payment is not implemented'
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await expect(services.sessions.createForOrder('order-2')).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      statusCode: 501,
      code: 'not_implemented'
    }))
    expect(mockPostPaymentsAlipayCreate).toHaveBeenCalled()
    expect(mockPay).not.toHaveBeenCalled()
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

    await expect(services.sessions.createForOrder('order-3', { channel: 'wechat' })).rejects.toEqual(expect.objectContaining({
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
    mockPostPaymentsPaymentIdRecheck.mockResolvedValue({
      status: 200,
      data: {
        id: 'pay-4', orderId: 'order-4', channel: 'WECHAT', status: 'CANCELLED',
        amountFen: 100, currency: 'CNY', createdAt: '2026-03-06T10:00:00Z', updatedAt: '2026-03-06T10:01:00Z'
      }
    })

    const services = createPaymentServices({
      baseUrl: 'https://payment.example.com',
      requester: jest.fn()
    })

    await expect(services.sessions.payForOrder('order-4', { channel: 'wechat' })).rejects.toBeInstanceOf(PaymentCancelledError)
    expect(mockPostPaymentsPaymentIdRecheck).toHaveBeenCalledWith('pay-4', expect.objectContaining({
      clientResult: 'CANCELLED'
    }))
  })

  it('reports client success before returning the authoritative recheck result', async () => {
    mockPostPaymentsWechatCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-success', orderId: 'order-success', channel: 'WECHAT', status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z', prepayId: 'prepay-success', package: 'prepay_id=prepay-success',
        nonceStr: 'nonce-success', timeStamp: '1234567890', signType: 'RSA', paySign: 'sign-success'
      }
    })
    mockPostPaymentsPaymentIdRecheck.mockResolvedValue({
      status: 200,
      data: {
        id: 'pay-success', orderId: 'order-success', channel: 'WECHAT', status: 'PAID',
        amountFen: 100, currency: 'CNY', createdAt: '2026-03-06T10:00:00Z', updatedAt: '2026-03-06T10:01:00Z'
      }
    })

    const services = createPaymentServices({ baseUrl: 'https://payment.example.com', requester: jest.fn() })
    await expect(services.sessions.payForOrder('order-success', { channel: 'wechat' })).resolves.toEqual(expect.objectContaining({ status: 'PAID' }))
    expect(mockPostPaymentsPaymentIdRecheck).toHaveBeenCalledWith('pay-success', expect.objectContaining({
      clientResult: 'SUCCESS'
    }))
  })

  it('reports client failure before rethrowing the platform error', async () => {
    mockPostPaymentsWechatCreate.mockResolvedValue({
      status: 200,
      data: {
        paymentId: 'pay-failed', orderId: 'order-failed', channel: 'WECHAT', status: 'PAY_PENDING',
        expiresAt: '2026-03-06T10:15:00Z', prepayId: 'prepay-failed', package: 'prepay_id=prepay-failed',
        nonceStr: 'nonce-failed', timeStamp: '1234567890', signType: 'RSA', paySign: 'sign-failed'
      }
    })
    mockPay.mockRejectedValue(new Error('requestPayment:fail system error'))
    mockPostPaymentsPaymentIdRecheck.mockResolvedValue({ status: 200, data: {} })

    const services = createPaymentServices({ baseUrl: 'https://payment.example.com', requester: jest.fn() })
    await expect(services.sessions.payForOrder('order-failed', { channel: 'wechat' })).rejects.toThrow('system error')
    expect(mockPostPaymentsPaymentIdRecheck).toHaveBeenCalledWith('pay-failed', expect.objectContaining({
      clientResult: 'FAILED',
      reason: 'requestPayment:fail system error'
    }))
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
