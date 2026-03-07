import { useMemo, useState } from 'react'
import { Image, Input, Text, View } from '@tarojs/components'
import { ArrowDown, ArrowRight, Qr, Search, TodoList } from '@taroify/icons'
import {
  accountingListIcon,
  accountingSummaryCards,
  customerSubFilters,
  customersData,
  getStatusTone,
  ordersListData,
  settledOrdersData
} from './data'
import type { CustomerSubFilter } from './types'

export function DashboardView() {
  return (
    <View className='sales-screen sales-dashboard-screen'>
      <View className='sales-dashboard-stack'>
        <View className='sales-dashboard-profile'>
          <View className='sales-dashboard-avatar'>
            <Text className='sales-dashboard-avatar-text'>LM</Text>
          </View>
          <Text className='sales-dashboard-name'>李明浩</Text>
          <Text className='sales-dashboard-role'>高级 B2B 客户经理</Text>
        </View>

        <View className='sales-dashboard-card'>
          <View className='sales-dashboard-qr-shell'>
            <Qr className='sales-dashboard-qr' />
          </View>
          <Text className='sales-dashboard-card-title'>您的专属推广二维码</Text>
          <Text className='sales-dashboard-card-copy'>请客户扫码以绑定归属</Text>
        </View>
      </View>
    </View>
  )
}

export function CustomersView() {
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
        />
      </View>

      <View className='sales-list-stack'>
        {customersData.map((customer) => (
          <View key={customer.id} className='sales-customer-card'>
            <View className='sales-customer-leading'>
              <View className='sales-customer-avatar'>
                <Text className='sales-customer-avatar-text'>{customer.initial}</Text>
              </View>
              <View className='sales-customer-body'>
                <Text className='sales-customer-name'>{customer.name}</Text>
                <Text className='sales-customer-contact'>{customer.contact}</Text>
                <Text className='sales-customer-meta'>
                  最近活跃: {customer.active} · 共 {customer.orders} 笔订单
                </Text>
              </View>
            </View>
            <ArrowRight className='sales-customer-chevron' />
          </View>
        ))}
      </View>
    </View>
  )
}

export function OrdersView() {
  const [filter, setFilter] = useState<CustomerSubFilter>('全部')

  const filteredOrders = useMemo(
    () => ordersListData.filter((order) => (filter === '全部' ? true : order.status === filter)),
    [filter]
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
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const tone = getStatusTone(order.status)

            return (
              <View key={order.id} className='sales-order-card'>
                <View className='sales-order-card-head'>
                  <View className='sales-order-card-head-main'>
                    <Text className='sales-order-company u-safe-title-2'>{order.company}</Text>
                    <Text className='sales-order-code'>订单号 #{order.id} • {order.date}</Text>
                  </View>
                  <View className={`sales-order-badge ${tone.bg}`}>
                    <Text className={`sales-order-badge-text ${tone.text}`}>{order.status}</Text>
                  </View>
                </View>

                <View className='sales-order-items'>
                  {order.products.map((product) => (
                    <View key={product.id} className='sales-order-item'>
                      <Image
                        src={product.image}
                        mode='aspectFill'
                        className='sales-order-item-image'
                      />
                      <View className='sales-order-item-main'>
                        <Text className='sales-order-item-name u-safe-title-2'>{product.name}</Text>
                        <Text className='sales-order-item-spec'>
                          型号: {product.model}, 规格: {product.size}
                        </Text>
                        <View className='sales-order-item-row'>
                          <Text className='sales-order-item-qty'>数量: x{product.qty}</Text>
                          <Text className='sales-order-item-price'>{product.price}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                <View className='sales-order-card-foot'>
                  <Text className='sales-order-detail-link'>查看详情</Text>
                  <View className='sales-order-total'>
                    <Text className='sales-order-total-label'>总计金额</Text>
                    <Text className='sales-order-total-value'>{order.total}</Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          <View className='sales-empty-state'>
            <TodoList className='sales-empty-icon' />
            <Text className='sales-empty-copy'>暂无该状态下的订单。</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export function AccountingView() {
  const [selectedMonth, setSelectedMonth] = useState('2023年 8月')
  const [isDropdownMenuOpen, setIsDropdownMenuOpen] = useState(false)
  const availableMonths = ['2023年 8月', '2023年 7月', '2023年 6月', '2023年 5月', '2023年 4月']
  const AccountingListIcon = accountingListIcon

  return (
    <View className='sales-screen sales-accounting-screen'>
      <View className='sales-page-header sales-page-header--center'>
        <Text className='sales-page-title'>财务结算</Text>
      </View>

      <View className='sales-accounting-toolbar'>
        <View className='relative flex flex-col'>
          <Text className='sales-accounting-label'>结算周期</Text>
          <View onClick={() => setIsDropdownMenuOpen((prev) => !prev)} className='sales-accounting-period'>
            <Text className='sales-accounting-period-text'>{selectedMonth}</Text>
            <ArrowDown className={`sales-accounting-period-icon ${isDropdownMenuOpen ? 'sales-accounting-period-icon--open' : ''}`} />
          </View>

          {isDropdownMenuOpen ? <View className='fixed inset-0 z-10' onClick={() => setIsDropdownMenuOpen(false)} /> : null}

          {isDropdownMenuOpen ? (
            <View className='sales-accounting-dropdown'>
              {availableMonths.map((month) => (
                <View
                  key={month}
                  onClick={() => {
                    setSelectedMonth(month)
                    setIsDropdownMenuOpen(false)
                  }}
                  className={`sales-accounting-dropdown-item ${selectedMonth === month ? 'sales-accounting-dropdown-item--active' : ''}`}
                >
                  <Text className='text-sm font-medium'>{month}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {selectedMonth === availableMonths[0] ? (
          <View className='sales-accounting-latest'>
            <Text className='sales-accounting-latest-text'>最新</Text>
          </View>
        ) : null}
      </View>

      <View className='sales-accounting-summary'>
        {accountingSummaryCards.map((card) => {
          const CardIcon = card.icon

          return (
            <View key={card.key} className={`sales-accounting-card ${card.cardClassName}`}>
              <View className={`${card.iconClassName} flex items-center gap-2`}>
                <CardIcon className='text-base' />
                <Text className='text-sm font-semibold'>{card.title}</Text>
              </View>
              <Text className='sales-accounting-card-value'>{card.value}</Text>
              {card.progressWidth ? (
                <View className={`sales-accounting-progress ${card.accentClassName}`}>
                  <View className={`sales-accounting-progress-fill ${card.fillClassName}`} style={{ width: card.progressWidth }} />
                </View>
              ) : null}
              <Text className={`sales-accounting-progress-copy ${card.iconClassName.includes('emerald') ? 'font-medium' : ''}`}>
                {card.progressLabel}
              </Text>
            </View>
          )
        })}
      </View>

      <View className='sales-accounting-tabs'>
        <View className='sales-accounting-tab sales-accounting-tab--active'>
          <Text className='sales-accounting-tab-text sales-accounting-tab-text--active'>已结算订单</Text>
        </View>
        <View className='sales-accounting-tab'>
          <Text className='sales-accounting-tab-text'>数据明细</Text>
        </View>
      </View>

      <View className='sales-list-stack'>
        {settledOrdersData.map((order) => (
          <View key={order.id} className='sales-accounting-order-card'>
            <View className='flex items-center gap-3'>
              <View className='sales-accounting-order-icon'>
                <AccountingListIcon className='text-lg' />
              </View>
              <View>
                <Text className='sales-accounting-order-id'>{order.id}</Text>
                <Text className='sales-accounting-order-meta'>{order.company} • {order.date}</Text>
              </View>
            </View>
            <View className='sales-accounting-order-values'>
              <Text className='sales-accounting-order-amount'>{order.amount}</Text>
              <Text className='sales-accounting-order-commission'>{order.commission}</Text>
            </View>
          </View>
        ))}
        <View className='sales-accounting-cta'>
          <Text className='sales-accounting-cta-text'>查看所有订单</Text>
        </View>
      </View>
    </View>
  )
}
