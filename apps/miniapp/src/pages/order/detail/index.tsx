import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import type { Order, OrderItem, OrderStatus } from '@tmo/api-client'
import { ROUTES, orderTrackingRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import { isPaymentCancelled, paymentServices } from '../../../services/payment'

export default function OrderDetail() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const orderId = router.params?.id

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.orders))
  }

  const loadOrder = async (targetOrderId: string) => {
    setLoading(true)
    try {
      const response = await commerceServices.orders.get(targetOrderId)
      setOrder(response)
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
      const paymentStatus = String(payment.status || '').toUpperCase()
      await Taro.showToast({
        title: paymentStatus === 'PAID' ? '支付成功' : '支付结果确认中',
        icon: paymentStatus === 'PAID' ? 'success' : 'none'
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
      const paymentStatus = String(payment.status || '').toUpperCase()
      await Taro.showToast({
        title: paymentStatus === 'PAID' ? '支付成功' : '支付状态已刷新',
        icon: paymentStatus === 'PAID' ? 'success' : 'none'
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
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>订单 {order?.id ?? '...'}</Navbar.Title>
        <Navbar.NavRight>
          <Tag size='small' color={order ? statusTone(order.status) : 'info'}>
            {order ? statusLabel(order.status) : '加载中'}
          </Tag>
        </Navbar.NavRight>
      </Navbar>
      <View className='page-content'>
        <Cell.Group inset>
          <Cell title='创建时间' brief={order ? formatDate(order.createdAt) : '--'} />
          <Cell title='商品' brief={`${orderItemCount(order)} 件`} />
          <Cell title='支付状态' brief={paymentStatusLabel(order)} />
        </Cell.Group>

        <Cell.Group inset className='mt-4'>
          {(order?.items ?? []).map((item) => (
            <Cell
              key={`${order?.id}-${item.sku.id}`}
              title={item.sku.name}
              brief={`数量：${item.qty}`}
              rightIcon={<Text>{formatItemPrice(item)}</Text>}
            />
          ))}
          {!order && loading ? <Cell title='正在加载商品...' /> : null}
        </Cell.Group>

        <Cell.Group inset className='mt-4'>
          <Cell title='收货地址' brief={formatAddress(order)} />
          <Cell title='备注' brief={order?.remark ?? '无'} />
        </Cell.Group>

        <View className='placeholder-actions'>
          {canContinuePay(order) ? (
            <Button block color='primary' loading={paymentLoading} onClick={handlePay}>
              继续支付
            </Button>
          ) : null}
          {canRefreshPayment(order) ? (
            <Button
              block
              variant='outlined'
              className={canContinuePay(order) ? 'mt-3' : ''}
              loading={paymentLoading}
              onClick={handleRefreshPayment}
            >
              刷新支付状态
            </Button>
          ) : null}
          <Button
            block
            color='primary'
            className={canContinuePay(order) || canRefreshPayment(order) ? 'mt-3' : ''}
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

const formatAddress = (order: Order | null) => {
  const address = order?.address
  if (!address) return '未提供地址'
  const parts = [address.province, address.city, address.district, address.detail].filter(Boolean)
  return `${address.receiverName} · ${address.receiverPhone} · ${parts.join(' ')}`
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

const statusTone = (status: OrderStatus): 'info' | 'warning' | 'success' => {
  switch (status) {
    case 'SUBMITTED':
    case 'PAY_PENDING':
      return 'warning'
    case 'DELIVERED':
      return 'success'
    default:
      return 'info'
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
