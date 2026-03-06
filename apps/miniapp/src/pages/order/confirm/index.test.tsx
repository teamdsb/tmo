import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro, { useDidShow } from '@tarojs/taro'

import OrderConfirmPage from './index'
import { commerceServices } from '../../../services/commerce'
import { listUserAddresses } from '../../../services/addresses'
import { paymentServices, isPaymentCancelled } from '../../../services/payment'
import { ensureLoggedIn } from '../../../utils/auth'
import { navigateTo } from '../../../utils/navigation'

jest.mock('../../../services/addresses', () => ({
  listUserAddresses: jest.fn()
}))

jest.mock('../../../services/payment', () => ({
  paymentServices: {
    sessions: {
      payForOrder: jest.fn()
    }
  },
  isPaymentCancelled: jest.fn()
}))

jest.mock('../../../utils/auth', () => ({
  ensureLoggedIn: jest.fn()
}))

jest.mock('../../../utils/navigation', () => ({
  navigateTo: jest.fn(),
  switchTabLike: jest.fn()
}))

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const mockedIsPaymentCancelled = isPaymentCancelled as unknown as jest.Mock

const defaultAddress = {
  id: 'addr-1',
  receiverName: '张三',
  receiverPhone: '13800000000',
  detail: '上海市浦东新区世纪大道 1 号',
  isDefault: true,
  createdAt: '2026-03-06T00:00:00Z',
  updatedAt: '2026-03-06T00:00:00Z'
}

describe('OrderConfirmPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useDidShow as jest.Mock).mockImplementation((callback?: () => void) => {
      callback?.()
    })
    ;(ensureLoggedIn as jest.Mock).mockResolvedValue(true)
    ;(listUserAddresses as jest.Mock).mockResolvedValue([defaultAddress])
    ;(commerceServices.orders.submit as jest.Mock).mockResolvedValue({
      id: 'order-1001',
      status: 'SUBMITTED',
      paymentStatus: 'UNPAID',
      items: [],
      createdAt: '2026-03-06T00:00:00Z'
    })
  })

  it('submits order and shows success toast when payment succeeds', async () => {
    ;(paymentServices.sessions.payForOrder as jest.Mock).mockResolvedValue({
      id: 'pay-1',
      orderId: 'order-1001',
      channel: 'wechat',
      status: 'PAID'
    })

    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('提交意向订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(commerceServices.orders.submit).toHaveBeenCalled()
    expect(paymentServices.sessions.payForOrder).toHaveBeenCalledWith('order-1001')
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '支付成功', icon: 'success' })
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/detail/index?id=order-1001')
  })

  it('shows cancelled toast but still navigates to order detail', async () => {
    ;(paymentServices.sessions.payForOrder as jest.Mock).mockRejectedValue({ cancelled: true })
    mockedIsPaymentCancelled.mockImplementation((error: { cancelled?: boolean }) => error?.cancelled === true)

    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('提交意向订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({ title: '订单已提交，支付已取消', icon: 'none' })
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/detail/index?id=order-1001')
  })

  it('shows pending toast when payment invocation fails', async () => {
    ;(paymentServices.sessions.payForOrder as jest.Mock).mockRejectedValue(new Error('gateway timeout'))
    mockedIsPaymentCancelled.mockReturnValue(false)

    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('提交意向订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({ title: '订单已提交，待确认支付', icon: 'none' })
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/detail/index?id=order-1001')
  })
})
