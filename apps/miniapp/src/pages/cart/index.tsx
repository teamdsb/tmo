import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import type { Cart, CartImportJob, CartImportPendingItem, Sku } from '@tmo/api-client'
import { commerceServices } from '../../services/commerce'
import { ROUTES, goodsDetailRoute } from '../../routes'
import { ensureLoggedIn } from '../../utils/auth'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { getNavbarStyle } from '../../utils/navbar'
import { CartBottomBar, CartListView, ImportResultView } from './components'
import { getCartItemUnitPriceFen, getSkuLabel, normalizeSpuId, QUICK_CART_QTY_OPTIONS } from './helpers'
import { useCartProductDetails } from './hooks'
import type { CartItem, ImportTab, SelectionMap } from './types'

export default function ExcelImportConfirmation() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ImportTab>('to-confirm')
  const [importJob, setImportJob] = useState<CartImportJob | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [selectionMap, setSelectionMap] = useState<SelectionMap>({})
  const [loading, setLoading] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const jobIdParam = typeof router.params?.jobId === 'string' ? router.params.jobId : null
  const cartItems = cart?.items ?? []
  const {
    productImageBySpuId,
    productNameBySpuId,
    loadSkuOptions
  } = useCartProductDetails(cartItems, !importJob)

  const loadCartOrImport = useCallback(async () => {
    setLoading(true)
    try {
      if (jobIdParam) {
        const job = await commerceServices.cart.getImportJob(jobIdParam)
        setImportJob(job)
        setCart(null)
        setSelectionMap({})
        if (job.result?.pendingItems?.length) {
          setActiveTab('to-confirm')
        }
        return
      }

      const cartData = await commerceServices.cart.getCart()
      setCart(cartData)
      setImportJob(null)
    } catch (error) {
      console.warn('load cart/import failed', error)
      await Taro.showToast({ title: '加载购物车失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [jobIdParam])

  useEffect(() => {
    void loadCartOrImport()
  }, [loadCartOrImport])

  useDidShow(() => {
    void loadCartOrImport()
  })

  const pendingItems = importJob?.result?.pendingItems ?? []
  const autoAddedItems = importJob?.result?.autoAddedItems ?? []
  const identifiedCount = importJob?.result?.autoAddedCount ?? 0
  const pendingCount = importJob?.result?.pendingCount ?? pendingItems.length
  const totalCount = identifiedCount + pendingCount
  const progressPercent = totalCount > 0 ? Math.round((identifiedCount / totalCount) * 100) : 0
  const selections = useMemo(() => Object.values(selectionMap), [selectionMap])

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.cart))
  }

  const handleSelectSpec = async (item: CartImportPendingItem) => {
    const candidates = item.candidates ?? []
    if (candidates.length === 0) {
      await Taro.showToast({ title: '没有候选项', icon: 'none' })
      return
    }

    try {
      const result = await Taro.showActionSheet({
        itemList: candidates.map((candidate) => candidate.sku.spec ?? candidate.sku.name)
      })
      const candidate = candidates[result.tapIndex]
      if (!candidate) {
        return
      }

      const qty = item.rawQty ? Number.parseInt(item.rawQty, 10) : undefined
      setSelectionMap((prev) => ({
        ...prev,
        [item.rowNo]: {
          rowNo: item.rowNo,
          skuId: candidate.sku.id,
          qty: Number.isNaN(qty) ? undefined : qty
        }
      }))
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('select spec failed', error)
      await Taro.showToast({ title: '选择失败', icon: 'none' })
    }
  }

  const handleConfirmImport = async () => {
    if (!importJob?.id) {
      return
    }
    if (pendingItems.length > 0 && selections.length < pendingItems.length) {
      await Taro.showToast({ title: '请完成全部选择', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const updatedCart = await commerceServices.cart.confirmImport(importJob.id, selections)
      setCart(updatedCart)
      setImportJob(null)
      await Taro.showToast({ title: '已加入购物车', icon: 'success' })
      await switchTabLike(ROUTES.cart)
    } catch (error) {
      console.warn('confirm import failed', error)
      await Taro.showToast({ title: '确认失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

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
      setCart(updatedCart)
    } catch (error) {
      console.warn('update cart qty failed', error)
      await Taro.showToast({ title: '更新数量失败', icon: 'none' })
    } finally {
      setBusyItemId((current) => (current === item.id ? null : current))
    }
  }

  const refreshCart = useCallback(async (): Promise<void> => {
    const latest = await commerceServices.cart.getCart()
    setCart(latest)
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

    let options: Sku[] = []
    try {
      options = await loadSkuOptions(spuId)
    } catch (error) {
      console.warn('load cart sku options failed', error)
      await Taro.showToast({ title: '规格加载失败', icon: 'none' })
      return
    }

    if (options.length === 0) {
      await Taro.showToast({ title: '当前商品无可选规格', icon: 'none' })
      return
    }

    try {
      const result = await Taro.showActionSheet({
        itemList: options.map((sku) => getSkuLabel(sku))
      })
      const nextSku = options[result.tapIndex]
      if (!nextSku || nextSku.id === item.sku.id) {
        return
      }

      setBusyItemId(item.id)
      await commerceServices.cart.removeItem(item.id)
      await commerceServices.cart.addItem(nextSku.id, item.qty)
      await refreshCart()
      await Taro.showToast({ title: '规格已更新', icon: 'success' })
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('change cart sku failed', error)
      try {
        await refreshCart()
      } catch (refreshError) {
        console.warn('refresh cart after sku change failed', refreshError)
      }
      await Taro.showToast({ title: '规格更新失败，请重试', icon: 'none' })
    } finally {
      setBusyItemId((current) => (current === item.id ? null : current))
    }
  }

  const handleQuickChangeCartItemQty = async (item: CartItem) => {
    if (busyItemId === item.id) {
      return
    }

    try {
      const result = await Taro.showActionSheet({
        itemList: QUICK_CART_QTY_OPTIONS.map((qty) => `${qty} 件`)
      })
      const nextQty = QUICK_CART_QTY_OPTIONS[result.tapIndex]
      if (!nextQty || nextQty === item.qty) {
        return
      }
      await handleChangeCartItemQty(item, nextQty)
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('quick change cart qty failed', error)
      await Taro.showToast({ title: '数量选择失败', icon: 'none' })
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

      {importJob ? (
        <ImportResultView
          activeTab={activeTab}
          autoAddedItems={autoAddedItems}
          handleBack={handleBack}
          handleSelectSpec={handleSelectSpec}
          identifiedCount={identifiedCount}
          onTabChange={setActiveTab}
          pendingItems={pendingItems}
          progressPercent={progressPercent}
          selectionMap={selectionMap}
          totalCount={totalCount}
        />
      ) : (
        <CartListView
          busyItemId={busyItemId}
          cartItems={cartItems}
          onContinueBrowse={() => void switchTabLike(ROUTES.home)}
          onOpenCartItemDetail={handleOpenCartItemDetail}
          productImageBySpuId={productImageBySpuId}
          productNameBySpuId={productNameBySpuId}
          onChangeCartItemQty={handleChangeCartItemQty}
          onChangeCartItemSku={handleChangeCartItemSku}
          onQuickChangeCartItemQty={handleQuickChangeCartItemQty}
          onRemoveCartItem={handleRemoveCartItem}
        />
      )}

      <CartBottomBar
        cartHasPendingPrice={pricingSummary.hasPendingPrice}
        cartTotalFen={pricingSummary.totalFen}
        cartTotalItems={cartTotalItems}
        importJob={importJob}
        loading={loading}
        onCheckout={handleCheckout}
        onConfirmImport={handleConfirmImport}
        onContinueBrowse={() => void switchTabLike(ROUTES.home)}
      />
    </View>
  )
}
