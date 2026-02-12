import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProductDetail from './index'
import { commerceServices } from '../../../services/commerce'
import { clearBootstrap, saveBootstrap } from '../../../services/bootstrap'

const setRouterParams = (params: Record<string, string>) => {
  (globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

describe('ProductDetail', () => {
  beforeEach(async () => {
    setRouterParams({ id: 'spu-1' })
    await saveBootstrap({
      me: {
        id: 'test-user'
      }
    } as any)
  })

  afterEach(async () => {
    setRouterParams({})
    await clearBootstrap()
    jest.restoreAllMocks()
  })

  it('renders product information and shipping', async () => {
    render(<ProductDetail />)

    expect((await screen.findAllByText('高精度工业控制阀')).length).toBeGreaterThan(0)
    expect(screen.getByText('请选择规格')).toBeInTheDocument()
    expect(screen.getByText('标准配送')).toBeInTheDocument()
    expect(screen.getByText('采购量越高单价越低')).toBeInTheDocument()
    expect(screen.getByText('购买数量')).toBeInTheDocument()
  })

  it('updates sku selection and price', async () => {
    render(<ProductDetail />)

    const sizeLabel = await screen.findByText('75mm')
    const sizeButton = sizeLabel.closest('button')
    expect(sizeButton).not.toBeNull()

    if (!sizeButton) {
      throw new Error('Expected sku button')
    }
    fireEvent.click(sizeButton)

    expect(screen.getAllByText('¥200.00').length).toBeGreaterThan(0)
    expect(sizeButton).toHaveClass('bg-[#137fec]')
  })

  it('adds selected sku with chosen quantity', async () => {
    const addItemSpy = jest.spyOn(commerceServices.cart, 'addItem').mockResolvedValueOnce({ items: [] } as any)
    render(<ProductDetail />)

    const materialLabel = await screen.findByText('碳钢')
    const materialButton = materialLabel.closest('button')
    expect(materialButton).not.toBeNull()
    if (!materialButton) {
      throw new Error('Expected sku button')
    }
    fireEvent.click(materialButton)
    fireEvent.click(screen.getByText('+'))
    fireEvent.click(screen.getByText('+'))
    fireEvent.click(screen.getByText('加入购物车'))

    await waitFor(() => {
      expect(addItemSpy).toHaveBeenCalledWith('sku-carbon', 3)
    })
  })

  it('highlights matched price tier when quantity changes', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-tiered',
        name: '阶梯价测试商品',
        categoryId: 'industrial',
        images: [],
        description: 'test'
      },
      skus: [
        {
          id: 'sku-tiered',
          spuId: 'spu-tiered',
          name: '默认规格',
          spec: '默认规格',
          isActive: true,
          priceTiers: [
            { minQty: 1, maxQty: 2, unitPriceFen: 20000 },
            { minQty: 3, maxQty: 5, unitPriceFen: 18000 },
            { minQty: 6, maxQty: null, unitPriceFen: 16000 }
          ]
        }
      ]
    } as any)

    render(<ProductDetail />)
    const increaseButton = screen.getByText('+')
    const firstTierCard = (await screen.findByText('1-2')).closest('.tier-card')
    const secondTierCard = screen.getByText('3-5').closest('.tier-card')
    const thirdTierCard = screen.getByText('6+').closest('.tier-card')

    expect(firstTierCard).not.toBeNull()
    expect(secondTierCard).not.toBeNull()
    expect(thirdTierCard).not.toBeNull()

    if (!firstTierCard || !secondTierCard || !thirdTierCard) {
      throw new Error('Expected tier cards')
    }

    expect(firstTierCard).toHaveClass('tier-card-highlight')
    expect(secondTierCard).not.toHaveClass('tier-card-highlight')
    expect(thirdTierCard).not.toHaveClass('tier-card-highlight')

    fireEvent.click(increaseButton)
    fireEvent.click(increaseButton)
    await waitFor(() => {
      expect(secondTierCard).toHaveClass('tier-card-highlight')
    })

    fireEvent.click(increaseButton)
    fireEvent.click(increaseButton)
    fireEvent.click(increaseButton)
    await waitFor(() => {
      expect(thirdTierCard).toHaveClass('tier-card-highlight')
    })
  })
})
