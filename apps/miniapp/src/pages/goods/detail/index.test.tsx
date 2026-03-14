import fs from 'node:fs'
import path from 'node:path'
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
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-1',
        name: '高精度工业控制阀',
        categoryId: 'industrial',
        images: [],
        description: '高精度工业控制阀专为复杂工况设计，支持稳定调节与长期运行。'
      },
      skus: [
        {
          id: 'sku-carbon',
          spuId: 'spu-1',
          name: '碳钢',
          spec: '碳钢',
          isActive: true,
          priceTiers: []
        },
        {
          id: 'sku-75mm',
          spuId: 'spu-1',
          name: '75mm',
          spec: '75mm',
          isActive: true,
          priceTiers: []
        }
      ]
    } as any)

    render(<ProductDetail />)

    expect((await screen.findAllByText('高精度工业控制阀')).length).toBeGreaterThan(0)
    expect(screen.getByText('询价')).toBeInTheDocument()
    expect(screen.getByText('最低起订单价')).toBeInTheDocument()
    expect(screen.getByText('标准配送')).toBeInTheDocument()
    expect(screen.getByText('采购量越高单价越低')).toBeInTheDocument()
    expect(screen.getByText('购买数量')).toBeInTheDocument()
    expect(screen.getByText('产品详情')).toBeInTheDocument()
    expect(screen.getAllByText(/高精度工业控制阀专为复杂工况设计/i).length).toBeGreaterThan(0)
    expect(screen.queryByText('属性')).not.toBeInTheDocument()
  })


  it('applies shared long-text protection to detail title and tier cards', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-long',
        name: 'Detail Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890无空格超长标题用于验证详情页标题换行稳定性',
        categoryId: 'industrial',
        images: [],
        description: 'test'
      },
      skus: [
        {
          id: 'sku-long',
          spuId: 'spu-long',
          name: '默认规格',
          spec: '默认规格',
          isActive: true,
          priceTiers: [{ minQty: 123456789, maxQty: null, unitPriceFen: 20000 }]
        }
      ]
    } as any)

    render(<ProductDetail />)

    const title = (await screen.findAllByText(/Detail Product ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/)).find((element) => element.className.includes('product-title'))
    const tierRange = await screen.findByText('123456789+')

    expect(title).toBeDefined()
    expect(title).toHaveClass('u-safe-title-2')
    expect(tierRange).toHaveClass('u-safe-title-2')
  })

  it('keeps shared long-text utility definitions in app stylesheet', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../../app.scss'), 'utf8')

    expect(stylesheet).toContain('.u-safe-title-2')
    expect(stylesheet).toContain('.tier-card-range')
    expect(stylesheet).toContain('.product-title')
  })

  it('shows the lowest starting price in the header', async () => {
    render(<ProductDetail />)

    expect(await screen.findByText('¥185.00 起')).toBeInTheDocument()
    expect(screen.getByText('最低起订单价')).toBeInTheDocument()
  })

  it('updates sku selection and preserves header starting price', async () => {
    render(<ProductDetail />)

    const sizeLabel = await screen.findByText('75mm')
    const sizeButton = sizeLabel.closest('button')
    expect(sizeButton).not.toBeNull()

    if (!sizeButton) {
      throw new Error('Expected sku button')
    }
    fireEvent.click(sizeButton)

    expect(screen.getByText('¥185.00 起')).toBeInTheDocument()
    expect(sizeButton).toHaveClass('product-sku-button--selected')
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

  it('renders hero image card and bottom actions', async () => {
    render(<ProductDetail />)

    await screen.findByText('¥185.00 起')

    expect(document.querySelector('.detail-hero-card')).not.toBeNull()
    expect(document.querySelector('.detail-action-bar')).not.toBeNull()
    expect(screen.getByText('议价')).toBeInTheDocument()
    expect(screen.getByText('加入购物车')).toBeInTheDocument()
  })

  it('keeps placeholder image available in hero area when product images are empty', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-empty-image',
        name: '无图商品',
        categoryId: 'industrial',
        images: [],
        description: '无图兜底'
      },
      skus: [
        {
          id: 'sku-default',
          spuId: 'spu-empty-image',
          name: '默认规格',
          spec: '默认规格',
          isActive: true,
          priceTiers: [{ minQty: 1, maxQty: null, unitPriceFen: 1200 }]
        }
      ]
    } as any)

    render(<ProductDetail />)
    expect((await screen.findAllByText('无图商品')).length).toBeGreaterThan(0)

    const heroImage = document.querySelector('.detail-hero-frame img')
    expect(heroImage).not.toBeNull()
  })
})
