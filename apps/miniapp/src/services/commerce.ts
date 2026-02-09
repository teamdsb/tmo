import { createCommerceServices, type CommerceServices } from '@tmo/commerce-services'
import type {
  Category,
  CreateCatalogProductRequest,
  CreateCategoryRequest,
  ProductDetail,
  ProductSummary,
  UpdateCatalogProductRequest,
  UpdateCategoryRequest
} from '@tmo/api-client'
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
  getCategory: async (categoryId: string): Promise<Category> => {
    try {
      return await catalog.getCategory(categoryId)
    } catch (error) {
      console.warn('catalog getCategory failed, fallback to mock', error)
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw error
      }
      return found
    }
  },
  createCategory: async (payload: CreateCategoryRequest): Promise<Category> => {
    try {
      return await catalog.createCategory(payload)
    } catch (error) {
      console.warn('catalog createCategory failed, fallback to mock', error)
      return {
        id: `mock-${Date.now()}`,
        name: payload.name,
        parentId: payload.parentId ?? null,
        sort: payload.sort ?? 0
      }
    }
  },
  updateCategory: async (categoryId: string, payload: UpdateCategoryRequest): Promise<Category> => {
    try {
      return await catalog.updateCategory(categoryId, payload)
    } catch (error) {
      console.warn('catalog updateCategory failed, fallback to mock', error)
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw error
      }
      return {
        id: found.id,
        name: payload.name ?? found.name,
        parentId: payload.parentId === undefined ? (found.parentId ?? null) : payload.parentId,
        sort: payload.sort ?? found.sort
      }
    }
  },
  deleteCategory: async (categoryId: string): Promise<void> => {
    try {
      await catalog.deleteCategory(categoryId)
    } catch (error) {
      console.warn('catalog deleteCategory failed, fallback to mock', error)
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
  createProduct: async (payload: CreateCatalogProductRequest): Promise<ProductDetail> => {
    try {
      return await catalog.createProduct(payload)
    } catch (error) {
      console.warn('catalog createProduct failed, fallback to mock', error)
      const detail = buildMockProductDetail(`mock-${Date.now()}`)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name,
          categoryId: payload.categoryId,
          description: payload.description ?? detail.product.description,
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
  },
  updateProduct: async (spuId: string, payload: UpdateCatalogProductRequest): Promise<ProductDetail> => {
    try {
      return await catalog.updateProduct(spuId, payload)
    } catch (error) {
      console.warn('catalog updateProduct failed, fallback to mock', error)
      const detail = mockProductDetails[spuId] ?? buildMockProductDetail(spuId)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name ?? detail.product.name,
          categoryId: payload.categoryId ?? detail.product.categoryId,
          description: payload.description === undefined ? detail.product.description : payload.description,
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
  },
  deleteProduct: async (spuId: string): Promise<void> => {
    try {
      await catalog.deleteProduct(spuId)
    } catch (error) {
      console.warn('catalog deleteProduct failed, fallback to mock', error)
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
