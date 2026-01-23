import {
  deleteCartItemsItemId,
  getCart,
  getCartImportJobsJobId,
  patchCartItemsItemId,
  postCartImportJobsJobIdConfirm,
  postCartItems,
  type Cart,
  type CartImportJob,
  type CartImportSelection
} from '@tmo/api-client'

import type { UploadClient } from '../uploads'

export interface CartService {
  getCart: () => Promise<Cart>
  addItem: (skuId: string, qty: number) => Promise<Cart>
  updateItemQty: (itemId: string, qty: number) => Promise<Cart>
  removeItem: (itemId: string) => Promise<void>
  uploadImportExcel: (filePath: string) => Promise<CartImportJob>
  getImportJob: (jobId: string) => Promise<CartImportJob>
  confirmImport: (jobId: string, selections: CartImportSelection[]) => Promise<Cart>
}

export const createCartService = (uploadClient: UploadClient): CartService => {
  return {
    getCart: async () => (await getCart()).data,
    addItem: async (skuId, qty) => (await postCartItems({ skuId, qty })).data,
    updateItemQty: async (itemId, qty) => (await patchCartItemsItemId(itemId, { qty })).data,
    removeItem: async (itemId) => {
      await deleteCartItemsItemId(itemId)
    },
    uploadImportExcel: async (filePath) => {
      return uploadClient.upload<CartImportJob>('/cart/import-jobs', filePath, 'file')
    },
    getImportJob: async (jobId) => (await getCartImportJobsJobId(jobId)).data,
    confirmImport: async (jobId, selections) => (await postCartImportJobsJobIdConfirm(jobId, { selections })).data
  }
}
