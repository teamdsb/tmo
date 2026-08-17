import { isAlipay, isWeapp } from '@tmo/platform-adapter'

import { loadBootstrap } from './bootstrap'
import { buildOrderPaymentIdempotencyKey, resolvePaymentAvailability } from './payment-availability'

jest.mock('@tmo/platform-adapter', () => ({ isWeapp: jest.fn(), isAlipay: jest.fn() }))
jest.mock('./bootstrap', () => ({ loadBootstrap: jest.fn() }))
jest.mock('../config/runtime-env', () => ({ runtimeEnv: { isIsolatedMock: false } }))

describe('payment availability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isWeapp as jest.Mock).mockReturnValue(true)
    ;(isAlipay as jest.Mock).mockReturnValue(false)
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      me: { currentRole: 'CUSTOMER', roles: ['CUSTOMER'], userType: 'customer' },
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
      me: { currentRole: 'CUSTOMER', roles: ['CUSTOMER'], userType: 'customer' },
      featureFlags: { paymentEnabled: true, wechatPayEnabled: false }
    })
    await expect(resolvePaymentAvailability()).resolves.toEqual(expect.objectContaining({
      available: false,
      unavailableMessage: expect.stringContaining('微信支付暂未开通')
    }))
  })

  it('does not advertise an unimplemented Alipay flow even when its flag is stale', async () => {
    ;(isWeapp as jest.Mock).mockReturnValue(false)
    ;(isAlipay as jest.Mock).mockReturnValue(true)
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      me: { currentRole: 'CUSTOMER', roles: ['CUSTOMER'], userType: 'customer' },
      featureFlags: { paymentEnabled: true, alipayPayEnabled: true }
    })

    await expect(resolvePaymentAvailability()).resolves.toEqual(expect.objectContaining({
      available: false,
      unavailableMessage: expect.stringContaining('尚未接入')
    }))
  })

  it('blocks a SALES session from paying an owned customer order', async () => {
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      me: { currentRole: 'SALES', roles: ['SALES'], userType: 'staff' },
      featureFlags: { paymentEnabled: true, wechatPayEnabled: true }
    })

    await expect(resolvePaymentAvailability()).resolves.toEqual(expect.objectContaining({
      available: false,
      unavailableMessage: expect.stringContaining('客户身份')
    }))
  })

  it('uses a stable per-order idempotency key', () => {
    expect(buildOrderPaymentIdempotencyKey('order-1')).toBe('order-payment-order-1')
  })
})
