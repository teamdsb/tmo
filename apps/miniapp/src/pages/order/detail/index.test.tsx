import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { removeStorage } from '@tmo/platform-adapter'

import OrderDetailPage from './index'
import { commerceServices } from '../../../services/commerce'
import { paymentServices } from '../../../services/payment'

jest.mock('../../../services/payment', () => ({
  paymentServices: {
    sessions: {
      payForOrder: jest.fn(),
      recheck: jest.fn()
    }
  },
  isPaymentCancelled: jest.fn(() => false)
}))

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const setRouterParams = (params: Record<string, string>) => {
  ;(globalThis as { __setTaroRouterParams?: (params: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

describe('OrderDetailPage', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    setRouterParams({ id: 'order-2001' })
    await removeStorage('tmo:payment:dev-overrides')
  })

  afterEach(() => {
    setRouterParams({})
  })

  it('shows continue pay and refresh actions for unpaid orders', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue({
      id: 'order-2001',
      status: 'PAY_PENDING',
      paymentStatus: 'PAY_PENDING',
      latestPaymentId: 'pay-2001',
      address: {
        receiverName: '李四',
        receiverPhone: '13900000000',
        detail: '杭州市西湖区文三路 1 号'
      },
      items: [
        {
          qty: 2,
          unitPriceFen: 1500,
          sku: { id: 'sku-1', name: '工业阀门' }
        }
      ],
      createdAt: '2026-03-06T00:00:00Z',
      updatedAt: '2026-03-06T00:00:00Z'
    })

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('继续支付')).toBeInTheDocument()
    expect(screen.getByText('刷新支付状态')).toBeInTheDocument()
  })

  it('refreshes payment status with latestPaymentId', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue({
      id: 'order-2001',
      status: 'PAY_PENDING',
      paymentStatus: 'PAY_PENDING',
      latestPaymentId: 'pay-2001',
      address: {
        receiverName: '李四',
        receiverPhone: '13900000000',
        detail: '杭州市西湖区文三路 1 号'
      },
      items: [],
      createdAt: '2026-03-06T00:00:00Z',
      updatedAt: '2026-03-06T00:00:00Z'
    })
    ;(paymentServices.sessions.recheck as jest.Mock).mockResolvedValue({
      id: 'pay-2001',
      orderId: 'order-2001',
      channel: 'wechat',
      status: 'PAID'
    })

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(await screen.findByText('刷新支付状态'))
    await act(async () => {
      await flushPromises()
    })

    expect(paymentServices.sessions.recheck).toHaveBeenCalledWith('pay-2001')
  })

  it('keeps order paid locally after fake payment succeeds', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue({
      id: 'order-2001',
      status: 'PAY_PENDING',
      paymentStatus: 'PAY_PENDING',
      latestPaymentId: 'pay-2001',
      address: {
        receiverName: '李四',
        receiverPhone: '13900000000',
        detail: '杭州市西湖区文三路 1 号'
      },
      items: [],
      createdAt: '2026-03-06T00:00:00Z',
      updatedAt: '2026-03-06T00:00:00Z'
    })
    ;(paymentServices.sessions.payForOrder as jest.Mock).mockResolvedValue({
      id: 'pay_dev_fake_order-2001',
      orderId: 'order-2001',
      channel: 'wechat',
      status: 'PAID',
      paidAt: '2026-03-06T10:00:00Z',
      updatedAt: '2026-03-06T10:00:00Z'
    })

    const view = render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(await screen.findByText('继续支付'))
    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('支付状态')).toBeInTheDocument()
    expect(screen.getAllByText('已支付').length).toBeGreaterThan(0)
    expect(screen.queryByText('继续支付')).toBeNull()
    expect(screen.queryByText('刷新支付状态')).toBeNull()
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '支付成功',
      icon: 'success'
    }))

    view.unmount()
    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getAllByText('已支付').length).toBeGreaterThan(0)
    expect(screen.queryByText('继续支付')).toBeNull()
  })

  it('hides continue pay action for already paid orders', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue({
      id: 'order-2001',
      status: 'PAID',
      paymentStatus: 'PAID',
      latestPaymentId: 'pay-2001',
      address: {
        receiverName: '李四',
        receiverPhone: '13900000000',
        detail: '杭州市西湖区文三路 1 号'
      },
      items: [],
      createdAt: '2026-03-06T00:00:00Z',
      updatedAt: '2026-03-06T00:00:00Z'
    })

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.queryByText('继续支付')).toBeNull()
    expect(screen.queryByText('刷新支付状态')).toBeNull()
  })
})
