describe('isolated mock mode', () => {
  const originalEnv = { ...process.env }

  beforeEach(async () => {
    jest.resetModules()
    jest.restoreAllMocks()
    process.env = {
      ...originalEnv,
      TARO_APP_MOCK_MODE: 'isolated',
      TARO_APP_COMMERCE_MOCK_FALLBACK: 'false'
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

    expect(gatewaySpy).not.toHaveBeenCalled()
    expect(identitySpy).not.toHaveBeenCalled()
    expect(commerceSpy).not.toHaveBeenCalled()

    const beforeLogin = await gatewayServices.bootstrap.get()
    expect(beforeLogin.me).toBeUndefined()

    await identityServices.auth.miniLogin({})
    const afterLogin = await gatewayServices.bootstrap.get()
    expect(afterLogin.me?.id).toBe('mock-user-id')

    const categories = await commerceServices.catalog.listCategories()
    expect(categories.items.length).toBeGreaterThan(0)

    await commerceServices.wishlist.add('sku-bolt-a2-m8')
    const wishlist = await commerceServices.wishlist.list()
    expect(wishlist.map((item) => item.sku.id)).toContain('sku-bolt-a2-m8')

    const cart = await commerceServices.cart.addItem('sku-bolt-a2-m8', 2)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].qty).toBe(2)
  })

  it('resets isolated mock persisted state', async () => {
    const { identityServices } = require('./identity') as typeof import('./identity')
    const { commerceServices } = require('./commerce') as typeof import('./commerce')
    const { gatewayServices } = require('./gateway') as typeof import('./gateway')
    const { resetIsolatedMockState } = require('./mock/runtime') as typeof import('./mock/runtime')

    await identityServices.auth.miniLogin({})
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

  it('persists mock sku price tiers and reuses them', async () => {
    const { commerceServices } = require('./commerce') as typeof import('./commerce')
    const { loadIsolatedMockState, updateIsolatedMockState } = require('./mock/runtime') as typeof import('./mock/runtime')

    const detail = await commerceServices.catalog.getProductDetail('spu-bolt-a2')
    const skuId = detail.skus[0]?.id
    expect(skuId).toBeTruthy()
    if (!skuId) {
      throw new Error('expected mock sku id')
    }

    const stored = await loadIsolatedMockState()
    expect(stored.skuPriceTiersBySkuId[skuId]?.length).toBeGreaterThan(0)

    await updateIsolatedMockState((state) => ({
      ...state,
      skuPriceTiersBySkuId: {
        ...state.skuPriceTiersBySkuId,
        [skuId]: [
          { minQty: 1, maxQty: 5, unitPriceFen: 999 }
        ]
      }
    }))

    const updatedDetail = await commerceServices.catalog.getProductDetail('spu-bolt-a2')
    const updatedSku = updatedDetail.skus.find((sku) => sku.id === skuId)
    expect(updatedSku?.priceTiers?.[0]?.unitPriceFen).toBe(999)

    await commerceServices.cart.addItem(skuId, 1)
    const cart = await commerceServices.cart.getCart()
    expect(cart.items[0]?.sku.priceTiers?.[0]?.unitPriceFen).toBe(999)
  })
})
