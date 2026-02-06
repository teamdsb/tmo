import { createCommerceServices, type CommerceServices } from '@tmo/commerce-services'
import type { Category, ProductDetail, ProductSummary } from '@tmo/api-client'
import { buildMockProductDetail, mockCategories, mockProductDetails, mockProducts } from './mocks/catalog'

// 小程序运行时没有 Node.js process，全局读取必须做守卫。
const readEnv = (name: string): string | undefined => {
  if (typeof process === 'undefined' || !process?.env) {
    return undefined
  }
  return process.env[name]
}

const shouldFallbackToMock = (): boolean => {
  const raw = readEnv('TARO_APP_COMMERCE_MOCK_FALLBACK')
  const value = raw ? raw.trim().toLowerCase() : ''
  if (value === '') {
    return true
  }
  if (value === 'false' || value === '0' || value === 'off' || value === 'no') {
    return false
  }
  return true
}

const applyQuery = (items: ProductSummary[], query?: string) => {
  if (!query) return items
  const keyword = query.trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) => item.name.toLowerCase().includes(keyword)
    || item.id.toLowerCase().includes(keyword))
}

const paginate = (items: ProductSummary[], page?: number, pageSize?: number) => {
  const safePage = page && page > 0 ? page : 1
  const safeSize = pageSize && pageSize > 0 ? pageSize : items.length || 1
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize
  }
}

const createMockedCatalog = (catalog: CommerceServices['catalog']) => ({
  listCategories: async (): Promise<{ items: Category[] }> => {
    try {
      return await catalog.listCategories()
    } catch (error) {
      console.warn('catalog listCategories failed, fallback to mock', error)
      return { items: mockCategories }
    }
  },
  listProducts: async (params?: { q?: string; categoryId?: string; page?: number; pageSize?: number }) => {
    try {
      return await catalog.listProducts(params)
    } catch (error) {
      console.warn('catalog listProducts failed, fallback to mock', error)
      const filtered = applyQuery(
        params?.categoryId
          ? mockProducts.filter((item) => item.categoryId === params.categoryId)
          : mockProducts,
        params?.q
      )
      return paginate(filtered, params?.page, params?.pageSize)
    }
  },
  getProductDetail: async (spuId: string): Promise<ProductDetail> => {
    try {
      return await catalog.getProductDetail(spuId)
    } catch (error) {
      console.warn('catalog getProductDetail failed, fallback to mock', error)
      const detail = mockProductDetails[spuId] ?? buildMockProductDetail(spuId)
      if (detail) return detail
      throw error
    }
  }
})

const createCommerceServicesWithFallback = (): CommerceServices => {
  const services = createCommerceServices()
  if (!shouldFallbackToMock()) {
    return services
  }
  return {
    ...services,
    catalog: createMockedCatalog(services.catalog)
  }
}

export const commerceServices = createCommerceServicesWithFallback()
