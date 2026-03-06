import { Fragment, useMemo, useState } from 'react'
import { Image, Input, Text, View } from '@tarojs/components'
import { ArrowDown, ArrowRight, Qr, Search, TodoList } from '@taroify/icons'
import {
  accountingListIcon,
  accountingSummaryCards,
  customerSubFilters,
  customerSubOrdersById,
  customersData,
  getStatusTone,
  ordersListData,
  PROFILE_IMAGE_URL,
  settledOrdersData
} from './data'
import type { CustomerSubFilter } from './types'

export function DashboardView() {
  return (
    <View className='sales-content min-h-0 flex-1 flex flex-col items-center justify-center overflow-y-auto px-6 pb-24 bg-white'>
      <View className='mb-8 flex flex-col items-center justify-center text-center'>
        <Image
          src={PROFILE_IMAGE_URL}
          mode='aspectFill'
          className='mb-4 h-20 w-20 rounded-full border-2 border-slate-100 shadow-sm'
        />
        <Text className='sales-title-tight text-2xl font-bold leading-tight text-slate-900'>李明浩</Text>
        <Text className='mt-1 text-sm font-medium text-slate-500'>高级 B2B 客户经理</Text>
      </View>

      <View className='flex w-full max-w-xs flex-col items-center justify-center rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-md'>
        <View className='mb-5 flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'>
          <Qr className='text-slate-900' style={{ fontSize: '192rpx' }} />
        </View>
        <Text className='text-lg font-bold text-slate-900'>您的专属推广二维码</Text>
        <Text className='mt-1 text-sm font-medium text-slate-500'>请客户扫码以绑定归属</Text>
      </View>
    </View>
  )
}

export function CustomersView() {
  const [expandedCustomerId, setExpandedCustomerId] = useState<number | null>(customersData[0]?.id ?? null)
  const [subFilter, setSubFilter] = useState<CustomerSubFilter>('全部')

  return (
    <View className='min-h-0 flex-1 overflow-y-auto bg-white pb-24'>
      <View className='sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white p-4 pb-2 shadow-sm'>
        <Text className='flex-1 text-lg font-bold leading-tight sales-title-tight text-slate-900'>客户列表</Text>
        <View className='flex w-12 items-center justify-end'>
          <View className='sales-primary-soft-bg sales-primary-text flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg'>
            <Qr className='text-lg' />
          </View>
        </View>
      </View>

      <View className='sticky top-14 z-10 border-b border-slate-100 bg-white px-4 py-4 shadow-sm'>
        <View className='sales-search-shell flex h-12 w-full items-stretch rounded-lg bg-slate-100'>
          <View className='flex items-center justify-center pl-4 text-slate-500'>
            <Search className='text-base' />
          </View>
          <Input
            className='h-full flex-1 bg-transparent px-4 pl-2 text-base text-slate-900'
            placeholder='搜索客户...'
            confirmType='search'
          />
        </View>
      </View>

      <View className='sales-content flex flex-col gap-3 px-4 py-3'>
        {customersData.map((customer) => {
          const expanded = expandedCustomerId === customer.id
          const subOrders = customerSubOrdersById[customer.id] ?? []
          const filteredSubOrders = subOrders.filter((item) => (subFilter === '全部' ? true : item.status === subFilter))

          return (
            <View key={customer.id} className='rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-sm'>
              <View
                onClick={() => setExpandedCustomerId((prev) => (prev === customer.id ? null : customer.id))}
                className='flex items-center justify-between gap-4'
              >
                <View className='flex min-w-0 flex-1 items-center gap-4'>
                  <View className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100'>
                    <Text className='text-xl font-bold text-slate-600'>{customer.initial}</Text>
                  </View>
                  <View className='flex min-w-0 flex-1 flex-col justify-center'>
                    <Text className='mb-1 truncate text-base font-bold leading-tight text-slate-900'>{customer.name}</Text>
                    <Text className='mb-1 truncate text-sm font-medium leading-none text-slate-500'>{customer.contact}</Text>
                    <Text className='truncate text-xs font-normal leading-none text-slate-500'>
                      最近活跃: {customer.active} • {customer.orders} 笔订单
                    </Text>
                  </View>
                </View>
                <ArrowRight className={`sales-chev text-base text-slate-400 ${expanded ? 'sales-chev--open' : ''}`} />
              </View>

              {expanded ? (
                <View className='sales-accordion-panel mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3'>
                  <View className='mb-3 flex gap-2 overflow-x-auto whitespace-nowrap'>
                    {customerSubFilters.map((filter) => (
                      <View
                        key={`${customer.id}-${filter}`}
                        onClick={() => setSubFilter(filter)}
                        className={`sales-subpill ${subFilter === filter ? 'sales-subpill--active' : ''}`}
                      >
                        <Text>{filter}</Text>
                      </View>
                    ))}
                  </View>

                  <View className='flex flex-col gap-2'>
                    {filteredSubOrders.map((item) => {
                      const tone = getStatusTone(item.status)

                      return (
                        <View
                          key={item.id}
                          className='flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2'
                        >
                          <View className='min-w-0 flex-1'>
                            <Text className='block truncate text-sm font-semibold text-slate-900'>{item.id}</Text>
                            <Text className='mt-0.5 block text-xs text-slate-500'>{item.date}</Text>
                          </View>
                          <View className='ml-3 flex items-center gap-2'>
                            <View className={`rounded-full px-2 py-1 ${tone.bg}`}>
                              <Text className={`text-xs font-semibold ${tone.text}`}>{item.status}</Text>
                            </View>
                            <Text className='sales-primary-text text-sm font-bold'>{item.amount}</Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              ) : null}
            </View>
          )
        })}
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
    <View className='min-h-0 flex-1 flex flex-col overflow-y-auto bg-white pb-24'>
      <View className='sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white p-4 pb-2 shadow-sm'>
        <Text className='flex-1 text-xl font-bold leading-tight text-slate-900'>订单列表</Text>
        <View className='flex items-center justify-center text-slate-500'>
          <Search className='text-xl' />
        </View>
      </View>

      <View className='sticky z-10 bg-white shadow-sm' style={{ top: '104rpx' }}>
        <View className='flex gap-6 overflow-x-auto border-b border-slate-100 px-4 whitespace-nowrap'>
          {customerSubFilters.map((item) => (
            <View
              key={item}
              onClick={() => setFilter(item)}
              className={`sales-order-tab flex flex-col items-center justify-center pb-3 pt-4 ${filter === item ? 'sales-order-tab--active' : 'text-slate-500'}`}
            >
              <Text className='text-sm font-semibold leading-normal'>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='sales-content flex flex-col gap-4 p-4'>
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const tone = getStatusTone(order.status)

            return (
              <View key={order.id} className='overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm'>
                <View className='flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4'>
                  <View>
                    <Text className='text-lg font-bold text-slate-900'>{order.company}</Text>
                    <Text className='mt-0.5 block text-xs text-slate-500'>订单号 #ORD-{order.id} • {order.date}</Text>
                  </View>
                  <View className={`rounded-full px-2.5 py-1 ${tone.bg}`}>
                    <Text className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>{order.status}</Text>
                  </View>
                </View>

                <View className='flex flex-col gap-4 p-4'>
                  {order.products.map((product, index) => (
                    <Fragment key={product.id}>
                      <View className='flex items-start gap-4'>
                        <Image
                          src={product.image}
                          mode='aspectFill'
                          className='h-16 w-16 shrink-0 rounded-lg border border-slate-100 bg-slate-100'
                        />
                        <View className='flex flex-1 flex-col justify-start'>
                          <Text className='text-base font-semibold leading-tight text-slate-900'>{product.name}</Text>
                          <Text className='mt-1 text-sm font-medium text-slate-500'>
                            型号: {product.model}, 规格: {product.size}
                          </Text>
                          <View className='mt-2 flex items-center justify-between'>
                            <Text className='text-sm font-medium text-slate-500'>数量: x{product.qty}</Text>
                            <Text className='text-base font-semibold text-slate-900'>{product.price}</Text>
                          </View>
                        </View>
                      </View>
                      {index !== order.products.length - 1 ? <View className='h-px w-full bg-slate-100' /> : null}
                    </Fragment>
                  ))}
                </View>

                <View className='flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4'>
                  <Text className='sales-primary-text text-sm font-semibold'>查看详情</Text>
                  <View className='text-right'>
                    <Text className='text-xs font-semibold uppercase tracking-wide text-slate-500'>总计金额</Text>
                    <Text className='sales-primary-text mt-0.5 block text-xl font-bold'>{order.total}</Text>
                  </View>
                </View>
              </View>
            )
          })
        ) : (
          <View className='flex flex-col items-center justify-center py-12 text-slate-400'>
            <TodoList className='mb-4 text-4xl' />
            <Text className='text-sm font-medium'>暂无该状态下的订单。</Text>
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
    <View className='min-h-0 flex-1 flex flex-col overflow-y-auto bg-white pb-24'>
      <View className='sticky top-0 z-20 flex items-center justify-center border-b border-slate-100 bg-white p-4 pb-2 shadow-sm'>
        <Text className='text-lg font-bold leading-tight sales-title-tight text-slate-900'>财务结算</Text>
      </View>

      <View className='relative z-20 flex items-center justify-between border-b border-slate-100 bg-white p-4'>
        <View className='relative flex flex-col'>
          <Text className='text-sm text-slate-500'>结算周期</Text>
          <View onClick={() => setIsDropdownMenuOpen((prev) => !prev)} className='mt-0.5 flex items-center gap-1.5'>
            <Text className='text-lg font-bold leading-tight text-slate-900'>{selectedMonth}</Text>
            <ArrowDown className={`text-slate-400 ${isDropdownMenuOpen ? 'rotate-180' : ''}`} />
          </View>

          {isDropdownMenuOpen ? <View className='fixed inset-0 z-10' onClick={() => setIsDropdownMenuOpen(false)} /> : null}

          {isDropdownMenuOpen ? (
            <View className='absolute left-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg'>
              {availableMonths.map((month) => (
                <View
                  key={month}
                  onClick={() => {
                    setSelectedMonth(month)
                    setIsDropdownMenuOpen(false)
                  }}
                  className={`px-4 py-3 ${selectedMonth === month ? 'sales-primary-soft-bg sales-primary-text' : 'text-slate-700'}`}
                >
                  <Text className='text-sm font-medium'>{month}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {selectedMonth === availableMonths[0] ? (
          <View className='sales-primary-soft-bg rounded-full px-3 py-1'>
            <Text className='sales-primary-text text-xs font-bold uppercase tracking-wider'>最新</Text>
          </View>
        ) : null}
      </View>

      <View className='sales-content grid grid-cols-2 gap-3 p-4'>
        {accountingSummaryCards.map((card) => {
          const CardIcon = card.icon

          return (
            <View key={card.key} className={`${card.cardClassName} flex flex-col gap-2 rounded-xl p-4`}>
              <View className={`${card.iconClassName} flex items-center gap-2`}>
                <CardIcon className='text-base' />
                <Text className='text-sm font-semibold'>{card.title}</Text>
              </View>
              <Text className='text-2xl font-bold leading-tight tracking-tight text-slate-900'>{card.value}</Text>
              {card.progressWidth ? (
                <View className={`mt-2 h-1.5 w-full rounded-full ${card.accentClassName}`}>
                  <View className={`h-1.5 rounded-full ${card.fillClassName}`} style={{ width: card.progressWidth }} />
                </View>
              ) : null}
              <Text className={`mt-${card.progressWidth ? '1' : 'auto'} text-xs ${card.iconClassName.includes('emerald') ? 'font-medium' : ''}`}>
                {card.progressLabel}
              </Text>
            </View>
          )
        })}
      </View>

      <View className='sales-content flex border-b border-slate-100 px-4'>
        <View className='sales-order-tab sales-order-tab--active flex-1 py-3 text-center'>
          <Text className='text-sm font-bold'>已结算订单</Text>
        </View>
        <View className='sales-order-tab flex-1 py-3 text-center'>
          <Text className='text-sm font-medium text-slate-500'>数据明细</Text>
        </View>
      </View>

      <View className='sales-content flex flex-col gap-3 p-4'>
        {settledOrdersData.map((order) => (
          <View key={order.id} className='flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3 shadow-sm'>
            <View className='flex items-center gap-3'>
              <View className='sales-primary-soft-bg sales-primary-text flex h-10 w-10 shrink-0 items-center justify-center rounded-full'>
                <AccountingListIcon className='text-lg' />
              </View>
              <View>
                <Text className='text-sm font-bold leading-tight text-slate-900'>{order.id}</Text>
                <Text className='mt-0.5 block text-xs text-slate-500'>{order.company} • {order.date}</Text>
              </View>
            </View>
            <View className='text-right'>
              <Text className='text-sm font-bold leading-tight text-slate-900'>{order.amount}</Text>
              <Text className='mt-0.5 block text-xs font-medium text-emerald-600'>{order.commission}</Text>
            </View>
          </View>
        ))}
        <View className='sales-primary-soft-bg mt-2 w-full rounded-lg py-3 text-center'>
          <Text className='sales-primary-text text-sm font-bold'>查看所有订单</Text>
        </View>
      </View>
    </View>
  )
}
