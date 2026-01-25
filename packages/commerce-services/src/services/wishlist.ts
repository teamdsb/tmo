import {
  deleteWishlistSkuId,
  getWishlist,
  postWishlist,
  type GetWishlist200
} from '@tmo/api-client'

export interface WishlistService {
  get: () => Promise<GetWishlist200>
  add: (skuId: string) => Promise<void>
  remove: (skuId: string) => Promise<void>
}

export const createWishlistService = (): WishlistService => {
  return {
    get: async () => (await getWishlist()).data,
    add: async (skuId) => {
      await postWishlist({ skuId })
    },
    remove: async (skuId) => {
      await deleteWishlistSkuId(skuId)
    }
  }
}
