import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import type { Order, OrderItem, OrderStatus } from '@tmo/api-client'
import { ROUTES, orderTrackingRoute } from '../../../routes'
import SafeImage from '../../../components/safe-image'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import {
  clearDevFakePaymentOverride,
  createDevFakePaymentOverride,
  loadDevFakePaymentOverride,
  saveDevFakePaymentOverride,
  type DevFakePaymentOverride
} from '../../../services/payment-dev-overrides'
import { isPaymentCancelled, paymentServices } from '../../../services/payment'
import './index.scss'

export default function OrderDetail() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [itemsExpanded, setItemsExpanded] = useState(false)

  const orderId = router.params?.id
  const orderItems = useMemo(() => order?.items ?? [], [order])
  const totalQty = orderItemCount(order)
  const firstItem = orderItems[0] ?? null
  const heroContent = getHeroContent(order)
  const detailRows = buildDetailRows(order)

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.orders))
  }

  const loadOrder = async (targetOrderId: string) => {
    setLoading(true)
    try {
      const response = await commerceServices.orders.get(targetOrderId)
      setOrder(await applyPaymentOverride(response))
    } catch (error) {
      console.warn('load order failed', error)
      await Taro.showToast({ title: '加载订单失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return
    void loadOrder(orderId)
  }, [orderId])

  const handlePay = async () => {
    if (!orderId || typeof orderId !== 'string') {
      return
    }

    setPaymentLoading(true)
    try {
      const payment = await paymentServices.sessions.payForOrder(orderId)
      await saveDevFakePaymentOverride(createDevFakePaymentOverride(
        orderId,
        payment.paidAt ?? payment.updatedAt ?? new Date().toISOString()
      ))
      const nextPaymentStatus = String(payment.status || '').toUpperCase()
      await Taro.showToast({
        title: nextPaymentStatus === 'PAID' ? '支付成功' : '支付结果确认中',
        icon: nextPaymentStatus === 'PAID' ? 'success' : 'none'
      })
    } catch (error) {
      console.warn('continue pay failed', error)
      await Taro.showToast({
        title: isPaymentCancelled(error) ? '支付已取消' : '支付未完成',
        icon: 'none'
      })
    } finally {
      await loadOrder(orderId)
      setPaymentLoading(false)
    }
  }

  const handleRefreshPayment = async () => {
    const paymentId = readLatestPaymentId(order)
    if (!paymentId) {
      return
    }

    setPaymentLoading(true)
    try {
      const payment = await paymentServices.sessions.recheck(paymentId)
      const nextPaymentStatus = String(payment.status || '').toUpperCase()
      await Taro.showToast({
        title: nextPaymentStatus === 'PAID' ? '支付成功' : '支付状态已刷新',
        icon: nextPaymentStatus === 'PAID' ? 'success' : 'none'
      })
    } catch (error) {
      console.warn('refresh payment failed', error)
      await Taro.showToast({ title: '刷新支付状态失败', icon: 'none' })
    } finally {
      if (orderId && typeof orderId === 'string') {
        await loadOrder(orderId)
      }
      setPaymentLoading(false)
    }
  }

  return (
    <View className='page order-detail-page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar order-detail-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>订单详情</Navbar.Title>
      </Navbar>

      <View className='page-content order-detail-content'>
        <View className='order-detail-hero'>
          <View className={`order-detail-hero-icon order-detail-hero-icon--${heroContent.tone}`}>
            <Text className='order-detail-hero-icon-mark'>{heroContent.icon}</Text>
          </View>
          <Text className='order-detail-hero-title'>{heroContent.title}</Text>
          <Text className='order-detail-hero-copy'>{heroContent.copy}</Text>
          <Text className={`order-detail-hero-badge order-detail-hero-badge--${heroContent.tone}`}>
            {heroContent.badge}
          </Text>
        </View>

        <View className='order-detail-card'>
          <View className='order-detail-card-head'>
            <Text className='order-detail-card-title'>商品清单</Text>
            <Text className='order-detail-card-accent'>{`${totalQty} 件`}</Text>
          </View>
          {firstItem ? (
            <View className='order-detail-item-summary'>
              <SafeImage
                className='order-detail-item-image'
                src={readOrderItemImage(firstItem)}
                width={56}
                height={56}
                mode='aspectFill'
              />
              <View className='order-detail-item-copy'>
                <Text className='order-detail-item-name'>{firstItem.sku.name}</Text>
                <Text className='order-detail-item-meta'>{formatItemMeta(firstItem)}</Text>
                <Text className='order-detail-item-price'>{formatItemPrice(firstItem)}</Text>
              </View>
            </View>
          ) : (
            <Text className='order-detail-empty-copy'>{loading ? '正在加载商品...' : '暂无商品信息'}</Text>
          )}
          {orderItems.length > 1 ? (
            <>
              <Button
                variant='outlined'
                className='order-detail-toggle-button'
                onClick={() => setItemsExpanded((value) => !value)}
              >
                {itemsExpanded ? '收起商品' : `查看全部商品（${orderItems.length}）`}
              </Button>
              {itemsExpanded ? (
                <View className='order-detail-item-list'>
                  {orderItems.map((item) => (
                    <View key={`${order?.id}-${item.sku.id}`} className='order-detail-item-row'>
                      <Text className='order-detail-item-row-name'>{item.sku.name}</Text>
                      <Text className='order-detail-item-row-meta'>{formatItemMeta(item)}</Text>
                      <Text className='order-detail-item-row-price'>{formatItemPrice(item)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View className='order-detail-card'>
          <View className='order-detail-card-head'>
            <Text className='order-detail-card-title'>订单信息</Text>
            {order?.id ? <Text className='order-detail-card-caption'>{`ID: ${order.id}`}</Text> : null}
          </View>
          <View className='order-detail-info-list'>
            {detailRows.map((row) => (
              <View key={row.label} className='order-detail-info-row'>
                <Text className='order-detail-info-label'>{row.label}</Text>
                <Text className='order-detail-info-value'>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='order-detail-card'>
          <View className='order-detail-card-head order-detail-card-head--with-icon'>
            <Text className='order-detail-card-head-icon'>⌖</Text>
            <Text className='order-detail-card-title'>收货地址</Text>
          </View>
          <View className='order-detail-address-copy'>
            <Text className='order-detail-address-name'>{order?.address?.receiverName ?? '未提供地址'}</Text>
            {order?.address?.receiverPhone ? (
              <Text className='order-detail-address-phone'>{order.address.receiverPhone}</Text>
            ) : null}
            <Text className='order-detail-address-detail'>{formatAddressDetail(order)}</Text>
          </View>
          <View className='order-detail-address-map'>
            <View className='order-detail-address-map-shape order-detail-address-map-shape--a' />
            <View className='order-detail-address-map-shape order-detail-address-map-shape--b' />
            <View className='order-detail-address-map-pin' />
          </View>
        </View>
      </View>

      <View className='order-detail-footer'>
        {(canContinuePay(order) || canRefreshPayment(order)) ? (
          <View className='order-detail-footer-stack'>
            {canContinuePay(order) ? (
              <Button block color='primary' className='order-detail-footer-button' loading={paymentLoading} onClick={handlePay}>
                继续支付
              </Button>
            ) : null}
            {canRefreshPayment(order) ? (
              <Button block variant='outlined' className='order-detail-footer-button' loading={paymentLoading} onClick={handleRefreshPayment}>
                刷新支付状态
              </Button>
            ) : null}
          </View>
        ) : null}
        <View className='order-detail-footer-main'>
          <Button block variant='outlined' className='order-detail-footer-secondary' onClick={() => switchTabLike(ROUTES.home)}>
            返回商城
          </Button>
          <Button
            block
            color='primary'
            className='order-detail-footer-primary'
            onClick={() => order?.id && navigateTo(orderTrackingRoute(order.id))}
          >
            查看物流
          </Button>
        </View>
      </View>
    </View>
  )
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const orderItemCount = (order: Order | null) => {
  if (!order) return 0
  return order.items.reduce((sum, item) => sum + item.qty, 0)
}

const formatItemPrice = (item: OrderItem) => {
  const total = item.qty * item.unitPriceFen
  return `¥${(total / 100).toFixed(2)}`
}

const formatItemMeta = (item: OrderItem) => {
  const spec = typeof item.sku.spec === 'string' && item.sku.spec.trim() ? item.sku.spec.trim() : '标准规格'
  return `${spec} · x${item.qty}`
}

const readOrderItemImage = (item: OrderItem): string | undefined => {
  const image = (item as OrderItem & { imageUrl?: unknown; coverImageUrl?: unknown }).imageUrl
    ?? (item as OrderItem & { imageUrl?: unknown; coverImageUrl?: unknown }).coverImageUrl
  return typeof image === 'string' && image.trim() ? image.trim() : undefined
}

const formatAddressDetail = (order: Order | null) => {
  const address = order?.address
  if (!address) return '未提供地址'
  const parts = [address.province, address.city, address.district, address.detail].filter(Boolean)
  return parts.join(' ') || '未提供地址'
}

const statusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'SUBMITTED':
      return '已提交'
    case 'CONFIRMED':
      return '已确认'
    case 'PAY_PENDING':
      return '待支付'
    case 'PAID':
      return '已支付'
    case 'PAY_FAILED':
      return '支付失败'
    case 'SHIPPED':
      return '已发货'
    case 'DELIVERED':
      return '已送达'
    default:
      return status
  }
}

const readPaymentStatus = (order: Order | null): string => {
  if (!order || typeof order !== 'object') {
    return ''
  }
  const value = (order as Order & { paymentStatus?: unknown }).paymentStatus
  return typeof value === 'string' ? value : ''
}

const readLatestPaymentId = (order: Order | null): string => {
  if (!order || typeof order !== 'object') {
    return ''
  }
  const value = (order as Order & { latestPaymentId?: unknown }).latestPaymentId
  return typeof value === 'string' ? value : ''
}

const paymentStatusLabel = (order: Order | null): string => {
  const paymentStatus = readPaymentStatus(order).toUpperCase()
  if (!paymentStatus) {
    return order ? statusLabel(order.status) : '--'
  }
  switch (paymentStatus) {
    case 'PAID':
      return '已支付'
    case 'PAY_PENDING':
    case 'PENDING':
    case 'CREATED':
      return '待支付'
    case 'PAY_FAILED':
    case 'FAILED':
      return '支付失败'
    default:
      return paymentStatus
  }
}

const getHeroContent = (order: Order | null) => {
  const paymentStatus = readPaymentStatus(order).toUpperCase()
  if (paymentStatus === 'PAID') {
    return {
      tone: 'success',
      icon: '✓',
      title: '支付成功',
      copy: '您的订单已确认，我们会尽快安排发货。',
      badge: 'PAID / 已支付'
    }
  }
  if (paymentStatus === 'PAY_FAILED' || paymentStatus === 'FAILED') {
    return {
      tone: 'danger',
      icon: '!',
      title: '支付失败',
      copy: '订单已创建，请重新支付或刷新支付状态后再查看。',
      badge: 'PAY FAILED / 支付失败'
    }
  }
  return {
    tone: 'pending',
    icon: '·',
    title: order ? '等待支付完成' : '正在加载订单',
    copy: order ? '订单已生成，完成支付后我们将立即处理。' : '正在同步订单状态，请稍候。',
    badge: order ? 'PENDING / 待支付' : 'LOADING / 加载中'
  }
}

const buildDetailRows = (order: Order | null) => {
  return [
    { label: '创建时间', value: order ? formatDate(order.createdAt) : '--' },
    { label: '商品数量', value: `${orderItemCount(order)} 件` },
    { label: '支付状态', value: paymentStatusLabel(order) },
    { label: '订单号', value: order?.id ?? '--' }
  ]
}

const canContinuePay = (order: Order | null): boolean => {
  if (!order) {
    return false
  }
  if (readPaymentStatus(order).toUpperCase() === 'PAID') {
    return false
  }
  return order.status === 'SUBMITTED' || order.status === 'PAY_PENDING' || order.status === 'PAY_FAILED'
}

const canRefreshPayment = (order: Order | null): boolean => {
  if (!order) {
    return false
  }
  return Boolean(readLatestPaymentId(order)) && readPaymentStatus(order).toUpperCase() !== 'PAID'
}

const applyPaymentOverride = async (order: Order): Promise<Order> => {
  const paymentStatus = readPaymentStatus(order).toUpperCase()
  if (paymentStatus === 'PAID') {
    await clearDevFakePaymentOverride(order.id)
    return order
  }

  const override = await loadDevFakePaymentOverride(order.id)
  if (!override) {
    return order
  }

  return mergeOrderWithPaymentOverride(order, override)
}

const mergeOrderWithPaymentOverride = (order: Order, override: DevFakePaymentOverride): Order => {
  return {
    ...order,
    status: override.status,
    paymentStatus: override.paymentStatus,
    latestPaymentId: override.latestPaymentId,
    paidAt: override.paidAt,
    updatedAt: override.updatedAt
  } as Order
}
