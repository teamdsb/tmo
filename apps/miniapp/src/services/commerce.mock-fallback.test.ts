const mockCommerceStorageKey = 'tmo:commerce:mock-state'

const prepareCommerceServices = () => {
  jest.resetModules()
  process.env.TARO_APP_COMMERCE_MOCK_FALLBACK = 'true'

  const commerceFactory = require('@tmo/commerce-services') as {
    createCommerceServices: () => {
      cart: {
        getCart: jest.Mock
        addItem: jest.Mock
        updateItemQty: jest.Mock
        removeItem: jest.Mock
      }
      wishlist: {
        list: jest.Mock
        add: jest.Mock
        remove: jest.Mock
      }
    }
  }

  const rawServices = commerceFactory.createCommerceServices()
  jest.spyOn(commerceFactory, 'createCommerceServices').mockReturnValue(rawServices)

  const { commerceServices } = require('./commerce') as typeof import('./commerce')
  return { commerceServices, rawServices }
}

describe('commerce mock fallback', () => {
  beforeEach(async () => {
    jest.restoreAllMocks()
    const { removeStorage } = require('@tmo/platform-adapter') as {
      removeStorage: (key: string) => Promise<void>
    }
    await removeStorage(mockCommerceStorageKey)
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(async () => {
    const { removeStorage } = require('@tmo/platform-adapter') as {
      removeStorage: (key: string) => Promise<void>
    }
    await removeStorage(mockCommerceStorageKey)
    delete process.env.TARO_APP_COMMERCE_MOCK_FALLBACK
    jest.restoreAllMocks()
  })

  it('falls back to local wishlist when api requests fail', async () => {
    const { commerceServices, rawServices } = prepareCommerceServices()
    rawServices.wishlist.list.mockRejectedValue(new Error('offline'))
    rawServices.wishlist.add.mockRejectedValue(new Error('offline'))
    rawServices.wishlist.remove.mockRejectedValue(new Error('offline'))

    await commerceServices.wishlist.add('sku-bolt-a2-m8')
    let wishlist = await commerceServices.wishlist.list()
    expect(wishlist.map((item) => item.sku.id)).toEqual(['sku-bolt-a2-m8'])

    await commerceServices.wishlist.remove('sku-bolt-a2-m8')
    wishlist = await commerceServices.wishlist.list()
    expect(wishlist).toEqual([])
  })

  it('falls back to local cart when api requests fail', async () => {
    const { commerceServices, rawServices } = prepareCommerceServices()
    rawServices.cart.getCart.mockRejectedValue(new Error('offline'))
    rawServices.cart.addItem.mockRejectedValue(new Error('offline'))

    await commerceServices.cart.addItem('sku-bolt-a2-m8', 1)
    await commerceServices.cart.addItem('sku-bolt-a2-m8', 2)

    let cart = await commerceServices.cart.getCart()
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].sku.id).toBe('sku-bolt-a2-m8')
    expect(cart.items[0].qty).toBe(3)

    cart = await commerceServices.cart.updateItemQty(cart.items[0].id, 5)
    expect(cart.items[0].qty).toBe(5)

    await commerceServices.cart.removeItem(cart.items[0].id)
    cart = await commerceServices.cart.getCart()
    expect(cart.items).toEqual([])
  })
})
