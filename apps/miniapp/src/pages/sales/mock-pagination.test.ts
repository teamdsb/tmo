describe('sales list mock contracts', () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv, TARO_APP_MOCK_MODE: 'isolated' }
  })
  afterEach(async () => {
    const { resetIsolatedMockState } = require('../../services/mock/runtime') as typeof import('../../services/mock/runtime')
    await resetIsolatedMockState()
    process.env = { ...originalEnv }
  })

  it('paginates filtered customers and reports the full filtered total', async () => {
    const { identityServices } = require('../../services/identity') as typeof import('../../services/identity')
    await identityServices.auth.miniLogin({ role: 'SALES' })
    const first = await identityServices.customers.list({ page: 1, pageSize: 1 })
    const second = await identityServices.customers.list({ page: 2, pageSize: 1 })
    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(1)
    expect(first.items[0].id).not.toBe(second.items[0].id)
    expect(first.total).toBe(2)
    const filtered = await identityServices.customers.list({ page: 1, pageSize: 1, q: '多角色' })
    expect(filtered.total).toBe(1)
    expect(filtered.items[0].displayName).toBe('多角色客户')
  })

  it('filters a status group before pagination and preserves the legacy status filter', async () => {
    const { commerceServices } = require('../../services/commerce') as typeof import('../../services/commerce')
    const { updateIsolatedMockState, loadIsolatedMockState } = require('../../services/mock/runtime') as typeof import('../../services/mock/runtime')
    const state = await loadIsolatedMockState()
    const sample = state.orders[0]
    await updateIsolatedMockState((current) => ({ ...current, orders: [
      { ...sample, id: 'order-a', status: 'CONFIRMED', createdAt: '2026-01-01T00:00:00Z' },
      { ...sample, id: 'order-b', status: 'PAID', createdAt: '2026-01-01T00:00:00Z' },
      { ...sample, id: 'order-c', status: 'CANCELLED', createdAt: '2026-01-02T00:00:00Z' }
    ] }))
    const first = await commerceServices.orders.list({ statuses: ['CONFIRMED', 'PAID'], page: 1, pageSize: 1 })
    const second = await commerceServices.orders.list({ statuses: ['CONFIRMED', 'PAID'], page: 2, pageSize: 1 })
    expect(first.total).toBe(2)
    expect(first.items.map((item) => item.id)).toEqual(['order-b'])
    expect(second.items.map((item) => item.id)).toEqual(['order-a'])
    expect((await commerceServices.orders.list({ status: 'CANCELLED' })).items.map((item) => item.id)).toEqual(['order-c'])
  })
})
