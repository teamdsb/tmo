import { useEffect, useMemo, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import FixedView from '@taroify/core/fixed-view'
import { AppsOutlined, ArrowLeft, FilterOutlined } from '@taroify/icons'
import type {
  Cart,
  CartImportJob,
  CartImportPendingItem,
  CartImportSelection
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

export default function ExcelImportConfirmation() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('to-confirm')
  const [importJob, setImportJob] = useState<CartImportJob | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [selectionMap, setSelectionMap] = useState<Record<number, CartImportSelection>>({})
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const jobIdParam = typeof router.params?.jobId === 'string' ? router.params.jobId : null

  useEffect(() => {
    void (async () => {
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
    })()
  }, [jobIdParam])

  const pendingItems = importJob?.result?.pendingItems ?? []
  const autoAddedItems = importJob?.result?.autoAddedItems ?? []
  const identifiedCount = importJob?.result?.autoAddedCount ?? 0
  const pendingCount = importJob?.result?.pendingCount ?? pendingItems.length
  const totalCount = identifiedCount + pendingCount

  const progressPercent = totalCount > 0 ? Math.round((identifiedCount / totalCount) * 100) : 0

  const selections = useMemo(() => Object.values(selectionMap), [selectionMap])
  const cartItems = cart?.items ?? []
  const isCartEmpty = cartItems.length === 0

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
                  return (
                    <View
                      key={item.id}
                      className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4'
                    >
                      <View className='flex-1 min-w-0'>
                        <Text className='text-sm font-medium text-slate-900 truncate'>
                          {item.sku.name}
                        </Text>
                        {meta ? (
                          <Text className='text-xs text-slate-400 mt-1 truncate'>{meta}</Text>
                        ) : null}
                      </View>
                    <View className='flex items-center gap-2'>
                      <Text className='text-xs text-slate-400'>数量</Text>
                      <Text className='text-sm font-semibold text-slate-900'>{item.qty}</Text>
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
