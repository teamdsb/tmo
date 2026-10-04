import { formatSkuSpec } from '@tmo/shared'
import { useEffect, useState } from 'react'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import type { ProductSummary } from '@tmo/api-client'
import cartActiveIcon from '../../assets/tabbar/cart-active.png'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import AppFixedBottom from '../../components/app-safe-area'
import ProductSummaryCard from '../../components/product-summary-card'
import { formatCartItemMeta, formatCartItemPrice, formatFen, getCartItemTitle } from './helpers'
import type { CartItem, ProductImageMap, ProductNameMap } from './types'

type CartListViewProps = {
  busyItemId: string | null
  cartItems: CartItem[]
  onContinueBrowse: () => void
  onOpenCartItemDetail: (item: CartItem) => Promise<void>
  recommendedProducts: ProductSummary[]
  recommendedPriceMap: Record<string, string>
  recommendedProductImageSize: number
  productImageBySpuId: ProductImageMap
  productNameBySpuId: ProductNameMap
  productDimensionsBySpuId: Record<string, string[]>
  onChangeCartItemQty: (item: CartItem, nextQty: number) => Promise<void>
  onChangeCartItemSku: (item: CartItem) => Promise<void>
  onRemoveCartItem: (item: CartItem) => Promise<void>
}

const getInputEventValue = (event: {
  detail?: { value?: unknown }
  target?: unknown
  currentTarget?: unknown
}) => {
  const target = event.target as { value?: unknown } | undefined
  const currentTarget = event.currentTarget as { value?: unknown } | undefined
  const value = event.detail?.value ?? target?.value ?? currentTarget?.value
  return typeof value === 'string' ? value : String(value ?? '')
}

const parseCartQtyInput = (value: string): number | null => {
  const parsed = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null
  }
  return parsed
}

export function CartListView({
  busyItemId,
  cartItems,
  onContinueBrowse,
  onOpenCartItemDetail,
  recommendedProducts,
  recommendedPriceMap,
  recommendedProductImageSize,
  productImageBySpuId,
  productNameBySpuId,
  productDimensionsBySpuId,
  onChangeCartItemQty,
  onChangeCartItemSku,
  onRemoveCartItem
}: CartListViewProps) {
  const isCartEmpty = cartItems.length === 0
  const [qtyDraftById, setQtyDraftById] = useState<Record<string, string>>({})

  useEffect(() => {
    setQtyDraftById(Object.fromEntries(cartItems.map((item) => [item.id, String(item.qty)])))
  }, [cartItems])

  const updateQtyDraft = (item: CartItem, value: string) => {
    setQtyDraftById((current) => ({ ...current, [item.id]: value }))
  }

  const commitQtyDraft = (item: CartItem) => {
    const draftValue = qtyDraftById[item.id] ?? String(item.qty)
    const nextQty = parseCartQtyInput(draftValue)
    if (!nextQty) {
      updateQtyDraft(item, String(item.qty))
      return
    }
    if (nextQty === item.qty) {
      return
    }
    void onChangeCartItemQty(item, nextQty)
  }

  return (
    <View className='cart-screen'>
      <View className='cart-list-body'>
        {isCartEmpty ? (
          <>
            <View className='cart-empty-hero'>
              <View className='cart-empty-hero-visual'>
                <View className='cart-empty-hero-glow' />
                <View className='cart-empty-hero-ring'>
                  <Image src={cartActiveIcon} mode='aspectFit' className='cart-empty-hero-icon' />
                  <View className='cart-empty-hero-badge'>
                    <Text>0</Text>
                  </View>
                </View>
              </View>
              <Text className='cart-empty-title'>您的购物车是空的</Text>
              <Text className='cart-empty-copy'>看来您还没有添加任何商品。快去探索我们的最新系列吧。</Text>
              <Button className='cart-empty-primary' hoverClass='none' onClick={onContinueBrowse}>
                探索系列
              </Button>
            </View>

            <View className='home-product-section cart-recommend-section'>
              <View className='home-product-toolbar'>
                <Text className='home-product-title'>推荐商品</Text>
              </View>
              {recommendedProducts.length > 0 ? (
                <View className='home-product-matrix'>
                  {recommendedProducts.map((item) => (
                    <View key={item.id} className='home-product-cell'>
                      <ProductSummaryCard
                        data={item}
                        imageSize={recommendedProductImageSize}
                        priceLabel={recommendedPriceMap[item.id] ?? '询价'}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View className='cart-summary-strip'>
              <View className='cart-summary-copy'>
                <Text className='cart-summary-eyebrow'>当前小计</Text>
                <Text className='cart-summary-count'>{`购物车共有 ${cartItems.length} 件商品`}</Text>
              </View>
              <View className='cart-summary-badge'>
                <Text>{cartItems.length}</Text>
              </View>
            </View>

            <View className='cart-list-panel'>
              {cartItems.map((item) => {
                const meta = formatCartItemMeta(item)
                const isBusy = busyItemId === item.id
                const title = getCartItemTitle(item, productNameBySpuId)
                const specLabel = formatSkuSpec(productDimensionsBySpuId[item.sku.spuId], item.sku)
                const priceLabel = formatCartItemPrice(item)
                const productImage = item.sku.spuId ? productImageBySpuId[item.sku.spuId] : undefined
                const stopPropagation = (event: { stopPropagation?: () => void }) => {
                  event.stopPropagation?.()
                }

                return (
                  <View
                    key={item.id}
                    className='cart-item-card'
                    onClick={() => void onOpenCartItemDetail(item)}
                  >
                    <View className='cart-item-card-main'>
                      <View className='cart-item-thumb'>
                        <Image
                          src={productImage || placeholderProductImage}
                          mode='aspectFill'
                          className='cart-item-thumb-image'
                        />
                      </View>
                      <View className='cart-item-content'>
                        <View className='cart-item-header'>
                          <View className='cart-item-title-wrap'>
                            <Text className='cart-item-title'>{title}</Text>
                            {meta ? (
                              <Text className='cart-item-meta'>{meta}</Text>
                            ) : null}
                          </View>
                          <View
                            className={`cart-item-remove ${isBusy ? 'cart-item-remove--disabled' : ''}`}
                            onClick={isBusy ? undefined : (event) => {
                              stopPropagation(event)
                              void onRemoveCartItem(item)
                            }}
                          >
                            <Text>移除</Text>
                          </View>
                        </View>

                        <View className='cart-item-spec-row'>
                          <View
                            className={`cart-item-spec-trigger ${isBusy ? 'cart-item-spec-trigger--disabled' : ''}`}
                            onClick={isBusy ? undefined : (event) => {
                              stopPropagation(event)
                              void onChangeCartItemSku(item)
                            }}
                          >
                            <Text className='cart-item-spec-label'>规格</Text>
                            <Text className='cart-item-spec-value'>{specLabel}</Text>
                          </View>
                        </View>

                        <View className='cart-item-footer'>
                          <View className='cart-item-price'>
                            <Text className='cart-item-price-label'>参考单价</Text>
                            <Text className='cart-item-price-value'>{priceLabel}</Text>
                          </View>
                          <View className='cart-item-stepper'>
                            <View
                              className={`cart-item-stepper-btn ${
                                item.qty <= 1 || isBusy ? 'cart-item-stepper-btn--disabled' : ''
                              }`}
                              onClick={
                                item.qty <= 1 || isBusy
                                  ? undefined
                                  : (event) => {
                                    stopPropagation(event)
                                    void onChangeCartItemQty(item, item.qty - 1)
                                  }
                              }
                            >
                              <Text className='cart-item-stepper-btn-icon'>-</Text>
                            </View>
                            <Input
                              className={`cart-item-stepper-input ${isBusy ? 'cart-item-stepper-input--disabled' : ''}`}
                              data-field='cart-item-qty'
                              disabled={isBusy}
                              type='number'
                              value={qtyDraftById[item.id] ?? String(item.qty)}
                              onClick={stopPropagation}
                              onInput={(event) => {
                                stopPropagation(event)
                                updateQtyDraft(item, getInputEventValue(event))
                              }}
                              onBlur={(event) => {
                                stopPropagation(event)
                                commitQtyDraft(item)
                              }}
                            />
                            <View
                              className={`cart-item-stepper-btn ${isBusy ? 'cart-item-stepper-btn--disabled' : ''}`}
                              onClick={
                                isBusy
                                  ? undefined
                                  : (event) => {
                                    stopPropagation(event)
                                    void onChangeCartItemQty(item, item.qty + 1)
                                  }
                              }
                            >
                              <Text className='cart-item-stepper-btn-icon'>+</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </>
        )}
      </View>
    </View>
  )
}

type CartBottomBarProps = {
  cartHasPendingPrice: boolean
  cartTotalFen: number
  cartTotalItems: number
  loading: boolean
  onCheckout: () => Promise<void>
  onContinueBrowse: () => void
}

export function CartBottomBar({
  cartHasPendingPrice,
  cartTotalFen,
  cartTotalItems,
  loading,
  onCheckout,
  onContinueBrowse
}: CartBottomBarProps) {
  const actionDisabled = loading ? 'opacity-60' : ''
  const checkoutDisabled = loading || cartTotalItems === 0

  return (
    <AppFixedBottom includeSafeArea={false} contentClassName='cart-bottom-bar'>
      <View className='cart-bottom-summary'>
        <View className='cart-bottom-summary-copy'>
          <Text className='cart-bottom-summary-label'>小计</Text>
          <Text className='cart-bottom-summary-meta'>{`共 ${cartTotalItems} 件商品`}</Text>
        </View>
        <Text className='cart-bottom-summary-value'>
          {!cartHasPendingPrice ? formatFen(cartTotalFen) : '待确认报价'}
        </Text>
      </View>
      <View className='cart-bottom-actions'>
        <Button
          className={`cart-action cart-action-secondary ${actionDisabled}`}
          hoverClass='none'
          disabled={loading}
          onClick={onContinueBrowse}
        >
          继续购物
        </Button>
        <Button
          className={`cart-action cart-action-primary ${actionDisabled} ${checkoutDisabled ? 'cart-action-primary--disabled' : ''}`}
          hoverClass='none'
          disabled={checkoutDisabled}
          onClick={() => void onCheckout()}
        >
          去结算
        </Button>
      </View>
    </AppFixedBottom>
  )
}
