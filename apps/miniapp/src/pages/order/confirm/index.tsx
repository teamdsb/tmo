import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Textarea } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import FixedView from '@taroify/core/fixed-view'
import type { Cart, UserAddress } from '@tmo/api-client'
import { ROUTES, goodsDetailRoute, orderDetailRoute } from '../../../routes'
import SafeImage from '../../../components/safe-image'
import { getNavbarStyle } from '../../../utils/navbar'
import { matchPriceTier } from '../../../utils/price-tier'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { ensureLoggedIn } from '../../../utils/auth'
import { commerceServices } from '../../../services/commerce'
import { listUserAddresses } from '../../../services/addresses'
import { isPaymentCancelled, paymentServices } from '../../../services/payment'

export default function OrderConfirmPage() {
  const navbarStyle = getNavbarStyle()
  const [cart, setCart] = useState<Cart | null>(null)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [productImageBySpuId, setProductImageBySpuId] = useState<Record<string, string>>({})
  const [productNameBySpuId, setProductNameBySpuId] = useState<Record<string, string>>({})
  const [remark, setRemark] = useState('')
  const [remarkExpanded, setRemarkExpanded] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const allowed = await ensureLoggedIn({ redirect: true })
      if (!allowed) return
      const [cartData, addressData] = await Promise.all([
        commerceServices.cart.getCart(),
        listUserAddresses()
      ])
      setCart(cartData)
      setAddresses(addressData)
    } catch (error) {
      console.warn('load confirm data failed', error)
      await Taro.showToast({ title: '加载订单数据失败', icon: 'none' })
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useDidShow(() => {
    void loadData()
  })

  const defaultAddress = addresses.find((addr) => addr.isDefault) ?? addresses[0]
  const cartItems = cart?.items ?? []

  useEffect(() => {
    const spuIds = Array.from(new Set(
      cartItems
        .map((item) => normalizeSpuId(item.sku.spuId))
        .filter((spuId): spuId is string => spuId.length > 0)
    ))
    if (spuIds.length === 0) {
      return
    }

    let cancelled = false
    void (async () => {
      const details = await Promise.all(spuIds.map(async (spuId) => {
        try {
          const detail = await commerceServices.catalog.getProductDetail(spuId)
          return { spuId, detail }
        } catch (error) {
          console.warn('load confirm product detail failed', error)
          return null
        }
      }))

      if (cancelled) {
        return
      }

      setProductImageBySpuId((prev) => {
        const next = { ...prev }
        for (const entry of details) {
          const image = entry?.detail.product?.images?.find((value) => typeof value === 'string' && value.trim())?.trim()
          if (entry && image) {
            next[entry.spuId] = image
          }
        }
        return next
      })
      setProductNameBySpuId((prev) => {
        const next = { ...prev }
        for (const entry of details) {
          const productName = entry?.detail.product?.name?.trim()
          if (entry && productName) {
            next[entry.spuId] = productName
          }
        }
        return next
      })
    })()

    return () => {
      cancelled = true
    }
  }, [cartItems])

  const orderItems = useMemo(() => {
    return cartItems.map((item) => {
      const spuId = normalizeSpuId(item.sku.spuId)
      const matchedTier = matchPriceTier(item.sku.priceTiers, item.qty)
      const unitPriceFen = typeof matchedTier?.unitPriceFen === 'number' ? matchedTier.unitPriceFen : null
      const subtotalFen = unitPriceFen === null ? null : unitPriceFen * item.qty
      return {
        ...item,
        spuId,
        productName: spuId ? productNameBySpuId[spuId] ?? item.sku.name : item.sku.name,
        imageUrl: spuId ? productImageBySpuId[spuId] : undefined,
        unitPriceFen,
        subtotalFen
      }
    })
  }, [cartItems, productImageBySpuId, productNameBySpuId])

  const hasPendingPrice = orderItems.some((item) => item.unitPriceFen === null)
  const totalQty = orderItems.reduce((sum, item) => sum + item.qty, 0)
  const totalFen = hasPendingPrice
    ? 0
    : orderItems.reduce((sum, item) => sum + (item.subtotalFen ?? 0), 0)
  const submitDisabled = submitting || loadingData || !cartItems.length || !defaultAddress

  const handleSubmit = async () => {
    if (!cartItems.length) {
      await Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    if (!defaultAddress) {
      await Taro.showToast({ title: '请添加收货地址', icon: 'none' })
      return
    }
    if (hasPendingPrice) {
      await Taro.showToast({ title: '当前商品数量未命中价格区间', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    setSubmitting(true)
    try {
      const order = await commerceServices.orders.submit({
        address: {
          receiverName: defaultAddress.receiverName,
          receiverPhone: defaultAddress.receiverPhone,
          detail: defaultAddress.detail
        },
        remark: remark.trim() || undefined,
        items: cartItems.map((item) => ({
          cartItemId: item.id,
          skuId: item.sku.id,
          qty: item.qty
        }))
      })
      let toastTitle = '订单已提交'
      let toastIcon: 'success' | 'none' = 'success'

      try {
        const payment = await paymentServices.sessions.payForOrder(order.id)
        const paymentStatus = String(payment.status || '').toUpperCase()
        if (paymentStatus === 'PAID') {
          toastTitle = '支付成功'
        } else {
          toastTitle = '订单已提交，支付确认中'
          toastIcon = 'none'
        }
      } catch (paymentError) {
        console.warn('pay order failed', paymentError)
        if (isPaymentCancelled(paymentError)) {
          toastTitle = '订单已提交，支付已取消'
        } else {
          toastTitle = '订单已提交，待确认支付'
        }
        toastIcon = 'none'
      }

      await Taro.showToast({ title: toastTitle, icon: toastIcon })
      await navigateTo(orderDetailRoute(order.id))
    } catch (error) {
      console.warn('submit order failed', error)
      await Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenGoodsDetail = async (spuId: string) => {
    if (!spuId) return
    await navigateTo(goodsDetailRoute(spuId))
  }

  return (
    <View className='page order-confirm-page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.cart))} />
        <Navbar.Title>确认订单</Navbar.Title>
      </Navbar>

      <View className='page-content order-confirm-content'>
        <View className='order-confirm-card order-confirm-address-card' onClick={() => navigateTo(ROUTES.addressList)}>
          <View className='order-confirm-card-head'>
            <Text className='order-confirm-card-title'>收货地址</Text>
            <Text className='order-confirm-card-link'>
              管理
            </Text>
          </View>
          {defaultAddress ? (
            <View className='order-confirm-address-body'>
              <Text className='order-confirm-address-contact'>
                {defaultAddress.receiverName} · {defaultAddress.receiverPhone}
              </Text>
              <Text className='order-confirm-address-detail'>{defaultAddress.detail}</Text>
            </View>
          ) : (
            <View className='order-confirm-address-empty'>
              <Text className='order-confirm-address-empty-copy'>暂无地址，请先添加。</Text>
              <Button
                size='small'
                color='primary'
                className='mt-3'
                onClick={() => navigateTo(ROUTES.addressList)}
              >
                添加地址
              </Button>
            </View>
          )}
        </View>

        <View className='order-confirm-card order-confirm-goods-card'>
          <View className='order-confirm-card-head'>
            <Text className='order-confirm-card-title'>商品</Text>
            <Text className='order-confirm-card-hint'>{`共 ${totalQty} 件`}</Text>
          </View>
          {loadingData && cart === null ? (
            <View className='order-confirm-loading-list'>
              <View className='order-confirm-loading-row' />
              <View className='order-confirm-loading-row' />
            </View>
          ) : orderItems.length > 0 ? (
            orderItems.map((item) => (
              <View
                key={item.id}
                className='order-confirm-item'
                onClick={() => void handleOpenGoodsDetail(item.spuId)}
              >
                <SafeImage
                  className='order-confirm-item-image'
                  src={item.imageUrl}
                  width={88}
                  height={88}
                  mode='aspectFill'
                />
                <View className='order-confirm-item-main'>
                  <View className='order-confirm-item-head'>
                    <Text className='order-confirm-item-title'>{item.productName}</Text>
                    <Text className='order-confirm-item-qty'>×{item.qty}</Text>
                  </View>
                  <Text className='order-confirm-item-spec'>{item.sku.spec ?? '标准规格'}</Text>
                  <View className='order-confirm-item-price-row'>
                    <Text className='order-confirm-item-unit-price'>
                      单价 {item.unitPriceFen === null ? '询价' : formatFen(item.unitPriceFen)}
                    </Text>
                    <Text className='order-confirm-item-subtotal'>
                      {item.subtotalFen === null ? '待确认报价' : formatFen(item.subtotalFen)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View className='order-confirm-empty-copy'>
              <Text>购物车为空</Text>
            </View>
          )}
        </View>

        <View className='order-confirm-card order-confirm-price-card'>
          <View className='order-confirm-price-row'>
            <Text className='order-confirm-price-label'>商品总额</Text>
            <Text className='order-confirm-price-text'>{hasPendingPrice ? '待确认报价' : formatFen(totalFen)}</Text>
          </View>
          <View className='order-confirm-price-row order-confirm-price-row--total'>
            <Text className='order-confirm-price-label'>应付合计</Text>
            <Text className='order-confirm-price-total'>{hasPendingPrice ? '待确认报价' : formatFen(totalFen)}</Text>
          </View>
        </View>

        <View className='order-confirm-card order-confirm-remark-card'>
          <View className='order-confirm-card-head order-confirm-card-head--compact' onClick={() => setRemarkExpanded((value) => !value)}>
            <Text className='order-confirm-card-title'>订单备注</Text>
            <Text className='order-confirm-card-link'>
              {remark.trim() ? summarizeRemark(remark) : '选填'}
            </Text>
          </View>
          {remarkExpanded ? (
            <Textarea
              className='order-confirm-remark-input'
              placeholder='添加订单备注...'
              value={remark}
              onInput={(event) => setRemark(event.detail.value)}
            />
          ) : null}
        </View>
      </View>

      <FixedView position='bottom' placeholder>
        <View className='order-confirm-bottom-bar'>
          <View className='order-confirm-bottom-summary'>
            <Text className='order-confirm-bottom-label'>{`合计 · 共 ${totalQty} 件`}</Text>
            <Text className='order-confirm-bottom-value'>{hasPendingPrice ? '待确认报价' : formatFen(totalFen)}</Text>
          </View>
          <Button
            color='primary'
            className='order-confirm-submit-button'
            disabled={submitDisabled}
            loading={submitting}
            onClick={handleSubmit}
          >
            提交订单
          </Button>
        </View>
      </FixedView>
    </View>
  )
}

const normalizeSpuId = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const formatFen = (fen: number): string => `¥${(fen / 100).toFixed(2)}`

const summarizeRemark = (value: string): string => {
  const normalized = value.trim()
  if (!normalized) {
    return '选填'
  }
  return normalized.length > 10 ? `${normalized.slice(0, 10)}...` : normalized
}
