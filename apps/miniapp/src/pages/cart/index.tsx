import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import FixedView from '@taroify/core/fixed-view'
import { AppsOutlined, ArrowLeft, FilterOutlined } from '@taroify/icons'
import type {
  Cart,
  CartImportJob,
  CartImportPendingItem,
  CartImportSelection,
  ProductDetail,
  Sku
} from '@tmo/api-client'
import { getNavbarStyle } from '../../utils/navbar'
import { commerceServices } from '../../services/commerce'
import { ROUTES } from '../../routes'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { ensureLoggedIn } from '../../utils/auth'

const MATCH_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  AMBIGUOUS: { label: '匹配不确定', className: 'bg-amber-50 text-amber-600' },
  NOT_FOUND: { label: '未找到', className: 'bg-red-50 text-red-600' }
}
const QUICK_CART_QTY_OPTIONS = [1, 2, 5, 10]

const formatPendingMeta = (item: CartImportPendingItem) => {
  const parts = [
    item.rawSpec?.trim() || null,
    item.rawQty ? `数量 ${item.rawQty}` : null,
    `行 ${item.rowNo}`
  ].filter(Boolean)
  return parts.join(' • ')
}

const formatCartItemMeta = (item: Cart['items'][number]) => {
  const parts = [
    item.sku.spec?.trim() || null,
    item.sku.skuCode ? `SKU ${item.sku.skuCode}` : null
  ].filter(Boolean)
  return parts.join(' • ')
}

const formatFen = (fen: number): string => `¥${(fen / 100).toFixed(2)}`

const formatCartItemPrice = (item: Cart['items'][number]): string => {
  const tier = item.sku.priceTiers?.[0]
  if (!tier) {
    return '询价'
  }
  return formatFen(tier.unitPriceFen)
}

const normalizeSpuId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const getSkuLabel = (sku: Sku): string => {
  const spec = sku.spec?.trim()
  if (spec) {
    return spec
  }
  const name = sku.name?.trim()
  if (name) {
    return name
  }
  return sku.id
}

const getCartItemTitle = (
  item: Cart['items'][number],
  productNameBySpuId: Record<string, string>
): string => {
  const spuId = normalizeSpuId(item.sku.spuId)
  const productName = spuId ? productNameBySpuId[spuId] : undefined
  if (productName) {
    return productName
  }
  return item.sku.name
}

export default function ExcelImportConfirmation() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('to-confirm')
  const [importJob, setImportJob] = useState<CartImportJob | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [selectionMap, setSelectionMap] = useState<Record<number, CartImportSelection>>({})
  const [loading, setLoading] = useState(false)
  const [busyItemId, setBusyItemId] = useState<string | null>(null)
  const [productNameBySpuId, setProductNameBySpuId] = useState<Record<string, string>>({})
  const [skuOptionsBySpuId, setSkuOptionsBySpuId] = useState<Record<string, Sku[]>>({})
  const productNameBySpuIdRef = useRef<Record<string, string>>({})
  const skuOptionsBySpuIdRef = useRef<Record<string, Sku[]>>({})
  const spuDetailRequestByIdRef = useRef<Record<string, Promise<ProductDetail | null>>>({})
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const jobIdParam = typeof router.params?.jobId === 'string' ? router.params.jobId : null

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
  const cartItems = cart?.items ?? []
  const isCartEmpty = cartItems.length === 0

  useEffect(() => {
    productNameBySpuIdRef.current = productNameBySpuId
  }, [productNameBySpuId])

  useEffect(() => {
    skuOptionsBySpuIdRef.current = skuOptionsBySpuId
  }, [skuOptionsBySpuId])

  const cacheSpuDetail = useCallback((spuId: string, detail: ProductDetail): void => {
    const productName = detail.product?.name?.trim()
    if (productName) {
      setProductNameBySpuId((prev) => {
        if (prev[spuId] === productName) {
          return prev
        }
        const next = { ...prev, [spuId]: productName }
        productNameBySpuIdRef.current = next
        return next
      })
    }

    const nextSkus = Array.isArray(detail.skus) ? detail.skus : []
    if (nextSkus.length > 0) {
      setSkuOptionsBySpuId((prev) => {
        const current = prev[spuId] ?? []
        if (current.length === nextSkus.length && current.every((sku, index) => sku.id === nextSkus[index]?.id)) {
          return prev
        }
        const next = { ...prev, [spuId]: nextSkus }
        skuOptionsBySpuIdRef.current = next
        return next
      })
    }
  }, [])

  const fetchSpuDetail = useCallback(async (spuId: string): Promise<ProductDetail | null> => {
    const normalizedSpuId = normalizeSpuId(spuId)
    if (!normalizedSpuId) {
      return null
    }
    if (spuDetailRequestByIdRef.current[normalizedSpuId]) {
      return spuDetailRequestByIdRef.current[normalizedSpuId]
    }

    const task = (async () => {
      try {
        const detail = await commerceServices.catalog.getProductDetail(normalizedSpuId)
        cacheSpuDetail(normalizedSpuId, detail)
        return detail
      } catch (error) {
        console.warn('load cart product detail failed', error)
        return null
      } finally {
        delete spuDetailRequestByIdRef.current[normalizedSpuId]
      }
    })()

    spuDetailRequestByIdRef.current[normalizedSpuId] = task
    return task
  }, [cacheSpuDetail])

  const hydrateProductNames = useCallback(async (items: Cart['items'][number][]) => {
    const spuIds = Array.from(new Set(
      items
        .map((item) => normalizeSpuId(item.sku.spuId))
        .filter((spuId): spuId is string => spuId.length > 0)
    ))
    const missingSpuIds = spuIds.filter((spuId) => !productNameBySpuIdRef.current[spuId])
    if (missingSpuIds.length === 0) {
      return
    }
    await Promise.all(missingSpuIds.map((spuId) => fetchSpuDetail(spuId)))
  }, [fetchSpuDetail])

  useEffect(() => {
    if (importJob || cartItems.length === 0) {
      return
    }
    void hydrateProductNames(cartItems)
  }, [cartItems, hydrateProductNames, importJob])

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
      if (!candidate) return
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
    if (!importJob?.id) return
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

  const actionBase = 'flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center'
  const actionDisabled = loading ? 'opacity-60' : ''
  const handleCheckout = async () => {
    if (!cartItems.length) {
      await Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    await navigateTo(ROUTES.orderConfirm)
  }

  const handleChangeCartItemQty = async (item: Cart['items'][number], nextQty: number) => {
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

  const loadSkuOptions = useCallback(async (spuId: string): Promise<Sku[]> => {
    const normalizedSpuId = normalizeSpuId(spuId)
    if (!normalizedSpuId) {
      return []
    }
    const cached = skuOptionsBySpuIdRef.current[normalizedSpuId]
    if (cached && cached.length > 0) {
      return cached
    }
    const detail = await fetchSpuDetail(normalizedSpuId)
    if (!detail?.skus || detail.skus.length === 0) {
      return []
    }
    return detail.skus
  }, [fetchSpuDetail])

  const handleChangeCartItemSku = async (item: Cart['items'][number]) => {
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

  const handleQuickChangeCartItemQty = async (item: Cart['items'][number]) => {
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

  const handleRemoveCartItem = async (item: Cart['items'][number]) => {
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

  return (
    <View className='page page-compact-navbar flex flex-col' style={isH5 ? navbarStyle : undefined}>
      {isH5
        ? (
          <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'>
          </Navbar>
        )
        : null}

      {importJob ? (
        <View className='flex-1 flex flex-col bg-white'>
          <View className='px-6 pt-2 pb-2 bg-white'>
            <View className='flex items-center justify-between mb-6'>
              <View
                className='w-8 h-8 flex items-center justify-center rounded-full -ml-2 text-slate-600'
                onClick={handleBack}
              >
                <ArrowLeft className='text-xl' />
              </View>
              <Text className='text-lg font-semibold text-slate-900 tracking-tight'>导入结果</Text>
              <View className='w-8' />
            </View>
            <View className='flex items-center gap-4 mb-2'>
              <View className='flex-1 h-1 bg-slate-100 rounded-full overflow-hidden'>
                <View className='h-full bg-blue-600 rounded-full' style={{ width: `${progressPercent}%` }} />
              </View>
              <Text className='text-10 font-medium text-slate-400 whitespace-nowrap'>
                {identifiedCount}/{totalCount} 已识别
              </Text>
            </View>
          </View>

          <View className='flex px-6 border-b border-slate-100 mb-2'>
            <View
              className={`pb-3 text-sm font-medium mr-8 ${
                activeTab === 'to-confirm'
                  ? 'border-b-2 border-blue-600 text-slate-900'
                  : 'text-slate-400'
              }`}
              onClick={() => setActiveTab('to-confirm')}
            >
              <Text>待确认</Text>
              <Text className='text-10 align-top ml-1 text-blue-600'>
                {pendingItems.length}
              </Text>
            </View>
            <View
              className={`pb-3 text-sm font-medium ${
                activeTab === 'confirmed'
                  ? 'border-b-2 border-blue-600 text-slate-900'
                  : 'text-slate-400'
              }`}
              onClick={() => setActiveTab('confirmed')}
            >
              <Text>已确认</Text>
              <Text className='text-10 align-top ml-1'>{autoAddedItems.length}</Text>
            </View>
          </View>

          <View className='px-6 py-2 pb-40'>
            {activeTab === 'to-confirm' ? (
              pendingItems.length > 0 ? (
                pendingItems.map((item) => {
                  const selected = selectionMap[item.rowNo]
                  const badge = MATCH_TYPE_BADGES[item.matchType] ?? {
                    label: '待处理',
                    className: 'bg-slate-50 text-slate-500'
                  }
                  const buttonClass = selected
                    ? 'border-blue-200 text-blue-600 bg-blue-50'
                    : 'border-slate-200 text-slate-600 bg-transparent'

                  return (
                    <View
                      key={item.rowNo}
                      className='py-5 border-b border-slate-100 flex items-center justify-between gap-4'
                    >
                      <View className='flex-1 min-w-0'>
                        <View className='flex items-center gap-2 mb-1 flex-wrap'>
                          <Text className='text-sm font-medium text-slate-900 truncate'>
                            {item.rawName}
                          </Text>
                          <View className={`px-2 py-1 rounded ${badge.className}`}>
                            <Text className='text-9 font-medium uppercase tracking-wide'>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                        <Text className='text-xs text-slate-400 font-light truncate'>
                          {formatPendingMeta(item)}
                        </Text>
                      </View>
                      <View
                        className={`shrink-0 h-8 px-3 text-11 font-medium border rounded-lg ${buttonClass}`}
                        onClick={() => handleSelectSpec(item)}
                      >
                        <Text>{selected ? '已选择' : '选择规格'}</Text>
                      </View>
                    </View>
                  )
                })
              ) : (
                <View className='py-10 text-center'>
                  <Text className='text-sm text-slate-400'>无待确认项</Text>
                  <Text className='text-xs text-slate-300'>已自动匹配全部项目。</Text>
                </View>
              )
            ) : autoAddedItems.length > 0 ? (
              autoAddedItems.map((item) => (
                <View
                  key={`${item.rowNo}-${item.skuId}`}
                  className='py-5 border-b border-slate-100 flex items-center justify-between gap-4'
                >
                  <View className='flex-1 min-w-0'>
                    <Text className='text-sm font-medium text-slate-900 truncate'>
                      SKU {item.skuId.slice(0, 8)}
                    </Text>
                    <Text className='text-xs text-slate-400 font-light truncate'>
                      数量 {item.qty} • 行 {item.rowNo}
                    </Text>
                  </View>
                  <View className='px-2 py-1 rounded bg-emerald-50'>
                    <Text className='text-9 font-medium uppercase tracking-wide text-emerald-600'>
                      已确认
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View className='py-10 text-center'>
                <Text className='text-sm text-slate-400'>无已确认项</Text>
                <Text className='text-xs text-slate-300'>确认后将显示在此处。</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View className='flex-1 flex flex-col bg-gray-50'>
          <View className='px-6 pt-3 pb-3 bg-white'>
            <View className='flex items-center justify-between gap-4'>
              <View className='min-w-0'>
                <Text className='text-lg font-semibold text-slate-900'>购物车</Text>
              </View>
            </View>
          </View>

          <View className='px-4 py-3 flex justify-between items-center bg-gray-50'>
            <Text className='text-xs text-slate-500 font-medium'>
              {`共 ${cartItems.length} 件`}
            </Text>
            <View className='flex gap-2'>
              <View className='p-2 bg-white rounded-md shadow-sm border border-gray-200 text-slate-400'>
                <FilterOutlined className='text-sm' />
              </View>
              <View className='p-2 bg-white rounded-md shadow-sm border border-gray-200 text-slate-400'>
                <AppsOutlined className='text-sm' />
              </View>
            </View>
          </View>

          <View className='flex-1 px-4 pb-40 bg-gray-50 pt-2'>
            {!isCartEmpty ? (
              <View className='grid grid-cols-1 gap-4'>
                {cartItems.map((item) => {
                  const meta = formatCartItemMeta(item)
                  const isBusy = busyItemId === item.id
                  const title = getCartItemTitle(item, productNameBySpuId)
                  const specLabel = item.sku.spec?.trim() || item.sku.name
                  const priceLabel = formatCartItemPrice(item)
                  return (
                    <View
                      key={item.id}
                      className='cart-item-card'
                    >
                      <View className='cart-item-header'>
                        <View className='cart-item-main'>
                          <Text className='cart-item-title'>
                            {title}
                          </Text>
                          {meta ? (
                            <Text className='cart-item-meta'>{meta}</Text>
                          ) : null}
                        </View>
                        <View
                          className={`cart-item-remove ${isBusy ? 'cart-item-remove--disabled' : ''}`}
                          onClick={isBusy ? undefined : () => void handleRemoveCartItem(item)}
                        >
                          <Text>移除</Text>
                        </View>
                      </View>

                      <View className='cart-item-middle'>
                        <View
                          className={`cart-item-spec-trigger ${isBusy ? 'cart-item-spec-trigger--disabled' : ''}`}
                          onClick={isBusy ? undefined : () => void handleChangeCartItemSku(item)}
                        >
                          <Text className='cart-item-spec-label'>规格</Text>
                          <Text className='cart-item-spec-value'>{specLabel}</Text>
                        </View>
                        <View className='cart-item-price'>
                          <Text className='cart-item-price-label'>参考单价</Text>
                          <Text className='cart-item-price-value'>{priceLabel}</Text>
                        </View>
                      </View>

                      <View className='cart-item-footer'>
                        <Text className='cart-item-qty-label'>数量</Text>
                        <View className='cart-item-stepper'>
                          <View
                            className={`cart-item-stepper-btn ${
                              item.qty <= 1 || isBusy ? 'cart-item-stepper-btn--disabled' : ''
                            }`}
                            onClick={
                              item.qty <= 1 || isBusy
                                ? undefined
                                : () => void handleChangeCartItemQty(item, item.qty - 1)
                            }
                          >
                            <Text className='leading-none'>-</Text>
                          </View>
                          <View
                            className={`cart-item-stepper-value ${isBusy ? 'cart-item-stepper-value--disabled' : ''}`}
                            onClick={isBusy ? undefined : () => void handleQuickChangeCartItemQty(item)}
                          >
                            <Text>{item.qty}</Text>
                          </View>
                          <View
                            className={`cart-item-stepper-btn ${isBusy ? 'cart-item-stepper-btn--disabled' : ''}`}
                            onClick={
                              isBusy
                                ? undefined
                                : () => void handleChangeCartItemQty(item, item.qty + 1)
                            }
                          >
                            <Text className='leading-none'>+</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : (
              <View className='py-10 text-center'>
                <Text className='text-sm font-medium text-slate-500'>购物车为空</Text>
                <Text className='text-xs text-slate-300 mt-2'>先去首页挑选商品吧</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <View className='px-5 py-3 bg-white border-t border-slate-100 flex gap-3'>
          <Button
            className={`${actionBase} cart-action-secondary ${actionDisabled}`}
            hoverClass='none'
            disabled={loading}
          >
            {importJob ? '保存草稿' : '继续浏览'}
          </Button>
          <Button
            className={`${actionBase} cart-action-primary ${actionDisabled}`}
            hoverClass='none'
            disabled={loading}
            onClick={importJob ? handleConfirmImport : handleCheckout}
          >
            {importJob ? '确认并加入购物车' : '去结算'}
          </Button>
        </View>
      </FixedView>
    </View>
  )
}
