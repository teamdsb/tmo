import {
  getCatalogCategories,
  getCatalogProducts,
  getCatalogProductsSpuId,
  type GetCatalogCategories200,
  type GetCatalogProductsParams,
  type PagedProductList,
  type ProductDetail
} from '@tmo/api-client'

import { withRetry } from '../retry'

export interface CatalogService {
  listCategories: () => Promise<GetCatalogCategories200>
  listProducts: (params?: GetCatalogProductsParams) => Promise<PagedProductList>
  getProductDetail: (spuId: string) => Promise<ProductDetail>
}

export const createCatalogService = (): CatalogService => {
  return {
    listCategories: () => withRetry(async () => (await getCatalogCategories()).data),
    listProducts: (params) => withRetry(async () => (await getCatalogProducts(params)).data),
    getProductDetail: (spuId) => withRetry(async () => (await getCatalogProductsSpuId(spuId)).data)
  }
}
