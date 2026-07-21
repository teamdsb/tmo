import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tabs from '@taroify/core/tabs'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import type { Order, OrderStatus } from '@tmo/api-client'
import Flex from '../../../components/flex'
import { ROUTES, orderDetailRoute, orderSuccessRoute, orderTrackingRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import { isPaymentCancelled, paymentServices } from '../../../services/payment'
import { buildOrderPaymentIdempotencyKey, resolvePaymentAvailability } from '../../../services/payment-availability'

const orderPaymentResultToastDuration = 3000

const TABS: { label: string; statuses?: string[] }[] = [
  { label: '全部' },
  { label: '待处理', statuses: ['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED'] },
  { label: '已确认', statuses: ['CONFIRMED', 'PAID'] },
  { label: '已发货', statuses: ['SHIPPED', 'DISPATCHED'] },
  { label: '已完成', statuses: ['DELIVERED'] }
]

export default function OrderHistoryApp() {
  const [activeTab, setActiveTab] = useState(TABS[0].label)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null)
  const navbarStyle = getNavbarStyle()

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))
  }

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await commerceServices.orders.list({ page: 1, pageSize: 20 })
      setOrders(response.items ?? [])
    } catch (error) {
      console.warn('load orders failed', error)
      await Taro.showToast({ title: '加载订单失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const handleConfirmReceipt = async (order: Order) => {
    const result = await Taro.showModal({
      title: '确认收货',
      content: '确认已收到该订单商品？'
    })
    if (!result.confirm) {
      return
    }

    setConfirmingOrderId(order.id)
    try {
      await commerceServices.orders.confirmReceipt(order.id)
      await Taro.showToast({ title: '已确认收货', icon: 'success' })
      await loadOrders()
      setActiveTab('已完成')
    } catch (error) {
      console.warn('confirm receipt failed', error)
      await Taro.showToast({ title: '确认收货失败', icon: 'none' })
    } finally {
      setConfirmingOrderId(null)
    }
  }

  const handlePayOrder = async (order: Order) => {
    if (!canContinuePay(order)) {
      await navigateTo(orderDetailRoute(order.id))
      return
    }

    setPayingOrderId(order.id)
    let paymentConfirmed = false
    try {
      const availability = await resolvePaymentAvailability()
      if (!availability.available) {
        await Taro.showToast({
          title: availability.unavailableMessage || '支付暂未开通',
          icon: 'none'
        })
        return
      }

      const payment = await paymentServices.sessions.payForOrder(order.id, {
        channel: availability.channel,
        idempotencyKey: buildOrderPaymentIdempotencyKey(order.id)
      })
      const nextPaymentStatus = String(payment.status || '').toUpperCase()
      paymentConfirmed = nextPaymentStatus === 'PAID'
      await Taro.showToast({
        title: paymentConfirmed ? '支付成功' : '支付结果确认中',
        icon: paymentConfirmed ? 'success' : 'none',
        duration: orderPaymentResultToastDuration
      })
    } catch (error) {
      console.warn('pay order from list failed', error)
      await Taro.showToast({
        title: isPaymentCancelled(error) ? '支付已取消' : '支付未完成，请重试',
        icon: 'none'
      })
    } finally {
      setPayingOrderId(null)
      if (!paymentConfirmed) {
        await loadOrders()
      }
    }

    if (paymentConfirmed) {
      await navigateTo(orderSuccessRoute(order.id, 'paid'))
    }
  }

  const filteredOrders = useMemo(() => {
    const tab = TABS.find((item) => item.label === activeTab)
    const statuses = tab?.statuses
    return orders.filter((order) => {
      if (statuses && !statuses.includes(String(order.status))) {
        return false
      }
      return true
    })
  }, [activeTab, orders])

  return (
    <View className='page page-compact-navbar order-history-page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>订单列表</Navbar.Title>
      </Navbar>

      <View className='order-history-body'>
        <Tabs className='order-history-tabs' value={activeTab} onChange={(value) => setActiveTab(String(value))}>
          {TABS.map((tab) => (
            <Tabs.TabPane key={tab.label} value={tab.label} title={tab.label}>
              <Cell.Group inset>
                {filteredOrders.map((order) => {
                  const showContinuePay = canContinuePay(order)
                  const showLogistics = canViewLogistics(order)
                  return (
                  <Cell key={order.id} bordered={false} className='order-history-card'>
                    <Flex justify='between' align='center'>
                      <View>
                        <Text className='order-date'>{formatDate(order.createdAt)}</Text>
                      </View>
                      <Tag size='small' color={statusTone(order)}>
                        {orderStatusLabel(order)}
                      </Tag>
                    </Flex>

                    <View className='order-title'>
                      <Text>{order.items[0]?.sku.name ?? '订单商品'}</Text>
                    </View>

                    <Flex justify='between' align='center'>
                      <Text className='order-meta'>{orderItemCount(order)} 件</Text>
                      <View className='order-price'>
                        <Text className='order-label'>合计</Text>
                        <Text className='order-value'>{formatOrderTotal(order)}</Text>
                      </View>
                    </Flex>

                    <Flex align='center' gutter={8} className='order-actions'>
                      {showContinuePay ? (
                        <Button
                          size='small'
                          color='primary'
                          className='order-action-button order-action-button--pay'
                          loading={payingOrderId === order.id}
                          onClick={() => void handlePayOrder(order)}
                        >
                          去支付
                        </Button>
                      ) : null}
                      <Button
                        size='small'
                        variant='outlined'
                        className='order-action-button order-action-button--ghost'
                        onClick={() => navigateTo(orderDetailRoute(order.id))}
                      >
                        详情
                      </Button>
                      {showLogistics ? (
                        <Button
                          size='small'
                          color='primary'
                          className='order-action-button'
                          onClick={() => navigateTo(orderTrackingRoute(order.id))}
                        >
                          物流
                        </Button>
                      ) : null}
                      {isShippedStatus(order.status) ? (
                        <Button
                          size='small'
                          color='success'
                          className='order-action-button order-action-button--success'
                          loading={confirmingOrderId === order.id}
                          onClick={() => void handleConfirmReceipt(order)}
                        >
                          确认收货
                        </Button>
                      ) : null}
                    </Flex>
                  </Cell>
                )})}
                {filteredOrders.length === 0 ? (
                  <Cell title={loading ? '正在加载订单...' : '暂无订单'} />
                ) : null}
              </Cell.Group>
            </Tabs.TabPane>
          ))}
        </Tabs>
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

const orderItemCount = (order: Order) => {
  return order.items.reduce((sum, item) => sum + item.qty, 0)
}

const formatOrderTotal = (order: Order) => {
  const totalFen = order.items.reduce((sum, item) => sum + item.qty * item.unitPriceFen, 0)
  return `¥${(totalFen / 100).toFixed(2)}`
}

const isShippedStatus = (status: OrderStatus | string) => status === 'SHIPPED' || status === 'DISPATCHED'

const readPaymentStatus = (order: Order | null): string => {
  if (!order || typeof order !== 'object') {
    return ''
  }
  const value = (order as Order & { paymentStatus?: unknown }).paymentStatus
  return typeof value === 'string' ? value : ''
}

const canContinuePay = (order: Order | null): boolean => {
  if (!order) {
    return false
  }
  const paymentStatus = readPaymentStatus(order).toUpperCase()
  if (paymentStatus === 'PAID') {
    return false
  }
  return order.status === 'SUBMITTED' || order.status === 'PAY_PENDING' || order.status === 'PAY_FAILED'
}

const canViewLogistics = (order: Order | null): boolean => {
  if (!order) {
    return false
  }
  if (readPaymentStatus(order).toUpperCase() === 'PAID') {
    return true
  }
  const orderStatus = String(order.status)
  return orderStatus === 'PAID' || orderStatus === 'SHIPPED' || orderStatus === 'DISPATCHED' || orderStatus === 'DELIVERED'
}

const orderStatusLabel = (order: Order): string => {
  const paymentStatus = readPaymentStatus(order).toUpperCase()
  if (paymentStatus === 'PAY_PENDING' || paymentStatus === 'UNPAID' || paymentStatus === 'PENDING' || paymentStatus === 'CREATED') {
    return '待支付'
  }
  if (paymentStatus === 'PAY_FAILED' || paymentStatus === 'FAILED') {
    return '支付失败'
  }
  if (paymentStatus === 'PAID' && (order.status === 'SUBMITTED' || order.status === 'PAY_PENDING' || order.status === 'PAY_FAILED')) {
    return '已支付'
  }
  return statusLabel(order.status)
}

const statusLabel = (status: OrderStatus | string) => {
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
    case 'DISPATCHED':
      return '已发货'
    case 'DELIVERED':
      return '已送达'
    default:
      return status
  }
}

const statusTone = (order: Order): 'info' | 'warning' | 'success' => {
  if (canContinuePay(order)) {
    return 'warning'
  }
  switch (String(order.status)) {
    case 'SUBMITTED':
    case 'PAY_PENDING':
      return 'warning'
    case 'SHIPPED':
    case 'DISPATCHED':
      return 'info'
    case 'DELIVERED':
      return 'success'
    default:
      return 'info'
  }
}
