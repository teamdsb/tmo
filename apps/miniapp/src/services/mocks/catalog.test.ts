import { formatSkuSpec, validateProductSpecs } from '@tmo/shared'
import { buildMockProductDetail, mockProductDetails, mockProducts } from './catalog'

describe('mock catalog fixtures', () => {
  it('includes at least 10 fastener products', () => {
    const fasteners = mockProducts.filter((item) => item.categoryId === 'fasteners')
    expect(fasteners.length).toBeGreaterThanOrEqual(10)
  })

  it('builds detail and active sku data for fastener products', () => {
    const fasteners = mockProducts.filter((item) => item.categoryId === 'fasteners')

    for (const product of fasteners) {
      const detail = buildMockProductDetail(product.id)
      expect(detail).not.toBeNull()
      expect(detail?.product.categoryId).toBe('fasteners')
      expect(detail?.skus.length).toBeGreaterThan(0)

      for (const sku of detail?.skus ?? []) {
        expect(sku.isActive).toBe(true)
        const priceTiers = sku.priceTiers ?? []
        expect(priceTiers.length).toBeGreaterThan(0)
        for (const tier of priceTiers) {
          expect(tier.minQty).toBeGreaterThanOrEqual(1)
          expect(tier.unitPriceFen).toBeGreaterThan(0)
        }
      }
    }
  })

  it('exposes known fastener detail in the generated detail map', () => {
    expect(mockProductDetails['spu-bolt-a2']).toBeDefined()
    expect(mockProductDetails['spu-bolt-a2'].skus.some((sku) => sku.id === 'sku-bolt-a2-m8')).toBe(true)
  })
  it('provides a valid three-level fixture shared with admin', () => {
    const detail = buildMockProductDetail('spu-bolt-a2')!
    expect(detail.product.filterDimensions).toEqual(['材质', '长度', '直径'])
    expect(validateProductSpecs(detail.product.filterDimensions, detail.skus)).toEqual([])
    expect(formatSkuSpec(detail.product.filterDimensions, detail.skus[0])).toBe('A2-70 / 30mm / M8')
  })

})
