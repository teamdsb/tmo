import { useCallback, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Empty from '@taroify/core/empty'
import Tag from '@taroify/core/tag'
import type { ProductDetail, WishlistItem, PriceTier } from '@tmo/api-client'
import { ROUTES, goodsDetailRoute } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { ensureLoggedIn } from '../../utils/auth'
import { commerceServices } from '../../services/commerce'
import SafeImage from '../../components/safe-image'
import './index.scss'

const QUICK_ADD_QTY_OPTIONS = [1, 2, 5, 10]

export default function FavoritesPage() {
  const navbarStyle = getNavbarStyle()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail>>({})
  const [loading, setLoading] = useState(false)

  const loadWishlist = useCallback(async () => {
    setLoading(true)
    try {
      const allowed = await ensureLoggedIn({ redirect: true })
      if (!allowed) return
      const list = await commerceServices.wishlist.list()
      setItems(list)
      const uniqueSpuIds = Array.from(new Set(list.map((item) => item.sku.spuId).filter(Boolean)))
      const detailEntries = await Promise.all(uniqueSpuIds.map(async (spuId) => {
        try {
          const detail = await commerceServices.catalog.getProductDetail(spuId)
          return [spuId, detail] as const
        } catch (error) {
          console.warn('load wishlist product detail failed', { spuId, error })
          return null
        }
      }))
      setProductDetails(Object.fromEntries(detailEntries.filter((entry): entry is readonly [string, ProductDetail] => Boolean(entry))))
    } catch (error) {
      console.warn('load wishlist failed', error)
      await Taro.showToast({ title: '加载收藏失败', icon: 'none' })
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
      await Taro.showToast({ title: '已移除', icon: 'none' })
    } catch (error) {
      console.warn('remove wishlist failed', error)
      await Taro.showToast({ title: '移除失败', icon: 'none' })
    }
  }

  const handleAddToCart = async (skuId: string) => {
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    let qty = 1
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: QUICK_ADD_QTY_OPTIONS.map((value) => `${value} 件`)
      })
      qty = QUICK_ADD_QTY_OPTIONS[tapIndex] ?? 1
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('choose qty failed', error)
      await Taro.showToast({ title: '数量选择失败', icon: 'none' })
      return
    }
    try {
      await commerceServices.cart.addItem(skuId, qty)
      await Taro.showToast({ title: `已加入购物车（${qty}）`, icon: 'success' })
    } catch (error) {
      console.warn('add to cart failed', error)
      await Taro.showToast({ title: '加入购物车失败', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>收藏</Navbar.Title>
        <Navbar.NavRight>
          <Text className='text-xs text-slate-400'>
            {loading ? '加载中...' : `${items.length} 件`}
          </Text>
        </Navbar.NavRight>
      </Navbar>
      <View className='page-content'>
        {items.length === 0 ? (
          <Empty>
            <Empty.Image src='default' />
            <Empty.Description>
              {loading ? '正在加载收藏...' : '暂无收藏，保存后方便再次查看。'}
            </Empty.Description>
          </Empty>
        ) : (
          <View className='favorites-list'>
            {items.map((item) => {
              const primaryTier = item.sku.priceTiers?.[0]
              const detail = productDetails[item.sku.spuId]
              const productName = detail?.product.name || item.sku.name
              const productImage = detail?.product.images?.find((image) => typeof image === 'string' && image.trim())
              const modelLabel = item.sku.name || item.sku.skuCode || '标准型号'
              const specLabel = item.sku.spec || item.sku.skuCode || item.sku.unit || '标准规格'
              return (
                <View
                  key={item.sku.id}
                  className='favorite-card'
                >
                  <View className='favorite-card-main'>
                    <View className='favorite-card-image-shell'>
                      <SafeImage
                        wrapperClassName='favorite-card-image-wrapper'
                        className='favorite-card-image'
                        src={productImage}
                        width='100%'
                        height='100%'
                        mode='aspectFill'
                      />
                    </View>
                    <View className='favorite-card-copy'>
                      <View className='favorite-card-heading'>
                        <Text className='favorite-card-title'>{productName}</Text>
                        <Tag size='small' variant='outlined' color='primary'>
                          {primaryTier ? formatTierLabel(primaryTier) : '报价'}
                        </Tag>
                      </View>
                      <Text className='favorite-card-model'>型号 {modelLabel}</Text>
                      <Text className='favorite-card-spec'>{specLabel}</Text>
                    </View>
                  </View>

                  <View className='favorite-card-actions'>
                    <Button
                      size='small'
                      variant='outlined'
                      onClick={() => navigateTo(goodsDetailRoute(item.sku.spuId))}
                    >
                      查看
                    </Button>
                    <View className='favorite-card-action-group'>
                      <Button
                        size='small'
                        variant='outlined'
                        onClick={() => void handleRemove(item.sku.id)}
                      >
                        移除
                      </Button>
                      <Button
                        size='small'
                        color='primary'
                        onClick={() => void handleAddToCart(item.sku.id)}
                      >
                        加入购物车
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
