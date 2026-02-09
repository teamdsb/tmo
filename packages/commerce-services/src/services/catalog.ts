import {
  deleteCatalogCategoriesCategoryId,
  deleteCatalogProductsSpuId,
  getCatalogCategories,
  getCatalogCategoriesCategoryId,
  getCatalogProducts,
  getCatalogProductsSpuId,
  patchCatalogCategoriesCategoryId,
  patchCatalogProductsSpuId,
  postCatalogCategories,
  postCatalogProducts,
  type Category,
  type CreateCatalogProductRequest,
  type CreateCategoryRequest,
  type GetCatalogCategories200,
  type GetCatalogProductsParams,
  type PagedProductList,
  type ProductDetail,
  type UpdateCatalogProductRequest,
  type UpdateCategoryRequest
} from '@tmo/api-client'

import { withRetry } from '../retry'

export interface CatalogService {
  listCategories: () => Promise<GetCatalogCategories200>
  getCategory: (categoryId: string) => Promise<Category>
  createCategory: (payload: CreateCategoryRequest) => Promise<Category>
  updateCategory: (categoryId: string, payload: UpdateCategoryRequest) => Promise<Category>
  deleteCategory: (categoryId: string) => Promise<void>
  listProducts: (params?: GetCatalogProductsParams) => Promise<PagedProductList>
  createProduct: (payload: CreateCatalogProductRequest) => Promise<ProductDetail>
  updateProduct: (spuId: string, payload: UpdateCatalogProductRequest) => Promise<ProductDetail>
  deleteProduct: (spuId: string) => Promise<void>
  getProductDetail: (spuId: string) => Promise<ProductDetail>
}

export const createCatalogService = (): CatalogService => {
  const ensureProductDetail = (data: ProductDetail | { message?: string }): ProductDetail => {
    if ('product' in data) {
      return data
    }
    throw new Error(data.message || 'failed to fetch product detail')
  }

  return {
    listCategories: () => withRetry(async () => (await getCatalogCategories()).data),
    getCategory: (categoryId) => withRetry(async () => {
      const data = (await getCatalogCategoriesCategoryId(categoryId)).data
      if ('id' in data) {
        return data
      }
      throw new Error(data.message || 'failed to fetch category')
    }),
    createCategory: (payload) => withRetry(async () => (await postCatalogCategories(payload)).data),
    updateCategory: (categoryId, payload) => withRetry(async () => (await patchCatalogCategoriesCategoryId(categoryId, payload)).data),
    deleteCategory: (categoryId) => withRetry(async () => {
      await deleteCatalogCategoriesCategoryId(categoryId)
    }),
    listProducts: (params) => withRetry(async () => (await getCatalogProducts(params)).data),
    createProduct: (payload) => withRetry(async () => {
      const data = (await postCatalogProducts(payload)).data
      return ensureProductDetail(data)
    }),
    updateProduct: (spuId, payload) => withRetry(async () => {
      const data = (await patchCatalogProductsSpuId(spuId, payload)).data
      return ensureProductDetail(data)
    }),
    deleteProduct: (spuId) => withRetry(async () => {
      await deleteCatalogProductsSpuId(spuId)
    }),
    getProductDetail: (spuId) => withRetry(async () => {
      const data = (await getCatalogProductsSpuId(spuId)).data
      return ensureProductDetail(data)
    })
  }
}
