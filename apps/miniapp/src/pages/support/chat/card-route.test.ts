import { resolveSupportCardRoute } from './card-route'

describe('resolveSupportCardRoute', () => {
  it('uses an internal miniapp route', () => {
    expect(resolveSupportCardRoute({ route: '/pages/goods/detail/index?id=product-1' }))
      .toBe('/pages/goods/detail/index?id=product-1')
  })

  it('converts the legacy admin product link', () => {
    expect(resolveSupportCardRoute({ linkUrl: '/goods/product%202' }))
      .toBe('/pages/goods/detail/index?id=product%202')
  })

  it.each([
    { route: 'https://evil.example/product' },
    { linkUrl: 'https://evil.example/product' },
    { linkUrl: '/unknown/product-1' },
    {}
  ])('rejects unsafe or unknown payload %#', (payload) => {
    expect(resolveSupportCardRoute(payload)).toBe('')
  })
})
