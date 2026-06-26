import { render, screen } from '@testing-library/react'
import { useDidShow } from '@tarojs/taro'
import { commerceServices } from '../../services/commerce'
import FavoritesPage from './index'

jest.mock('../../utils/auth', () => ({
  ensureLoggedIn: jest.fn(async () => true)
}))

describe('FavoritesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    let didShowCalled = false
    ;(useDidShow as jest.Mock).mockImplementation((callback) => {
      if (!didShowCalled) {
        didShowCalled = true
        callback()
      }
    })
    ;(commerceServices.wishlist.list as jest.Mock).mockResolvedValue([
      {
        sku: {
          id: 'sku-bolt-a2-m8',
          spuId: 'spu-bolt-a2',
          skuCode: 'M8',
          name: 'M8 x 30',
          spec: 'M8 x 30 / A2-70',
          priceTiers: [{ minQty: 1, maxQty: 49, unitPriceFen: 158 }],
          isActive: true
        },
        createdAt: '2026-05-18T00:00:00Z'
      }
    ])
    ;(commerceServices.catalog.getProductDetail as jest.Mock).mockResolvedValue({
      product: {
        id: 'spu-bolt-a2',
        name: '不锈钢六角螺栓 A2',
        images: ['https://img.example.com/bolt.png'],
        categoryId: 'fasteners'
      },
      skus: []
    })
  })

  it('renders favorite product image, product name, and sku model details', async () => {
    render(<FavoritesPage />)

    expect(await screen.findByText('不锈钢六角螺栓 A2')).toBeInTheDocument()
    expect(screen.getByText('型号 M8 x 30')).toBeInTheDocument()
    expect(screen.getByText('M8 x 30 / A2-70')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img.example.com/bolt.png')
    expect(commerceServices.catalog.getProductDetail).toHaveBeenCalledWith('spu-bolt-a2')
  })
})
