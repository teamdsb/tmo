import { getGetOrdersUrl } from '@tmo/api-client'

describe('order status query contract', () => {
  it('sends every grouped status using the repeated parameter contract', () => {
    const url = new URL(getGetOrdersUrl({
      statuses: ['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED'],
      page: 2,
      pageSize: 20
    }), 'https://commerce.test')

    expect(url.pathname).toBe('/orders')
    expect(url.searchParams.getAll('statuses')).toEqual(['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED'])
    expect(url.searchParams.has('status')).toBe(false)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('pageSize')).toBe('20')
  })

  it('keeps the existing single-status parameter and omits absent filters', () => {
    const legacy = new URL(getGetOrdersUrl({ status: 'SHIPPED' }), 'https://commerce.test')
    expect(legacy.searchParams.get('status')).toBe('SHIPPED')
    expect(legacy.searchParams.has('statuses')).toBe(false)
    const all = new URL(getGetOrdersUrl({ page: 1 }), 'https://commerce.test')
    expect(all.searchParams.has('status')).toBe(false)
    expect(all.searchParams.has('statuses')).toBe(false)
  })
})
