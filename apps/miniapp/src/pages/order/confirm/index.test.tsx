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
const defaultCart = {
  items: [
    {
      id: 'cart-1',
      qty: 2,
      sku: {
        id: 'sku-1',
        spuId: 'spu-glove-1',
        name: '防割手套',
        spec: 'M 码',
        priceTiers: [
          { minQty: 1, maxQty: 5, unitPriceFen: 3200 },
          { minQty: 6, maxQty: null, unitPriceFen: 2800 }
        ]
      }
    }
  ]
}

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
    ;(useDidShow as jest.Mock).mockImplementation(() => {})
    ;(ensureLoggedIn as jest.Mock).mockResolvedValue(true)
    ;(listUserAddresses as jest.Mock).mockResolvedValue([defaultAddress])
    ;(commerceServices.cart.getCart as jest.Mock).mockResolvedValue(defaultCart)
    ;(commerceServices.catalog.getProductDetail as jest.Mock).mockResolvedValue({
      product: {
        id: 'spu-glove-1',
        name: '防割手套',
        categoryId: 'industrial',
        images: ['https://img.example.com/glove.png']
      },
      skus: defaultCart.items.map((item) => item.sku)
    })
    ;(commerceServices.orders.submit as jest.Mock).mockResolvedValue({
      id: 'order-1001',
      status: 'SUBMITTED',
      paymentStatus: 'UNPAID',
      items: [],
      createdAt: '2026-03-06T00:00:00Z'
    })
  })

  it('renders stitch-style address, remark input and price breakdown', async () => {
    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('张三 · 13800000000')).toBeInTheDocument()
    expect(screen.getByText('上海市浦东新区世纪大道 1 号')).toBeInTheDocument()
    expect(screen.getByText('商品清单')).toBeInTheDocument()
    expect(screen.getByText('规格：M 码')).toBeInTheDocument()
    expect(screen.getAllByText('¥64.00')).toHaveLength(3)
    expect(screen.getByText('单价 ¥32.00')).toBeInTheDocument()
    expect(screen.getByText('运费')).toBeInTheDocument()
    expect(screen.getByText('¥0.00')).toBeInTheDocument()
    expect(screen.getByText('应付合计')).toBeInTheDocument()
    expect(screen.getByText('合计：共 2 件')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('选填（例如: 包装要求、发货时间等）')).toBeInTheDocument()
    expect(document.querySelector('.order-confirm-item-image')).not.toBeNull()
    expect(document.querySelector('.order-confirm-bottom-value')?.textContent).toBe('64.00')
  })

  it('renders empty address call-to-action when no address exists', async () => {
    ;(listUserAddresses as jest.Mock).mockResolvedValueOnce([])

    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('添加收货地址')).toBeInTheDocument()
    expect(screen.getByText('请填写您的收货联系信息')).toBeInTheDocument()
  })

  it('navigates to goods detail when clicking order item row', async () => {
    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('防割手套'))

    expect(navigateTo).toHaveBeenCalledWith('/pages/goods/detail/index?id=spu-glove-1')
  })

  it('blocks submit when current qty has no matched price tier', async () => {
    ;(commerceServices.cart.getCart as jest.Mock).mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-1',
            spuId: 'spu-glove-1',
            name: '防割手套',
            spec: 'M 码',
            priceTiers: [
              { minQty: 1, maxQty: 1, unitPriceFen: 3200 },
              { minQty: 3, maxQty: null, unitPriceFen: 2800 }
            ]
          }
        }
      ]
    })

    render(<OrderConfirmPage />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('提交订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(commerceServices.orders.submit).not.toHaveBeenCalled()
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '当前商品数量未命中价格区间', icon: 'none' })
  })

  it('submits order and passes trimmed remark when payment succeeds', async () => {
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

    fireEvent.change(screen.getByPlaceholderText('选填（例如: 包装要求、发货时间等）'), {
      target: { value: '  周五前发货  ' }
    })
    fireEvent.click(screen.getByText('提交订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(commerceServices.orders.submit).toHaveBeenCalled()
    expect(commerceServices.orders.submit).toHaveBeenCalledWith(expect.objectContaining({
      remark: '周五前发货',
      items: [
        expect.objectContaining({
          cartItemId: 'cart-1',
          skuId: 'sku-1',
          qty: 2
        })
      ]
    }))
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

    fireEvent.click(screen.getByText('提交订单'))
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

    fireEvent.click(screen.getByText('提交订单'))
    await act(async () => {
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({ title: '订单已提交，待确认支付', icon: 'none' })
    expect(navigateTo).toHaveBeenCalledWith('/pages/order/detail/index?id=order-1001')
  })
})
