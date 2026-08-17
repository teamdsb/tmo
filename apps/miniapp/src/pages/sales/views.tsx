import { useMemo, useState } from 'react'
import { Input, Text, View } from '@tarojs/components'
import { ArrowRight, Qr, Search, TodoList } from '@taroify/icons'
import type { Order as ApiOrder } from '@tmo/api-client'
import type { Customer } from '@tmo/identity-services'
import { formatPhoneForDisplay } from '@tmo/shared/formatters'
import {
  customerSubFilters,
  getStatusTone
} from './data'
import type { CustomerSubFilter, OrderStatus } from './types'
import SafeImage from '../../components/safe-image'
import salesQrPlaceholder from './assets/sales-qr-placeholder.svg'
import { navigateTo } from '../../utils/navigation'
import { orderDetailRoute } from '../../routes'

type DashboardViewProps = {
  qrCodeUrl: string
  qrError: string
  qrLoading: boolean
  qrPlatformLabel: string
  qrScene: string
  salesName: string
  salesRole: string
  onRefreshQr: () => void
}

export function DashboardView({
  qrCodeUrl,
  qrError,
  qrLoading,
  qrPlatformLabel,
  qrScene,
  salesName,
  salesRole,
  onRefreshQr
}: DashboardViewProps) {
  return (
    <View className='sales-screen sales-dashboard-screen'>
      <View className='sales-dashboard-stack'>
        <View className='sales-dashboard-profile'>
          <View className='sales-dashboard-avatar'>
            <Text className='sales-dashboard-avatar-text'>{salesName.slice(0, 1) || '销'}</Text>
          </View>
          <Text className='sales-dashboard-name'>{salesName}</Text>
          <Text className='sales-dashboard-role'>{salesRole}</Text>
        </View>

        <View className='sales-dashboard-card'>
          <View className='sales-dashboard-qr-shell'>
            {qrCodeUrl ? (
              <SafeImage
                wrapperClassName='sales-dashboard-qr-image-wrapper'
                className='sales-dashboard-qr-image'
                src={qrCodeUrl}
                fallback={salesQrPlaceholder}
                width='100%'
                height='100%'
                mode='aspectFit'
              />
            ) : (
              <Qr className='sales-dashboard-qr' />
            )}
          </View>
          <Text className='sales-dashboard-card-title'>您的专属推广二维码</Text>
          <Text className='sales-dashboard-card-copy'>
            客户扫码后将打开{qrPlatformLabel}小程序并进入登录流程，首次登录后自动归属到您名下。
          </Text>
          {qrScene ? (
            <Text className='sales-dashboard-card-meta'>渠道码：{qrScene}</Text>
          ) : null}
          {qrError ? (
            <Text className='sales-dashboard-card-error'>{qrError}</Text>
          ) : null}
          <View className='sales-dashboard-card-action' onClick={onRefreshQr}>
            <Text className='sales-dashboard-card-action-text'>{qrLoading ? '生成中...' : '刷新二维码'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

type CustomersViewProps = {
  customers: Customer[]
  error: string
  loading: boolean
  onSearch: (query: string) => void
}

const formatCreatedAt = (createdAt: string): string => {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) {
    return '未知'
  }
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

export function CustomersView({ customers, error, loading, onSearch }: CustomersViewProps) {
  const [query, setQuery] = useState('')

  return (
    <View className='sales-screen sales-customers-screen'>
      <View className='sales-page-header'>
        <Text className='sales-page-title'>客户列表</Text>
        <View className='sales-header-action'>
          <Qr className='text-base sales-primary-text' />
        </View>
      </View>

      <View className='sales-search-shell sales-search-compact'>
        <View className='sales-search-icon-wrap'>
          <Search className='sales-search-icon' />
        </View>
        <Input
          className='sales-search-input'
          placeholder='搜索客户...'
          confirmType='search'
          value={query}
          onInput={(event) => setQuery(event.detail.value)}
          onConfirm={() => onSearch(query)}
        />
      </View>

      <View className='sales-list-stack' id='sales-customer-list'>
        {loading ? <Text className='sales-empty-copy'>正在加载客户...</Text> : null}
        {!loading && error ? <Text className='sales-empty-copy'>{error}</Text> : null}
        {!loading && !error && customers.length === 0 ? (
          <Text className='sales-empty-copy'>{query.trim() ? '未找到匹配客户' : '暂无客户'}</Text>
        ) : null}
        {!loading && !error ? customers.map((customer) => (
          <View key={customer.id} className='sales-customer-card' id={`sales-customer-${customer.id}`}>
            <View className='sales-customer-leading'>
              <View className='sales-customer-avatar'>
                <Text className='sales-customer-avatar-text'>{customer.displayName.trim().slice(0, 1) || '客'}</Text>
              </View>
              <View className='sales-customer-body'>
                <Text className='sales-customer-name'>{customer.displayName.trim() || '未命名客户'}</Text>
                <Text className='sales-customer-contact'>{formatPhoneForDisplay(customer.phone)}</Text>
                <Text className='sales-customer-meta'>
                  创建时间：{formatCreatedAt(customer.createdAt)}
                </Text>
              </View>
            </View>
            <ArrowRight className='sales-customer-chevron' />
          </View>
        )) : null}
      </View>
    </View>
  )
}

type OrdersViewProps = {
  error: string
  loading: boolean
  orders: ApiOrder[]
}

const orderStatusLabel = (status: string): OrderStatus => {
  if (status === 'SHIPPED') return '已发货'
  if (status === 'DELIVERED') return '已送达'
  if (status === 'CONFIRMED' || status === 'PAID') return '已确认'
  return '待处理'
}

const formatOrderDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatFen = (value: number): string => `¥${(value / 100).toFixed(2)}`

const orderTotalFen = (order: ApiOrder): number => (
  order.items.reduce((sum, item) => sum + item.qty * item.unitPriceFen, 0)
)

export function OrdersView({ error, loading, orders }: OrdersViewProps) {
  const [filter, setFilter] = useState<CustomerSubFilter>('全部')

  const filteredOrders = useMemo(
    () => orders.filter((order) => (filter === '全部' ? true : orderStatusLabel(order.status) === filter)),
    [filter, orders]
  )

  return (
    <View className='sales-screen sales-orders-screen'>
      <View className='sales-page-header sales-page-header--search'>
        <Text className='sales-page-title'>订单列表</Text>
        <Search className='sales-orders-search-icon' />
      </View>

      <View className='sales-orders-filter-bar'>
        {customerSubFilters.map((item) => (
          <View
            key={item}
            onClick={() => setFilter(item)}
            className={`sales-orders-filter-tab ${filter === item ? 'sales-orders-filter-tab--active' : ''}`}
          >
            <Text className='sales-orders-filter-text'>{item}</Text>
          </View>
        ))}
      </View>

      <View className='sales-list-stack sales-list-stack--orders'>
        {loading ? <Text className='sales-empty-copy'>正在加载订单...</Text> : null}
        {!loading && error ? <Text className='sales-empty-copy'>{error}</Text> : null}
        {!loading && !error && filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const statusLabel = orderStatusLabel(order.status)
            const tone = getStatusTone(statusLabel)

            return (
              <View key={order.id} className='sales-order-card'>
                <View className='sales-order-card-head'>
                  <View className='sales-order-card-head-main'>
                    <Text className='sales-order-company u-safe-title-2'>{order.address?.receiverName || '客户订单'}</Text>
                    <Text className='sales-order-code'>订单号 #{order.id} • {formatOrderDate(order.createdAt)}</Text>
                  </View>
                  <View className={`sales-order-badge ${tone.bg}`}>
                    <Text className={`sales-order-badge-text ${tone.text}`}>{statusLabel}</Text>
                  </View>
                </View>

                <View className='sales-order-items'>
                  {order.items.map((item) => (
                    <View key={item.sku.id} className='sales-order-item'>
                      <View className='sales-order-item-image flex items-center justify-center bg-slate-100'>
                        <TodoList className='text-xl text-slate-400' />
                      </View>
                      <View className='sales-order-item-main'>
                        <Text className='sales-order-item-name u-safe-title-2'>{item.sku.name}</Text>
                        <Text className='sales-order-item-spec'>
                          规格: {item.sku.spec || item.sku.skuCode || '默认规格'}
                        </Text>
                        <View className='sales-order-item-row'>
                          <Text className='sales-order-item-qty'>数量: x{item.qty}</Text>
                          <Text className='sales-order-item-price'>{formatFen(item.qty * item.unitPriceFen)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <View className='sales-order-card-foot'>
                  <Text className='sales-order-detail-link' onClick={() => void navigateTo(orderDetailRoute(order.id))}>查看详情</Text>
                  <View className='sales-order-total'>
                    <Text className='sales-order-total-label'>总计金额</Text>
                    <Text className='sales-order-total-value'>{formatFen(orderTotalFen(order))}</Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : !loading && !error ? (
          <View className='sales-empty-state'>
            <TodoList className='sales-empty-icon' />
            <Text className='sales-empty-copy'>暂无该状态下的订单。</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export function AccountingView() {
  return (
    <View className='sales-screen sales-accounting-screen'>
      <View className='sales-page-header sales-page-header--center'>
        <Text className='sales-page-title'>财务结算</Text>
      </View>

      <View className='sales-empty-state'>
        <TodoList className='sales-empty-icon' />
        <Text className='sales-empty-copy'>财务结算暂未接入</Text>
        <Text className='sales-empty-copy'>佣金规则与结算数据尚无真实后端接口，请以公司财务系统为准。</Text>
      </View>
    </View>
  )
}
