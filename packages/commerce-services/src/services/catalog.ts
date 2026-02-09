import {
  deleteCatalogCategoriesCategoryId,
  getCatalogCategories,
  getCatalogCategoriesCategoryId,
  getCatalogProducts,
  getCatalogProductsSpuId,
  patchCatalogCategoriesCategoryId,
  postCatalogCategories,
  type Category,
  type CreateCategoryRequest,
  type GetCatalogCategories200,
  type GetCatalogProductsParams,
  type PagedProductList,
  type ProductDetail,
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
  getProductDetail: (spuId: string) => Promise<ProductDetail>
}

export const createCatalogService = (): CatalogService => {
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
    getProductDetail: (spuId) => withRetry(async () => (await getCatalogProductsSpuId(spuId)).data)
  }
}
