describe('isolated mock mode', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    jest.resetModules()
    jest.restoreAllMocks()
    process.env = {
      ...originalEnv,
      TARO_APP_MOCK_MODE: 'isolated'
    }
  })

  afterEach(async () => {
    const { resetIsolatedMockState } = require('./mock/runtime') as typeof import('./mock/runtime')
    await resetIsolatedMockState()
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it('routes gateway/identity/commerce to isolated services', async () => {
    const gatewayFactory = require('@tmo/gateway-services') as typeof import('@tmo/gateway-services')
    const identityFactory = require('@tmo/identity-services') as typeof import('@tmo/identity-services')
    const commerceFactory = require('@tmo/commerce-services') as typeof import('@tmo/commerce-services')

    const gatewaySpy = jest.spyOn(gatewayFactory, 'createGatewayServices')
    const identitySpy = jest.spyOn(identityFactory, 'createIdentityServices')
    const commerceSpy = jest.spyOn(commerceFactory, 'createCommerceServices')

    const { gatewayServices } = require('./gateway') as typeof import('./gateway')
    const { identityServices } = require('./identity') as typeof import('./identity')
    const { commerceServices } = require('./commerce') as typeof import('./commerce')
    const { paymentServices } = require('./payment') as typeof import('./payment')

    expect(gatewaySpy).not.toHaveBeenCalled()
    expect(identitySpy).not.toHaveBeenCalled()
    expect(commerceSpy).not.toHaveBeenCalled()

    const beforeLogin = await gatewayServices.bootstrap.get()
    expect(beforeLogin.me).toBeUndefined()

    await identityServices.auth.miniLogin({ phoneProof: { code: 'mock-phone-proof' } })
    const afterLogin = await gatewayServices.bootstrap.get()
    expect(afterLogin.me?.id).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd')

    const categories = await commerceServices.catalog.listCategories()
    expect(categories.items.length).toBeGreaterThan(0)

    const fasteners = await commerceServices.catalog.listProducts({
      categoryId: 'fasteners',
      page: 1,
      pageSize: 50
    })
    expect(fasteners.items.length).toBeGreaterThanOrEqual(10)

    const fastenerDetail = await commerceServices.catalog.getProductDetail('spu-bolt-a2')
    expect(fastenerDetail.product.categoryId).toBe('fasteners')
    expect(fastenerDetail.skus.some((sku) => sku.id === 'sku-bolt-a2-m8')).toBe(true)

    await commerceServices.wishlist.add('sku-bolt-a2-m8')
    const wishlist = await commerceServices.wishlist.list()
    expect(wishlist.map((item) => item.sku.id)).toContain('sku-bolt-a2-m8')

    const cart = await commerceServices.cart.addItem('sku-bolt-a2-m8', 2)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].qty).toBe(2)

    const createdOrder = await commerceServices.orders.submit({
      address: {
        receiverName: '张三',
        receiverPhone: '13800000000',
        detail: '上海市浦东新区世纪大道 1 号'
      },
      items: [{ skuId: 'sku-bolt-a2-m8', qty: 2 }]
    })

    expect(createdOrder.latestPaymentId).toBeTruthy()
    expect(createdOrder.paymentStatus).toBe('PAY_PENDING')

    const payment = await paymentServices.sessions.payForOrder(createdOrder.id)
    expect(payment.status).toBe('PAID')

    const paidOrder = await commerceServices.orders.get(createdOrder.id)
    expect(paidOrder.paymentStatus).toBe('PAID')
    expect(paidOrder.status).toBe('PAID')
    expect(paidOrder.latestPaymentId).toBe(payment.id)
  })

  it('resets isolated mock persisted state', async () => {
    const { identityServices } = require('./identity') as typeof import('./identity')
    const { commerceServices } = require('./commerce') as typeof import('./commerce')
    const { gatewayServices } = require('./gateway') as typeof import('./gateway')
    const { resetIsolatedMockState } = require('./mock/runtime') as typeof import('./mock/runtime')

    await identityServices.auth.miniLogin({ phoneProof: { code: 'mock-phone-proof' } })
    await commerceServices.wishlist.add('sku-bolt-a2-m8')
    await commerceServices.cart.addItem('sku-bolt-a2-m8', 1)

    await resetIsolatedMockState()

    const token = await identityServices.tokens.getToken()
    expect(token).toBeNull()

    const wishlist = await commerceServices.wishlist.list()
    expect(wishlist).toEqual([])

    const cart = await commerceServices.cart.getCart()
    expect(cart.items).toEqual([])

    const bootstrap = await gatewayServices.bootstrap.get()
    expect(bootstrap.me).toBeUndefined()
  })

  it('keeps the same role-selection contract as dev login', async () => {
    const platformAdapter = require('@tmo/platform-adapter') as typeof import('@tmo/platform-adapter')
    const identityServicesModule = require('@tmo/identity-services') as typeof import('@tmo/identity-services')
    const { identityServices } = require('./identity') as typeof import('./identity')

    jest.spyOn(platformAdapter, 'login').mockResolvedValue({ code: 'mock_multi_001' })

    await expect(identityServices.auth.miniLogin({
      phoneProof: { code: 'mock-phone-proof' }
    })).rejects.toBeInstanceOf(identityServicesModule.RoleSelectionRequiredError)
  })

  it('supports role-only customer login in isolated mock mode', async () => {
    const { identityServices } = require('./identity') as typeof import('./identity')
    const { gatewayServices } = require('./gateway') as typeof import('./gateway')

    await expect(identityServices.auth.miniLogin({
      role: 'CUSTOMER'
    })).resolves.toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      user: expect.objectContaining({
        currentRole: 'CUSTOMER'
      })
    }))

    const bootstrap = await gatewayServices.bootstrap.get()
    expect(bootstrap.me?.currentRole).toBe('CUSTOMER')
  })

  it('supports role-only sales login in isolated mock mode', async () => {
    const { identityServices } = require('./identity') as typeof import('./identity')
    const { gatewayServices } = require('./gateway') as typeof import('./gateway')

    await expect(identityServices.auth.miniLogin({
      role: 'SALES'
    })).resolves.toEqual(expect.objectContaining({
      accessToken: expect.any(String),
      user: expect.objectContaining({
        currentRole: 'SALES'
      })
    }))

    const bootstrap = await gatewayServices.bootstrap.get()
    expect(bootstrap.me?.currentRole).toBe('SALES')
  })
})
