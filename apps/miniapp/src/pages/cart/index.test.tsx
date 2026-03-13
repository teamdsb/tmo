import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import ExcelImportConfirmation from './index'
import { commerceServices } from '../../services/commerce'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const renderCart = async () => {
  render(<ExcelImportConfirmation />)
  await act(async () => {
    await flushPromises()
  })
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

describe('ExcelImportConfirmation', () => {
  it('renders cart summary and items', async () => {
    await renderCart()

    const navbar = document.querySelector('.app-navbar.app-navbar--primary')
    expect(navbar).not.toBeNull()

    expect((await screen.findAllByText('示例螺栓')).length).toBeGreaterThan(0)
    expect(screen.getByText('参考单价')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows the cart action buttons', async () => {
    await renderCart()

    expect(screen.getByText('小计')).toBeInTheDocument()
    expect(screen.getByText('立即购物')).toBeInTheDocument()
    expect(screen.getByText('去结算')).toBeInTheDocument()
  })

  it('shows a single empty-state title and count summary when cart is empty', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({ items: [] })

    await renderCart()

    expect(screen.getByText('购物车共有 0 件商品')).toBeInTheDocument()
    expect(screen.getByText('¥0.00')).toBeInTheDocument()
    expect(screen.getByText('您的购物车是空的')).toBeInTheDocument()
    expect(screen.getByText('看来您还没有添加任何商品。快去探索我们的最新系列吧。')).toBeInTheDocument()
  })

  it('prefers product name from product detail for cart item title', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    const getProductDetailSpy = jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: []
    } as any)

    await renderCart()

    expect(await screen.findByText('不锈钢六角螺栓 A2')).toBeInTheDocument()
    expect(screen.getByText('M8 x 30 • SKU BOLT-M8-30')).toBeInTheDocument()
    expect(getProductDetailSpy).toHaveBeenCalledWith('spu-bolt-a2')
  })

  it('falls back to sku name when product detail request fails', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockRejectedValueOnce(new Error('offline'))

    await renderCart()

    expect((await screen.findAllByText('M8 x 30')).length).toBeGreaterThan(0)
    expect(screen.getByText('M8 x 30 • SKU BOLT-M8-30')).toBeInTheDocument()
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('loads product detail by unique spuId for cart items', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        },
        {
          id: 'cart-2',
          qty: 1,
          sku: {
            spuId: 'spu-bolt-a2',
            name: 'M8 x 40',
            spec: 'M8 x 40',
            skuCode: 'BOLT-M8-40'
          }
        }
      ]
    } as any)
    const getProductDetailSpy = jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: []
    } as any)

    await renderCart()

    await screen.findAllByText('不锈钢六角螺栓 A2')
    await waitFor(() => {
      expect(getProductDetailSpy).toHaveBeenCalled()
    })
    const requestedSpuIds = getProductDetailSpy.mock.calls.map((call) => call[0])
    expect(requestedSpuIds.every((spuId) => spuId === 'spu-bolt-a2')).toBe(true)
  })

  it('navigates to product detail when clicking cart item content', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-bolt-a2-m8',
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: []
    } as any)
    const navigateToMock = Taro.navigateTo as jest.Mock
    navigateToMock.mockClear()

    await renderCart()
    fireEvent.click(await screen.findByText('不锈钢六角螺栓 A2'))

    expect(navigateToMock).toHaveBeenCalledWith({ url: '/pages/goods/detail/index?id=spu-bolt-a2' })
  })

  it('does not navigate when clicking cart item controls', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-bolt-a2-m8',
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: [
        { id: 'sku-bolt-a2-m8', spuId: 'spu-bolt-a2', name: 'M8 x 30', spec: 'M8 x 30', isActive: true },
        { id: 'sku-bolt-a2-m10', spuId: 'spu-bolt-a2', name: 'M10 x 40', spec: 'M10 x 40', isActive: true }
      ]
    } as any)
    jest.spyOn(commerceServices.cart, 'updateItemQty').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 3,
          sku: {
            id: 'sku-bolt-a2-m8',
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    const navigateToMock = Taro.navigateTo as jest.Mock
    navigateToMock.mockClear()

    await renderCart()
    fireEvent.click(screen.getByText('+'))

    await waitFor(() => {
      expect(navigateToMock).not.toHaveBeenCalled()
    })
  })

  it('shows toast instead of navigating when cart item has no spuId', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-bolt-a2-m8',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    const navigateToMock = Taro.navigateTo as jest.Mock
    const showToastMock = Taro.showToast as jest.Mock
    navigateToMock.mockClear()
    showToastMock.mockClear()

    await renderCart()
    fireEvent.click(screen.getAllByText('M8 x 30')[0])

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith({ title: '商品详情暂不可用', icon: 'none' })
    })
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('switches unit price and cart total when qty enters a new price tier', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-tiered',
            spuId: 'spu-tiered',
            name: '默认规格',
            spec: '默认规格',
            priceTiers: [
              { minQty: 1, maxQty: 2, unitPriceFen: 20000 },
              { minQty: 3, maxQty: 5, unitPriceFen: 18000 },
              { minQty: 6, maxQty: null, unitPriceFen: 16000 }
            ]
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.cart, 'updateItemQty').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 3,
          sku: {
            id: 'sku-tiered',
            spuId: 'spu-tiered',
            name: '默认规格',
            spec: '默认规格',
            priceTiers: [
              { minQty: 1, maxQty: 2, unitPriceFen: 20000 },
              { minQty: 3, maxQty: 5, unitPriceFen: 18000 },
              { minQty: 6, maxQty: null, unitPriceFen: 16000 }
            ]
          }
        }
      ]
    } as any)

    await renderCart()
    expect(screen.getByText('¥200.00')).toBeInTheDocument()
    expect(screen.getByText('¥400.00')).toBeInTheDocument()

    fireEvent.click(screen.getByText('+'))

    expect(await screen.findByText('¥180.00')).toBeInTheDocument()
    expect(screen.getByText('¥540.00')).toBeInTheDocument()
  })

  it('shows pending quote when qty does not match any price tier', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 1,
          sku: {
            id: 'sku-tier-gap',
            spuId: 'spu-tier-gap',
            name: '默认规格',
            spec: '默认规格',
            priceTiers: [
              { minQty: 1, maxQty: 1, unitPriceFen: 20000 },
              { minQty: 3, maxQty: null, unitPriceFen: 16000 }
            ]
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.cart, 'updateItemQty').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-tier-gap',
            spuId: 'spu-tier-gap',
            name: '默认规格',
            spec: '默认规格',
            priceTiers: [
              { minQty: 1, maxQty: 1, unitPriceFen: 20000 },
              { minQty: 3, maxQty: null, unitPriceFen: 16000 }
            ]
          }
        }
      ]
    } as any)

    await renderCart()
    expect(screen.getAllByText('¥200.00')).toHaveLength(2)

    fireEvent.click(screen.getByText('+'))

    expect(await screen.findByText('询价')).toBeInTheDocument()
    expect(screen.getByText('待确认报价')).toBeInTheDocument()
  })

  it('updates cart item qty when click plus', async () => {
    const updateItemQtySpy = jest
      .spyOn(commerceServices.cart, 'updateItemQty')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-1',
            qty: 3,
            sku: { name: '示例螺栓' }
          }
        ]
      } as any)

    await renderCart()
    fireEvent.click(screen.getByText('+'))

    expect(updateItemQtySpy).toHaveBeenCalledWith('cart-1', 3)
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('supports quick qty change through action sheet', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 2,
          sku: {
            id: 'sku-bolt-a2-m8',
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    const updateItemQtySpy = jest.spyOn(commerceServices.cart, 'updateItemQty').mockResolvedValueOnce({
      items: [
        {
          id: 'cart-1',
          qty: 10,
          sku: {
            id: 'sku-bolt-a2-m8',
            spuId: 'spu-bolt-a2',
            name: 'M8 x 30',
            spec: 'M8 x 30',
            skuCode: 'BOLT-M8-30'
          }
        }
      ]
    } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: [
        { id: 'sku-bolt-a2-m8', spuId: 'spu-bolt-a2', name: 'M8 x 30', spec: 'M8 x 30', isActive: true }
      ]
    } as any)
    jest.spyOn(Taro, 'showActionSheet').mockResolvedValueOnce({ tapIndex: 3 } as any)

    await renderCart()
    fireEvent.click(screen.getByText('2'))

    await waitFor(() => {
      expect(updateItemQtySpy).toHaveBeenCalledWith('cart-1', 10)
    })
  })

  it('changes sku in cart and keeps quantity', async () => {
    jest.spyOn(commerceServices.cart, 'getCart')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-1',
            qty: 2,
            sku: {
              id: 'sku-bolt-a2-m8',
              spuId: 'spu-bolt-a2',
              name: 'M8 x 30',
              spec: 'M8 x 30',
              skuCode: 'BOLT-M8-30'
            }
          }
        ]
      } as any)
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-2',
            qty: 2,
            sku: {
              id: 'sku-bolt-a2-m10',
              spuId: 'spu-bolt-a2',
              name: 'M10 x 40',
              spec: 'M10 x 40',
              skuCode: 'BOLT-M10-40'
            }
          }
        ]
      } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: [
        { id: 'sku-bolt-a2-m8', spuId: 'spu-bolt-a2', name: 'M8 x 30', spec: 'M8 x 30', isActive: true },
        { id: 'sku-bolt-a2-m10', spuId: 'spu-bolt-a2', name: 'M10 x 40', spec: 'M10 x 40', isActive: true }
      ]
    } as any)
    const removeItemSpy = jest.spyOn(commerceServices.cart, 'removeItem').mockResolvedValueOnce()
    const addItemSpy = jest.spyOn(commerceServices.cart, 'addItem').mockResolvedValueOnce({ items: [] } as any)
    jest.spyOn(Taro, 'showActionSheet').mockResolvedValueOnce({ tapIndex: 1 } as any)

    await renderCart()
    fireEvent.click(screen.getByText('规格'))

    await waitFor(() => {
      expect(removeItemSpy).toHaveBeenCalledWith('cart-1')
      expect(addItemSpy).toHaveBeenCalledWith('sku-bolt-a2-m10', 2)
    })
    expect(await screen.findByText('M10 x 40')).toBeInTheDocument()
  })

  it('merges quantity when changing to existing sku', async () => {
    jest.spyOn(commerceServices.cart, 'getCart')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-1',
            qty: 2,
            sku: {
              id: 'sku-bolt-a2-m8',
              spuId: 'spu-bolt-a2',
              name: 'M8 x 30',
              spec: 'M8 x 30',
              skuCode: 'BOLT-M8-30'
            }
          },
          {
            id: 'cart-2',
            qty: 1,
            sku: {
              id: 'sku-bolt-a2-m10',
              spuId: 'spu-bolt-a2',
              name: 'M10 x 40',
              spec: 'M10 x 40',
              skuCode: 'BOLT-M10-40'
            }
          }
        ]
      } as any)
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-2',
            qty: 3,
            sku: {
              id: 'sku-bolt-a2-m10',
              spuId: 'spu-bolt-a2',
              name: 'M10 x 40',
              spec: 'M10 x 40',
              skuCode: 'BOLT-M10-40'
            }
          }
        ]
      } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: [
        { id: 'sku-bolt-a2-m8', spuId: 'spu-bolt-a2', name: 'M8 x 30', spec: 'M8 x 30', isActive: true },
        { id: 'sku-bolt-a2-m10', spuId: 'spu-bolt-a2', name: 'M10 x 40', spec: 'M10 x 40', isActive: true }
      ]
    } as any)
    jest.spyOn(commerceServices.cart, 'removeItem').mockResolvedValueOnce()
    jest.spyOn(commerceServices.cart, 'addItem').mockResolvedValueOnce({ items: [] } as any)
    jest.spyOn(Taro, 'showActionSheet').mockResolvedValueOnce({ tapIndex: 1 } as any)

    await renderCart()
    fireEvent.click(screen.getAllByText('规格')[0])

    expect(await screen.findByText('购物车共有 1 件商品')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('removes cart item from card action', async () => {
    const removeItemSpy = jest.spyOn(commerceServices.cart, 'removeItem').mockResolvedValueOnce()
    jest.spyOn(commerceServices.cart, 'getCart')
      .mockResolvedValueOnce({
        items: [
          {
            id: 'cart-1',
            qty: 2,
            sku: {
              id: 'sku-bolt-a2-m8',
              spuId: 'spu-bolt-a2',
              name: 'M8 x 30',
              spec: 'M8 x 30',
              skuCode: 'BOLT-M8-30'
            }
          }
        ]
      } as any)
      .mockResolvedValueOnce({ items: [] } as any)
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        categoryId: 'cat-fasteners'
      },
      skus: [
        { id: 'sku-bolt-a2-m8', spuId: 'spu-bolt-a2', name: 'M8 x 30', spec: 'M8 x 30', isActive: true }
      ]
    } as any)

    await renderCart()
    fireEvent.click(screen.getByText('移除'))

    await waitFor(() => {
      expect(removeItemSpy).toHaveBeenCalledWith('cart-1')
    })
    expect(await screen.findByText('您的购物车是空的')).toBeInTheDocument()
  })
})
