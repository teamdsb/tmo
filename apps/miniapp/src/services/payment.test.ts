describe('miniapp payment runtime', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      TARO_APP_API_BASE_URL: 'http://localhost:8080',
      TARO_APP_MOCK_MODE: 'off'
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it('uses fake payment in development by default', async () => {
    const realRecheck = jest.fn(async () => ({
      id: 'pay-real',
      orderId: 'order-real',
      channel: 'wechat',
      status: 'PAY_PENDING'
    }))
    const createPaymentServices = jest.fn(() => ({
      sessions: {
        createForOrder: jest.fn(),
        get: jest.fn(),
        recheck: realRecheck,
        payForOrder: jest.fn(async () => {
          throw new Error('should not call real payForOrder')
        })
      },
      tokens: {
        getToken: jest.fn(),
        setToken: jest.fn()
      }
    }))

    jest.doMock('@tmo/payment-services', () => ({
      __esModule: true,
      ApiError: class ApiError extends Error {},
      PaymentCancelledError: class PaymentCancelledError extends Error {},
      createPaymentServices,
      isApiError: jest.fn(() => false),
      isPaymentCancelled: jest.fn(() => false)
    }))

    const { paymentServices } = require('./payment') as typeof import('./payment')

    await expect(paymentServices.sessions.payForOrder('order-2001')).resolves.toEqual(expect.objectContaining({
      id: 'pay_dev_fake_order-2001',
      orderId: 'order-2001',
      status: 'PAID'
    }))

    await expect(paymentServices.sessions.recheck('pay_dev_fake_order-2001')).resolves.toEqual(expect.objectContaining({
      orderId: 'order-2001',
      status: 'PAID'
    }))

    expect(createPaymentServices).toHaveBeenCalledTimes(1)
    expect(realRecheck).not.toHaveBeenCalled()
  })

  it('can disable fake payment explicitly', async () => {
    process.env.TARO_APP_DEV_FAKE_PAYMENT = 'false'

    const realPayForOrder = jest.fn(async () => ({
      id: 'pay-real',
      orderId: 'order-2002',
      channel: 'wechat',
      status: 'PAID'
    }))
    const createPaymentServices = jest.fn(() => ({
      sessions: {
        createForOrder: jest.fn(),
        get: jest.fn(),
        recheck: jest.fn(),
        payForOrder: realPayForOrder
      },
      tokens: {
        getToken: jest.fn(),
        setToken: jest.fn()
      }
    }))

    jest.doMock('@tmo/payment-services', () => ({
      __esModule: true,
      ApiError: class ApiError extends Error {},
      PaymentCancelledError: class PaymentCancelledError extends Error {},
      createPaymentServices,
      isApiError: jest.fn(() => false),
      isPaymentCancelled: jest.fn(() => false)
    }))

    const { paymentServices } = require('./payment') as typeof import('./payment')

    await paymentServices.sessions.payForOrder('order-2002')

    expect(realPayForOrder).toHaveBeenCalledWith('order-2002')
  })
})
