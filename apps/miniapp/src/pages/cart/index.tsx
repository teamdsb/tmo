import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import type { Cart, ProductSummary, ProductDetail } from '@tmo/api-client'
import { findSkuBySpecSelection, getPurchasableSpecSkus, getSkuSpecValues } from '@tmo/shared'
import SpecSelector from '../../components/spec-selector'
import { AppSafeAreaBottom } from '../../components/app-safe-area'
import { useProductStartingPrices } from '../../hooks/use-product-starting-prices'
import { useRefreshOnReturn } from '../../hooks/use-refresh-on-return'
import { commerceServices } from '../../services/commerce'
import { ROUTES, goodsDetailRoute } from '../../routes'
import { ensureLoggedIn } from '../../utils/auth'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { getNavbarStyle } from '../../utils/navbar'
import { getWindowSystemInfo } from '../../utils/system-info'
import { CartBottomBar, CartListView } from './components'
import { getCartItemUnitPriceFen, normalizeSpuId } from './helpers'
import { useCartProductDetails } from './hooks'
import type { CartItem } from './types'

const CART_RECOMMEND_GRID_GAP_PX = 12
const CART_RECOMMEND_SECTION_PADDING_PX = 12

const getCartRecommendProductImageSize = () => {
  const systemInfo = getWindowSystemInfo()
  const windowWidth = typeof systemInfo.windowWidth === 'number' ? systemInfo.windowWidth : 375
  return Math.max(120, Math.floor((windowWidth - CART_RECOMMEND_SECTION_PADDING_PX * 2 - CART_RECOMMEND_GRID_GAP_PX) / 2))
}

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null)
  const [recommendedProducts, setRecommendedProducts] = useState<ProductSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [skuPicker, setSkuPicker] = useState<{ item: CartItem; detail: ProductDetail } | null>(null)
  const [specSelection, setSpecSelection] = useState<string[]>([])
  const cartRequestVersion = useRef(0)
  const mounted = useRef(true)
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const cartItems = cart?.items ?? []
  const {
    productImageBySpuId,
    productNameBySpuId,
    loadProductDetail,
    productDimensionsBySpuId
  } = useCartProductDetails(cartItems, true)
  const recommendedPriceMap = useProductStartingPrices(recommendedProducts)
  const recommendedProductImageSize = useMemo(() => getCartRecommendProductImageSize(), [])

  const loadCart = useCallback(async () => {
    if (!mounted.current) return
    const version = ++cartRequestVersion.current
    setLoading(true)
    try {
      const cartData = await commerceServices.cart.getCart()
      if (mounted.current && version === cartRequestVersion.current) setCart(cartData)
    } catch (error) {
      if (!mounted.current || version !== cartRequestVersion.current) return
      console.warn('load cart failed', error)
      await Taro.showToast({ title: '加载购物车失败', icon: 'none' })
    } finally {
      if (mounted.current && version === cartRequestVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void loadCart()
    return () => {
      mounted.current = false
      cartRequestVersion.current += 1
    }
  }, [loadCart])

  const applyUpdatedCart = (updatedCart: Cart) => {
    if (!mounted.current) return
    cartRequestVersion.current += 1
    setCart(updatedCart)
    setLoading(false)
  }

  useRefreshOnReturn(() => {
    void loadCart()
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const response = await commerceServices.catalog.listProducts({ page: 1, pageSize: 4 })
        if (!cancelled) {
          setRecommendedProducts(response.items ?? [])
        }
      } catch (error) {
        console.warn('load cart recommendations failed', error)
        if (!cancelled) {
          setRecommendedProducts([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckout = async () => {
    if (!cartItems.length) {
      await Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }

    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) {
      return
    }
    await navigateTo(ROUTES.orderConfirm)
  }

  const handleOpenCartItemDetail = async (item: CartItem) => {
    const spuId = normalizeSpuId(item.sku.spuId)
    if (!spuId) {
      await Taro.showToast({ title: '商品详情暂不可用', icon: 'none' })
      return
    }
    await navigateTo(goodsDetailRoute(spuId))
  }

  const handleChangeCartItemQty = async (item: CartItem, nextQty: number) => {
    if (nextQty < 1 || busyItemId === item.id) {
      return
    }

    setBusyItemId(item.id)
    try {
      const updatedCart = await commerceServices.cart.updateItemQty(item.id, nextQty)
      applyUpdatedCart(updatedCart)
    } catch (error) {
      console.warn('update cart qty failed', error)
      await Taro.showToast({ title: '更新数量失败', icon: 'none' })
    } finally {
      setBusyItemId((current) => (current === item.id ? null : current))
    }
  }

  const refreshCart = useCallback(async (): Promise<void> => {
    const version = ++cartRequestVersion.current
    try {
      const latest = await commerceServices.cart.getCart()
      if (mounted.current && version === cartRequestVersion.current) setCart(latest)
    } finally {
      if (mounted.current && version === cartRequestVersion.current) setLoading(false)
    }
  }, [])

  const handleChangeCartItemSku = async (item: CartItem) => {
    if (busyItemId === item.id) {
      return
    }

    const spuId = normalizeSpuId(item.sku.spuId)
    if (!spuId) {
      await Taro.showToast({ title: '当前商品无可选规格', icon: 'none' })
      return
    }

    try {
      const detail = await loadProductDetail(spuId)
      const options = detail ? getPurchasableSpecSkus(detail.product.filterDimensions, detail.skus) : []
      if (!detail || !options.length) {
        await Taro.showToast({ title: '当前商品无可选规格', icon: 'none' })
        return
      }
      const current = options.find((sku) => sku.id === item.sku.id) ?? (options.length === 1 ? options[0] : undefined)
      setSpecSelection(current ? getSkuSpecValues(detail.product.filterDimensions, current) : [])
      setSkuPicker({ item, detail })
    } catch (error) {
      console.warn('load cart sku options failed', error)
      await Taro.showToast({ title: '规格加载失败', icon: 'none' })
    }
  }

  const selectedReplacementSku = skuPicker
    ? findSkuBySpecSelection(skuPicker.detail.product.filterDimensions, skuPicker.detail.skus, specSelection)
    : undefined

  const handleConfirmSku = async () => {
    if (!skuPicker || !selectedReplacementSku || busyItemId) return
    const { item } = skuPicker
    const nextSku = selectedReplacementSku
    if (nextSku.id === item.sku.id) {
      setSkuPicker(null)
      return
    }
    try {
      setBusyItemId(item.id)
      const updatedCart = await commerceServices.cart.replaceItemSku(item.id, nextSku.id, item.qty)
      applyUpdatedCart(updatedCart)
      setSkuPicker(null)
      await Taro.showToast({ title: '规格已更新', icon: 'success' })
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('change cart sku failed', error)
      await Taro.showToast({ title: '规格更新失败，请重试', icon: 'none' })
    } finally {
      setBusyItemId((current) => (current === item.id ? null : current))
    }
  }

  const handleRemoveCartItem = async (item: CartItem) => {
    if (busyItemId === item.id) {
      return
    }

    setBusyItemId(item.id)
    try {
      await commerceServices.cart.removeItem(item.id)
      await refreshCart()
      await Taro.showToast({ title: '已移除', icon: 'none' })
    } catch (error) {
      console.warn('remove cart item failed', error)
      await Taro.showToast({ title: '移除失败', icon: 'none' })
    } finally {
      setBusyItemId((current) => (current === item.id ? null : current))
    }
  }

  const cartTotalItems = cartItems.reduce((sum, item) => sum + item.qty, 0)
  const pricingSummary = cartItems.reduce((summary, item) => {
    const unitPriceFen = getCartItemUnitPriceFen(item)
    if (unitPriceFen === null) {
      return {
        totalFen: summary.totalFen,
        hasPendingPrice: true
      }
    }
    return {
      totalFen: summary.totalFen + (unitPriceFen * item.qty),
      hasPendingPrice: summary.hasPendingPrice
    }
  }, { totalFen: 0, hasPendingPrice: false })

  return (
    <View className='page page-compact-navbar flex flex-col' style={isH5 ? navbarStyle : undefined}>
      {isH5
        ? (
          <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'>
          </Navbar>
        )
        : null}

      <CartListView
        busyItemId={busyItemId}
        cartItems={cartItems}
        onContinueBrowse={() => void switchTabLike(ROUTES.home)}
        onOpenCartItemDetail={handleOpenCartItemDetail}
        recommendedProducts={recommendedProducts}
        recommendedPriceMap={recommendedPriceMap}
        recommendedProductImageSize={recommendedProductImageSize}
        productImageBySpuId={productImageBySpuId}
        productNameBySpuId={productNameBySpuId}
        productDimensionsBySpuId={productDimensionsBySpuId}
        onChangeCartItemQty={handleChangeCartItemQty}
        onChangeCartItemSku={handleChangeCartItemSku}
        onRemoveCartItem={handleRemoveCartItem}
      />

      {skuPicker ? (
        <View className='cart-spec-overlay'>
          <View className='cart-spec-panel'>
            <Text>更换规格 · {skuPicker.detail.product.name}</Text>
            <SpecSelector
              dimensions={skuPicker.detail.product.filterDimensions}
              skus={skuPicker.detail.skus}
              selection={specSelection}
              onChange={setSpecSelection}
            />
            <View className='cart-spec-actions'>
              <Button disabled={Boolean(busyItemId)} onClick={() => setSkuPicker(null)}>取消</Button>
              <Button disabled={!selectedReplacementSku || Boolean(busyItemId)} onClick={() => void handleConfirmSku()}>确认规格</Button>
            </View>
            <AppSafeAreaBottom />
          </View>
        </View>
      ) : null}

      <CartBottomBar
        cartHasPendingPrice={pricingSummary.hasPendingPrice}
        cartTotalFen={pricingSummary.totalFen}
        cartTotalItems={cartTotalItems}
        loading={loading}
        onCheckout={handleCheckout}
        onContinueBrowse={() => void switchTabLike(ROUTES.home)}
      />
    </View>
  )
}
