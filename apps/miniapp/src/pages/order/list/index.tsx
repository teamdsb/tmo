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
import { ROUTES, orderDetailRoute, orderTrackingRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

const TABS: { label: string; status?: OrderStatus }[] = [
  { label: '全部' },
  { label: '待处理', status: 'SUBMITTED' },
  { label: '已确认', status: 'CONFIRMED' },
  { label: '已发货', status: 'SHIPPED' },
  { label: '已完成', status: 'DELIVERED' }
]

export default function OrderHistoryApp() {
  const [activeTab, setActiveTab] = useState(TABS[0].label)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
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

  const filteredOrders = useMemo(() => {
    const tab = TABS.find((item) => item.label === activeTab)
    const status = tab?.status
    return orders.filter((order) => {
      if (status && order.status !== status) {
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
                {filteredOrders.map((order) => (
                  <Cell key={order.id} bordered={false}>
                    <Flex justify='between' align='center'>
                      <View>
                        <Text className='order-date'>{formatDate(order.createdAt)}</Text>
                      </View>
                      <Tag size='small' color={statusTone(order.status)}>
                        {statusLabel(order.status)}
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
                      <Button
                        size='small'
                        variant='outlined'
                        onClick={() => navigateTo(orderDetailRoute(order.id))}
                      >
                        详情
                      </Button>
                      <Button
                        size='small'
                        color='primary'
                        onClick={() => navigateTo(orderTrackingRoute(order.id))}
                      >
                        物流
                      </Button>
                      {isShippedStatus(order.status) ? (
                        <Button
                          size='small'
                          color='success'
                          loading={confirmingOrderId === order.id}
                          onClick={() => void handleConfirmReceipt(order)}
                        >
                          确认收货
                        </Button>
                      ) : null}
                    </Flex>
                  </Cell>
                ))}
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

const statusTone = (status: OrderStatus | string): 'info' | 'warning' | 'success' => {
  switch (status) {
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
