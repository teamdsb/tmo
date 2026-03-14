import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { removeStorage } from '@tmo/platform-adapter'

import OrderDetailPage from './index'
import { commerceServices } from '../../../services/commerce'
import { paymentServices } from '../../../services/payment'
import { navigateTo, switchTabLike } from '../../../utils/navigation'

jest.mock('../../../services/payment', () => ({
  paymentServices: {
    sessions: {
      payForOrder: jest.fn(),
      recheck: jest.fn()
    }
  },
  isPaymentCancelled: jest.fn(() => false)
}))

jest.mock('../../../utils/navigation', () => ({
  navigateTo: jest.fn(),
  switchTabLike: jest.fn()
}))

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const setRouterParams = (params: Record<string, string>) => {
  ;(globalThis as { __setTaroRouterParams?: (params: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

const buildOrder = (overrides: Record<string, unknown> = {}) => ({
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
      sku: { id: 'sku-1', name: '工业阀门', spec: 'DN20' }
    },
    {
      qty: 1,
      unitPriceFen: 3200,
      sku: { id: 'sku-2', name: '执行器', spec: '24V' }
    }
  ],
  createdAt: '2026-03-06T00:00:00Z',
  updatedAt: '2026-03-06T00:00:00Z',
  ...overrides
})

describe('OrderDetailPage', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    setRouterParams({ id: 'order-2001' })
    await removeStorage('tmo:payment:dev-overrides')
  })

  afterEach(() => {
    setRouterParams({})
  })

  it('shows new pending layout and payment actions for unpaid orders', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder())

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('等待支付完成')).toBeInTheDocument()
    expect(screen.getByText('订单信息')).toBeInTheDocument()
    expect(screen.getByText('收货地址')).toBeInTheDocument()
    expect(screen.getByText('商品清单')).toBeInTheDocument()
    expect(screen.getByText('继续支付')).toBeInTheDocument()
    expect(screen.getByText('刷新支付状态')).toBeInTheDocument()
    expect(screen.getByText('返回商城')).toBeInTheDocument()
    expect(screen.getByText('查看物流')).toBeInTheDocument()
  })

  it('refreshes payment status with latestPaymentId', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder())
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
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder({ items: [] }))
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

    expect(await screen.findByText('支付成功')).toBeInTheDocument()
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

  it('shows paid hero and hides payment recovery actions for paid orders', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder({
      status: 'PAID',
      paymentStatus: 'PAID'
    }))

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('支付成功')).toBeInTheDocument()
    expect(screen.queryByText('继续支付')).toBeNull()
    expect(screen.queryByText('刷新支付状态')).toBeNull()
    expect(screen.getByText('返回商城')).toBeInTheDocument()
    expect(screen.getByText('查看物流')).toBeInTheDocument()
  })

  it('expands all items from summary view', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder())

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('工业阀门')).toBeInTheDocument()
    expect(screen.queryByText('执行器')).toBeNull()

    fireEvent.click(screen.getByText('查看全部商品（2）'))

    expect(screen.getByText('执行器')).toBeInTheDocument()
    expect(screen.getByText('收起商品')).toBeInTheDocument()
  })

  it('shows address fallback when address is missing', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder({ address: undefined }))

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getAllByText('未提供地址').length).toBeGreaterThan(0)
  })

  it('routes footer actions to shop and logistics', async () => {
    ;(commerceServices.orders.get as jest.Mock).mockResolvedValue(buildOrder({
      status: 'PAID',
      paymentStatus: 'PAID'
    }))

    render(<OrderDetailPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('返回商城'))
    fireEvent.click(screen.getByText('查看物流'))

    expect(switchTabLike).toHaveBeenCalledWith('/pages/index/index')
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/tracking/index?id=order-2001')
  })
})
