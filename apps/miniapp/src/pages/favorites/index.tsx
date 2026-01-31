import { useCallback, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Empty from '@taroify/core/empty'
import Tag from '@taroify/core/tag'
import type { WishlistItem, PriceTier } from '@tmo/api-client'
import { ROUTES, goodsDetailRoute } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { ensureLoggedIn } from '../../utils/auth'
import { commerceServices } from '../../services/commerce'

export default function FavoritesPage() {
  const navbarStyle = getNavbarStyle()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadWishlist = useCallback(async () => {
    setLoading(true)
    try {
      const allowed = await ensureLoggedIn({ redirect: true })
      if (!allowed) return
      const list = await commerceServices.wishlist.list()
      setItems(list)
    } catch (error) {
      console.warn('load wishlist failed', error)
      await Taro.showToast({ title: 'Failed to load favorites', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))
  }

  useDidShow(() => {
    void loadWishlist()
  })

  const handleRemove = async (skuId: string) => {
    try {
      await commerceServices.wishlist.remove(skuId)
      setItems((prev) => prev.filter((item) => item.sku.id !== skuId))
      await Taro.showToast({ title: 'Removed', icon: 'none' })
    } catch (error) {
      console.warn('remove wishlist failed', error)
      await Taro.showToast({ title: 'Remove failed', icon: 'none' })
    }
  }

  const handleAddToCart = async (skuId: string) => {
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    try {
      await commerceServices.cart.addItem(skuId, 1)
      await Taro.showToast({ title: 'Added to cart', icon: 'success' })
    } catch (error) {
      console.warn('add to cart failed', error)
      await Taro.showToast({ title: 'Add to cart failed', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>Favorites</Navbar.Title>
        <Navbar.NavRight>
          <Text className='text-xs text-slate-400'>
            {loading ? 'Loading...' : `${items.length} items`}
          </Text>
        </Navbar.NavRight>
      </Navbar>
      <View className='page-content'>
        {items.length === 0 ? (
          <Empty>
            <Empty.Image src='default' />
            <Empty.Description>
              {loading ? 'Loading favorites...' : 'No favorites yet. Save items to revisit later.'}
            </Empty.Description>
          </Empty>
        ) : (
          <View className='grid grid-cols-1 gap-4'>
            {items.map((item) => {
              const primaryTier = item.sku.priceTiers?.[0]
              return (
                <View
                  key={item.sku.id}
                  className='bg-white rounded-2xl border border-slate-100 p-4 shadow-sm'
                >
                  <View className='flex items-start justify-between gap-4'>
                    <View className='flex-1 min-w-0'>
                      <Text className='text-sm font-semibold text-slate-900 truncate'>
                        {item.sku.name}
                      </Text>
                      <Text className='text-xs text-slate-400 truncate'>
                        {item.sku.spec || 'Standard spec'}
                      </Text>
                    </View>
                    <Tag size='small' variant='outlined' color='primary'>
                      {primaryTier ? formatTierLabel(primaryTier) : 'Quote'}
                    </Tag>
                  </View>

                  <View className='mt-3 flex items-center justify-between'>
                    <Button
                      size='small'
                      variant='outlined'
                      onClick={() => navigateTo(goodsDetailRoute(item.sku.spuId))}
                    >
                      View
                    </Button>
                    <View className='flex items-center gap-2'>
                      <Button
                        size='small'
                        variant='outlined'
                        onClick={() => void handleRemove(item.sku.id)}
                      >
                        Remove
                      </Button>
                      <Button
                        size='small'
                        color='primary'
                        onClick={() => void handleAddToCart(item.sku.id)}
                      >
                        Add to Cart
                      </Button>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}

const formatTierLabel = (tier: PriceTier) => {
  if (tier.maxQty === null || tier.maxQty === undefined) {
    return `${tier.minQty}+`
  }
  return `${tier.minQty}-${tier.maxQty}`
}
