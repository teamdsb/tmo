import {
  deleteWishlistSkuId,
  getWishlist,
  postWishlist,
  type WishlistItem
} from '@tmo/api-client'

export interface WishlistService {
  list: () => Promise<WishlistItem[]>
  add: (skuId: string) => Promise<void>
  remove: (skuId: string) => Promise<void>
}

export const createWishlistService = (): WishlistService => {
  return {
    list: async () => (await getWishlist()).data.items ?? [],
    add: async (skuId) => {
      await postWishlist({ skuId })
    },
    remove: async (skuId) => {
      await deleteWishlistSkuId(skuId)
    }
  }
}
