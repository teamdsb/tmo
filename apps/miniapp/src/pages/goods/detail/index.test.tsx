import fs from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import ProductDetail from './index'
import { commerceServices } from '../../../services/commerce'
import { clearBootstrap, saveBootstrap } from '../../../services/bootstrap'
import { ROUTES } from '../../../routes'

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
    expect(screen.getByText('采购量越高单价越低')).toBeInTheDocument()
    expect(screen.getByText('购买数量')).toBeInTheDocument()
    expect(screen.getByText(/高精度工业控制阀专为复杂工况设计/i)).toBeInTheDocument()
    expect(screen.queryByText('属性')).not.toBeInTheDocument()
    expect(screen.queryByText('产品详情')).not.toBeInTheDocument()
    expect(screen.queryByText('标准配送')).not.toBeInTheDocument()
  })

  it('does not expose raw category ids above the product title', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-raw-category',
        name: '珍珠棉打包袋',
        categoryId: '16161616 / 1616 / 1616 / 1616 / 161616161616',
        images: [],
        description: 'test'
      },
      skus: []
    } as any)

    render(<ProductDetail />)

    expect((await screen.findAllByText('珍珠棉打包袋')).length).toBeGreaterThan(0)
    expect(screen.queryByText('16161616 / 1616 / 1616 / 1616 / 161616161616')).not.toBeInTheDocument()
    expect(document.querySelector('.detail-category-tag')).toBeNull()
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

  it('opens support chat with product inquiry intent when bargaining', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-1',
        name: '高精度工业控制阀',
        categoryId: 'industrial',
        images: [],
        description: 'test'
      },
      skus: [
        {
          id: 'sku-carbon',
          spuId: 'spu-1',
          name: '碳钢',
          spec: '碳钢',
          isActive: true,
          priceTiers: [{ minQty: 1, maxQty: 10, unitPriceFen: 18500 }]
        }
      ]
    } as any)

    render(<ProductDetail />)

    await screen.findByText('¥185.00 起')
    fireEvent.click(screen.getByText('议价'))

    await waitFor(() => {
      expect(Taro.setStorage).toHaveBeenCalledWith(expect.objectContaining({
        key: 'tmo:support:compose-intent',
        data: expect.objectContaining({
          kind: 'product_inquiry',
          productId: 'spu-1',
          productName: '高精度工业控制阀',
          message: '咨询报价：高精度工业控制阀'
        })
      }))
      expect(Taro.navigateTo).toHaveBeenCalledWith({ url: ROUTES.support })
    })
  })

  it('opens support chat for bargaining even when the product has no sku', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-no-sku',
        name: '珍珠棉打包袋',
        categoryId: 'packaging',
        images: [],
        description: '按需询价'
      },
      skus: []
    } as any)

    render(<ProductDetail />)

    expect((await screen.findAllByText('珍珠棉打包袋')).length).toBeGreaterThan(0)
    ;(Taro.setStorage as jest.Mock).mockClear()
    ;(Taro.navigateTo as jest.Mock).mockClear()
    fireEvent.click(screen.getByText('议价'))

    await waitFor(() => {
      expect(Taro.setStorage).toHaveBeenCalledWith(expect.objectContaining({
        key: 'tmo:support:compose-intent',
        data: expect.objectContaining({
          kind: 'product_inquiry',
          productId: 'spu-no-sku',
          productName: '珍珠棉打包袋',
          message: '咨询报价：珍珠棉打包袋'
        })
      }))
      expect(Taro.navigateTo).toHaveBeenCalledWith({ url: ROUTES.support })
    })
  })

  it('redirects to login before opening support when bargaining as guest', async () => {
    await clearBootstrap()
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-guest-inquiry',
        name: '访客议价商品',
        categoryId: 'packaging',
        images: [],
        description: '按需询价'
      },
      skus: []
    } as any)
    ;(Taro.navigateTo as jest.Mock).mockClear()
    ;(Taro.reLaunch as jest.Mock).mockClear()

    render(<ProductDetail />)

    expect((await screen.findAllByText('访客议价商品')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('议价'))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
        url: expect.stringContaining(ROUTES.authLogin)
      }))
    })
    expect(Taro.navigateTo).not.toHaveBeenCalledWith({ url: ROUTES.support })
  })

  it('still opens support chat when inquiry intent storage fails', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-intent-fails',
        name: '议价兜底商品',
        categoryId: 'packaging',
        images: [],
        description: '按需询价'
      },
      skus: []
    } as any)
    ;(Taro.setStorage as jest.Mock).mockRejectedValueOnce(new Error('storage failed'))

    render(<ProductDetail />)

    expect((await screen.findAllByText('议价兜底商品')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('议价'))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith({ url: ROUTES.support })
    })
  })

  it('uses coverImageUrl as the detail hero image when images are empty', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-cover-only',
        name: '只有封面图商品',
        categoryId: 'packaging',
        coverImageUrl: 'https://img.example.com/cover-only.png',
        images: [],
        description: '封面图兜底'
      },
      skus: []
    } as any)

    render(<ProductDetail />)
    expect((await screen.findAllByText('只有封面图商品')).length).toBeGreaterThan(0)

    const heroImage = document.querySelector('.detail-hero-frame img')
    expect(heroImage).toHaveAttribute('src', 'https://img.example.com/cover-only.png')

    const source = fs.readFileSync(path.resolve(__dirname, './index.tsx'), 'utf8')
    const stylesheet = fs.readFileSync(path.resolve(__dirname, './index.scss'), 'utf8')
    expect(source).toContain("wrapperClassName='detail-hero-image-wrapper'")
    expect(source).toContain("className='detail-hero-image-layer'")
    expect(stylesheet).toContain('.detail-hero-image-layer {')
    expect(stylesheet).toContain('position: absolute;')
    expect(stylesheet).toContain('inset: 0;')
    expect(stylesheet).toContain('.detail-hero-image-wrapper {')
    expect(stylesheet).toContain('height: 100%;')
  })

  it('renders a deduplicated swipe gallery and updates the active image counter', async () => {
    jest.spyOn(commerceServices.catalog, 'getProductDetail').mockResolvedValueOnce({
      product: {
        id: 'spu-gallery',
        name: '多图商品',
        categoryId: 'packaging',
        coverImageUrl: 'https://img.example.com/cover.png',
        images: [
          'https://img.example.com/cover.png',
          'https://img.example.com/detail-1.png',
          'https://img.example.com/detail-2.png'
        ],
        description: '多图展示'
      },
      skus: []
    } as any)

    render(<ProductDetail />)
    expect((await screen.findAllByText('多图商品')).length).toBeGreaterThan(0)

    const swiper = document.querySelector('.detail-hero-swiper')
    expect(swiper).not.toBeNull()
    expect(document.querySelectorAll('.detail-hero-slide')).toHaveLength(3)
    expect(screen.getByText('1/3')).toBeInTheDocument()

    fireEvent.click(swiper as Element)
    await waitFor(() => expect(screen.getByText('2/3')).toBeInTheDocument())
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
