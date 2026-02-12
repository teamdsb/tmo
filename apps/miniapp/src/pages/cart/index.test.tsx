import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  jest.restoreAllMocks()
})

describe('ExcelImportConfirmation', () => {
  it('renders cart summary and items', async () => {
    await renderCart()

    const navbar = document.querySelector('.app-navbar.app-navbar--primary')
    expect(navbar).not.toBeNull()

    expect(await screen.findByText('示例螺栓')).toBeInTheDocument()
    expect(screen.getByText('数量')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows the cart action buttons', async () => {
    await renderCart()

    expect(screen.getByText('继续浏览')).toBeInTheDocument()
    expect(screen.getByText('去结算')).toBeInTheDocument()
  })

  it('shows a single empty-state title and count summary when cart is empty', async () => {
    jest.spyOn(commerceServices.cart, 'getCart').mockResolvedValueOnce({ items: [] })

    await renderCart()

    expect(screen.getByText('共 0 件')).toBeInTheDocument()
    expect(screen.getAllByText('购物车为空')).toHaveLength(1)
    expect(screen.getByText('先去首页挑选商品吧')).toBeInTheDocument()
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

    expect(await screen.findByText('M8 x 30')).toBeInTheDocument()
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
})
