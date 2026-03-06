import { Button, Image, Text, View } from '@tarojs/components'
import FixedView from '@taroify/core/fixed-view'
import { AppsOutlined, ArrowLeft, FilterOutlined } from '@taroify/icons'
import type { CartImportJob, CartImportPendingItem } from '@tmo/api-client'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import { formatCartItemMeta, formatCartItemPrice, formatFen, formatPendingMeta, getCartItemTitle, MATCH_TYPE_BADGES } from './helpers'
import type { CartItem, ImportTab, ProductImageMap, ProductNameMap, SelectionMap } from './types'

type ImportResultViewProps = {
  activeTab: ImportTab
  autoAddedItems: CartImportJob['result']['autoAddedItems']
  handleBack: () => void
  handleSelectSpec: (item: CartImportPendingItem) => Promise<void>
  identifiedCount: number
  onTabChange: (tab: ImportTab) => void
  pendingItems: CartImportPendingItem[]
  progressPercent: number
  selectionMap: SelectionMap
  totalCount: number
}

export function ImportResultView({
  activeTab,
  autoAddedItems,
  handleBack,
  handleSelectSpec,
  identifiedCount,
  onTabChange,
  pendingItems,
  progressPercent,
  selectionMap,
  totalCount
}: ImportResultViewProps) {
  return (
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
          onClick={() => onTabChange('to-confirm')}
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
          onClick={() => onTabChange('confirmed')}
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
                    onClick={() => void handleSelectSpec(item)}
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
  )
}

type CartListViewProps = {
  busyItemId: string | null
  cartItems: CartItem[]
  productImageBySpuId: ProductImageMap
  productNameBySpuId: ProductNameMap
  onChangeCartItemQty: (item: CartItem, nextQty: number) => Promise<void>
  onChangeCartItemSku: (item: CartItem) => Promise<void>
  onQuickChangeCartItemQty: (item: CartItem) => Promise<void>
  onRemoveCartItem: (item: CartItem) => Promise<void>
}

export function CartListView({
  busyItemId,
  cartItems,
  productImageBySpuId,
  productNameBySpuId,
  onChangeCartItemQty,
  onChangeCartItemSku,
  onQuickChangeCartItemQty,
  onRemoveCartItem
}: CartListViewProps) {
  const isCartEmpty = cartItems.length === 0

  return (
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
              const productImage = item.sku.spuId ? productImageBySpuId[item.sku.spuId] : undefined

              return (
                <View key={item.id} className='cart-item-card'>
                  <View className='cart-item-top'>
                    <View className='cart-item-thumb'>
                      <Image
                        src={productImage || placeholderProductImage}
                        mode='aspectFill'
                        className='cart-item-thumb-image'
                      />
                    </View>
                    <View className='cart-item-main'>
                      <View className='cart-item-header'>
                        <View className='cart-item-title-wrap'>
                          <Text className='cart-item-title'>
                            {title}
                          </Text>
                          {meta ? (
                            <Text className='cart-item-meta'>{meta}</Text>
                          ) : null}
                        </View>
                        <View
                          className={`cart-item-remove ${isBusy ? 'cart-item-remove--disabled' : ''}`}
                          onClick={isBusy ? undefined : () => void onRemoveCartItem(item)}
                        >
                          <Text>移除</Text>
                        </View>
                      </View>

                      <View className='cart-item-middle'>
                        <View
                          className={`cart-item-spec-trigger ${isBusy ? 'cart-item-spec-trigger--disabled' : ''}`}
                          onClick={isBusy ? undefined : () => void onChangeCartItemSku(item)}
                        >
                          <Text className='cart-item-spec-label'>规格</Text>
                          <Text className='cart-item-spec-value'>{specLabel}</Text>
                        </View>
                        <View className='cart-item-price'>
                          <Text className='cart-item-price-label'>参考单价</Text>
                          <Text className='cart-item-price-value'>{priceLabel}</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View className='cart-item-footer'>
                    <View className='cart-item-summary'>
                      <Text className='cart-item-qty-label'>采购数量</Text>
                      <Text className='cart-item-summary-text'>{item.qty} 件</Text>
                    </View>
                    <View className='cart-item-stepper'>
                      <View
                        className={`cart-item-stepper-btn ${
                          item.qty <= 1 || isBusy ? 'cart-item-stepper-btn--disabled' : ''
                        }`}
                        onClick={
                          item.qty <= 1 || isBusy
                            ? undefined
                            : () => void onChangeCartItemQty(item, item.qty - 1)
                        }
                      >
                        <Text className='leading-none'>-</Text>
                      </View>
                      <View
                        className={`cart-item-stepper-value ${isBusy ? 'cart-item-stepper-value--disabled' : ''}`}
                        onClick={isBusy ? undefined : () => void onQuickChangeCartItemQty(item)}
                      >
                        <Text>{item.qty}</Text>
                      </View>
                      <View
                        className={`cart-item-stepper-btn ${isBusy ? 'cart-item-stepper-btn--disabled' : ''}`}
                        onClick={
                          isBusy
                            ? undefined
                            : () => void onChangeCartItemQty(item, item.qty + 1)
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
          <View className='cart-empty-state'>
            <View className='cart-empty-icon'>
              <AppsOutlined className='text-xl cart-shell-primary' />
            </View>
            <Text className='cart-empty-title'>购物车还是空的</Text>
            <Text className='cart-empty-copy'>先去首页挑几件常购商品，结算区会在这里汇总。</Text>
          </View>
        )}
      </View>
    </View>
  )
}

type CartBottomBarProps = {
  cartTotalFen: number
  cartTotalItems: number
  importJob: CartImportJob | null
  loading: boolean
  onCheckout: () => Promise<void>
  onConfirmImport: () => Promise<void>
  onContinueBrowse: () => void
}

export function CartBottomBar({
  cartTotalFen,
  cartTotalItems,
  importJob,
  loading,
  onCheckout,
  onConfirmImport,
  onContinueBrowse
}: CartBottomBarProps) {
  const actionBase = 'flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center'
  const actionDisabled = loading ? 'opacity-60' : ''

  return (
    <FixedView position='bottom' safeArea='bottom' placeholder>
      <View className='cart-bottom-bar'>
        {!importJob ? (
          <View className='cart-bottom-summary'>
            <Text className='cart-bottom-summary-label'>{`共 ${cartTotalItems} 件`}</Text>
            <Text className='cart-bottom-summary-value'>
              {cartTotalFen > 0 ? formatFen(cartTotalFen) : '待确认报价'}
            </Text>
          </View>
        ) : null}
        <Button
          className={`${actionBase} cart-action-secondary ${actionDisabled}`}
          hoverClass='none'
          disabled={loading}
          onClick={!importJob ? onContinueBrowse : undefined}
        >
          {importJob ? '保存草稿' : '继续浏览'}
        </Button>
        <Button
          className={`${actionBase} cart-action-primary ${actionDisabled}`}
          hoverClass='none'
          disabled={loading}
          onClick={() => void (importJob ? onConfirmImport() : onCheckout())}
        >
          {importJob ? '确认并加入购物车' : '去结算'}
        </Button>
      </View>
    </FixedView>
  )
}
