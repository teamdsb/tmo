import { classifyOrderProgress, orderProgressLabel } from './order-progress'

describe('order progress', () => {
  it.each([
    [{ status: 'SUBMITTED', paymentStatus: 'UNPAID' }, 'pending'],
    [{ status: 'DELIVERED', paymentStatus: 'UNPAID' }, 'pending'],
    [{ status: 'PAY_FAILED', paymentStatus: 'PAY_FAILED' }, 'pending'],
    [{ status: 'CONFIRMED', paymentStatus: 'PAID' }, 'pending'],
    [{ status: 'SHIPPED', paymentStatus: 'PAID' }, 'shipped'],
    [{ status: 'DELIVERED', paymentStatus: 'PAID' }, 'delivered'],
    [{ status: 'CLOSED', paymentStatus: 'UNPAID' }, 'hidden']
  ] as const)('classifies %o as %s', (order, expected) => {
    expect(classifyOrderProgress(order as any)).toBe(expected)
  })

  it('keeps an unpaid order in pending while exposing its payment label', () => {
    expect(orderProgressLabel({ status: 'PAY_PENDING', paymentStatus: 'PAY_PENDING' } as any)).toBe('待付款')
  })
})
