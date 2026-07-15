import { fireEvent, render, screen } from '@testing-library/react'
import OrderSuccessPage from './index'
import { navigateTo, switchTabLike } from '../../../utils/navigation'

jest.mock('../../../utils/navigation', () => ({
  navigateTo: jest.fn(),
  switchTabLike: jest.fn()
}))

const setRouterParams = (params: Record<string, string>) => {
  ;(globalThis as { __setTaroRouterParams?: (params: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

describe('OrderSuccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setRouterParams({ id: 'order-1001' })
  })

  afterEach(() => {
    setRouterParams({})
  })

  it('renders success copy and order id', () => {
    render(<OrderSuccessPage />)

    expect(screen.getAllByText('下单成功').length).toBeGreaterThan(0)
    expect(screen.getByText('管理员正在处理您的订单，您可以在订单列表中看到订单状况。')).toBeInTheDocument()
    expect(screen.getByText('订单号：order-1001')).toBeInTheDocument()
  })

  it('shows paid state when payment is paid', () => {
    setRouterParams({ id: 'order-1001', payment: 'paid' })

    render(<OrderSuccessPage />)

    expect(screen.getByText('支付成功')).toBeInTheDocument()
  })

  it('routes actions to order list, detail, and home', () => {
    render(<OrderSuccessPage />)

    fireEvent.click(screen.getByText('查看订单列表'))
    fireEvent.click(screen.getByText('查看订单详情'))
    fireEvent.click(screen.getByText('继续购物'))

    expect(switchTabLike).toHaveBeenCalledWith('/pages/order/list/index')
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/detail/index?id=order-1001')
    expect(switchTabLike).toHaveBeenCalledWith('/pages/index/index')
  })
})
