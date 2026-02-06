import {
  getProductRequests,
  postProductRequests,
  type CreateProductRequest,
  type GetProductRequestsParams,
  type PagedProductRequestList,
  type ProductRequest
} from '@tmo/api-client'

export interface ProductRequestService {
  list: (params?: GetProductRequestsParams) => Promise<PagedProductRequestList>
  create: (payload: CreateProductRequest) => Promise<ProductRequest>
}

export const createProductRequestService = (): ProductRequestService => {
  return {
    list: async (params) => (await getProductRequests(params)).data,
    create: async (payload) => (await postProductRequests(payload)).data
  }
}
