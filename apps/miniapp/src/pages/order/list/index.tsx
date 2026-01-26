import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Tabs from '@taroify/core/tabs'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import type { Order, OrderStatus } from '@tmo/api-client'
import AppTabbar from '../../../components/app-tabbar'
import { orderDetailRoute, orderTrackingRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

const TABS: { label: string; status?: OrderStatus }[] = [
  { label: 'All' },
  { label: 'Pending', status: 'SUBMITTED' },
  { label: 'Confirmed', status: 'CONFIRMED' },
  { label: 'Shipped', status: 'SHIPPED' },
  { label: 'Completed', status: 'DELIVERED' }
]

export default function OrderHistoryApp() {
  const [activeTab, setActiveTab] = useState(TABS[0].label)
  const [searchQuery, setSearchQuery] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.orders.list({ page: 1, pageSize: 20 })
        setOrders(response.items ?? [])
      } catch (error) {
        console.warn('load orders failed', error)
        await Taro.showToast({ title: 'Failed to load orders', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredOrders = useMemo(() => {
    const tab = TABS.find((item) => item.label === activeTab)
    const status = tab?.status
    const query = searchQuery.trim().toLowerCase()
    return orders.filter((order) => {
      if (status && order.status !== status) {
        return false
      }
      if (!query) return true
      if (order.id.toLowerCase().includes(query)) return true
      return order.items.some((item) => item.sku.name.toLowerCase().includes(query))
    })
  }, [activeTab, orders, searchQuery])

  return (
    <View className='page page-compact-navbar'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchQuery}
          shape='round'
          clearable
          placeholder='Search by Order ID or Product...'
          onChange={(event) => setSearchQuery(event.detail.value)}
        />
      </View>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
        {TABS.map((tab) => (
          <Tabs.TabPane key={tab.label} value={tab.label} title={tab.label}>
            <Cell.Group inset>
              {filteredOrders.map((order) => (
                <Cell key={order.id} bordered={false}>
                  <Flex justify='space-between' align='center'>
                    <View>
                      <Text className='order-id'>{order.id}</Text>
                      <Text className='order-date'>{formatDate(order.createdAt)}</Text>
                    </View>
                    <Tag size='small' color={statusTone(order.status)}>
                      {statusLabel(order.status)}
                    </Tag>
                  </Flex>

                  <View className='order-title'>
                    <Text>{order.items[0]?.sku.name ?? 'Order items'}</Text>
                  </View>

                  <Flex justify='space-between' align='center'>
                    <Text className='order-meta'>{orderItemCount(order)} Items</Text>
                    <View className='order-price'>
                      <Text className='order-label'>Total</Text>
                      <Text className='order-value'>{formatOrderTotal(order)}</Text>
                    </View>
                  </Flex>

                  <Flex align='center' gutter={8} className='order-actions'>
                    <Button
                      size='small'
                      variant='outlined'
                      onClick={() => navigateTo(orderDetailRoute(order.id))}
                    >
                      Details
                    </Button>
                    <Button
                      size='small'
                      color='primary'
                      onClick={() => navigateTo(orderTrackingRoute(order.id))}
                    >
                      Track
                    </Button>
                  </Flex>
                </Cell>
              ))}
              {filteredOrders.length === 0 ? (
                <Cell title={loading ? 'Loading orders...' : 'No orders found'} />
              ) : null}
            </Cell.Group>
          </Tabs.TabPane>
        ))}
      </Tabs>

      <AppTabbar value='orders' />
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

const statusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted'
    case 'CONFIRMED':
      return 'Confirmed'
    case 'PAY_PENDING':
      return 'Pay Pending'
    case 'PAID':
      return 'Paid'
    case 'PAY_FAILED':
      return 'Pay Failed'
    case 'SHIPPED':
      return 'Shipped'
    case 'DELIVERED':
      return 'Delivered'
    default:
      return status
  }
}

const statusTone = (status: OrderStatus): 'info' | 'warning' | 'success' => {
  switch (status) {
    case 'SUBMITTED':
    case 'PAY_PENDING':
      return 'warning'
    case 'SHIPPED':
      return 'info'
    case 'DELIVERED':
      return 'success'
    default:
      return 'info'
  }
}
