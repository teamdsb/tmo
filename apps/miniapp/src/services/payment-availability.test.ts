import { isAlipay, isWeapp } from '@tmo/platform-adapter'

import { loadBootstrap } from './bootstrap'
import { buildOrderPaymentIdempotencyKey, resolvePaymentAvailability } from './payment-availability'

jest.mock('@tmo/platform-adapter', () => ({ isWeapp: jest.fn(), isAlipay: jest.fn() }))
jest.mock('./bootstrap', () => ({ loadBootstrap: jest.fn() }))

describe('payment availability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isWeapp as jest.Mock).mockReturnValue(true)
    ;(isAlipay as jest.Mock).mockReturnValue(false)
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      featureFlags: { paymentEnabled: true, wechatPayEnabled: true, alipayPayEnabled: false }
    })
  })

  it('enables WeChat only when platform and feature flags allow it', async () => {
    await expect(resolvePaymentAvailability()).resolves.toEqual({
      available: true, channel: 'wechat', unavailableMessage: ''
    })
  })

  it('blocks payment when WeChat flag is disabled', async () => {
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      featureFlags: { paymentEnabled: true, wechatPayEnabled: false }
    })
    await expect(resolvePaymentAvailability()).resolves.toEqual(expect.objectContaining({
      available: false,
      unavailableMessage: expect.stringContaining('微信支付暂未开通')
    }))
  })

  it('uses a stable per-order idempotency key', () => {
    expect(buildOrderPaymentIdempotencyKey('order-1')).toBe('order-payment-order-1')
  })
})
