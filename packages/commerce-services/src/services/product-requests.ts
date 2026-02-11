import {
  getProductRequests,
  postProductRequests,
  type ProductRequestAsset,
  type CreateProductRequest,
  type GetProductRequestsParams,
  type PagedProductRequestList,
  type ProductRequest
} from '@tmo/api-client'

import type { UploadClient } from '../uploads'

export interface ProductRequestService {
  list: (params?: GetProductRequestsParams) => Promise<PagedProductRequestList>
  create: (payload: CreateProductRequest) => Promise<ProductRequest>
  uploadAsset: (filePath: string) => Promise<ProductRequestAsset>
}

export const createProductRequestService = (uploadClient: UploadClient): ProductRequestService => {
  return {
    list: async (params) => (await getProductRequests(params)).data,
    create: async (payload) => (await postProductRequests(payload)).data,
    uploadAsset: async (filePath) => uploadClient.upload<ProductRequestAsset>('/product-requests/assets', filePath, 'file')
  }
}
