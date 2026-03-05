import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Image, Input, Text, View } from '@tarojs/components'
import {
  AppsOutlined,
  ArrowDown,
  ArrowRight,
  BalanceOutlined,
  BarChartOutlined,
  FriendsOutlined,
  Logistics,
  OrdersOutlined,
  Qr,
  Search,
  TodoList
} from '@taroify/icons'

type SalesTab = 'dashboard' | 'customers' | 'orders' | 'accounting'

type Customer = {
  id: number
  initial: string
  name: string
  contact: string
  active: string
  orders: number
}

type SettledOrder = {
  id: string
  company: string
  date: string
  amount: string
  commission: string
}

type OrderProduct = {
  id: number
  name: string
  model: string
  size: string
  qty: number
  price: string
  image: string
}

type OrderStatus = '待处理' | '已发货' | '已送达'

type Order = {
  id: string
  company: string
  date: string
  status: OrderStatus
  total: string
  products: OrderProduct[]
}

type CustomerSubFilter = '全部' | OrderStatus

type CustomerSubOrder = {
  id: string
  date: string
  amount: string
  status: OrderStatus
}

type NavItem = {
  key: SalesTab
  label: string
  Icon: (props: { className?: string; style?: CSSProperties }) => JSX.Element
}

const PROFILE_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDS-Ii8-RYQWRHi7NRn7ujP4nBj5b27SqsnQlr_jvCr1fNZ90Xa8PTUAgyVff7zsjkZ-CVcpfqpAFImVPrHYYkc7sQ2SK11qP1fyuoHScxGlRWJWip7l6hx-vy7vDIPO79FUnu-avStjGabIojNzp5t-Cm_8yomJTd7f4VrGZgGKs65ExahSrNzzSFs0bhWkesNgUYkN4W8o2VLTqF7AICOtosah3hqXwPjHUarAXV6Gr2wFfDyN2jCHHgOG2BTs8jfp5Cd8GXDHu8'

const customersData: Customer[] = [
  { id: 1, initial: 'A', name: 'Acme 集团', contact: '张伟', active: '2天前', orders: 45 },
  { id: 2, initial: 'G', name: '环球贸易科技', contact: '李娜', active: '1周前', orders: 12 },
  { id: 3, initial: 'S', name: '星辰实业', contact: '王建国', active: '今天', orders: 89 },
  { id: 4, initial: 'I', name: '创新动力', contact: '赵小龙', active: '3天前', orders: 5 }
]

const settledOrdersData: SettledOrder[] = [
  { id: 'ORD-2023-089', company: '科技创新公司', date: '8月24日', amount: '$12,450', commission: '+$622.50' },
  { id: 'ORD-2023-082', company: '全球供应商', date: '8月18日', amount: '$8,900', commission: '+$445.00' },
  { id: 'ORD-2023-075', company: '顶尖零售', date: '8月12日', amount: '$15,200', commission: '+$760.00' }
]

const ordersListData: Order[] = [
  {
    id: '12345',
    company: 'Acme 集团',
    date: '10月24日, 10:30 AM',
    status: '已发货',
    total: '$4,300.00',
    products: [
      {
        id: 1,
        name: '重型轴承',
        model: 'TX-500',
        size: '大号',
        qty: 50,
        price: '$2,500.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9qBnYl_CKrDuqRP4rON46rZFuJyHVo58PXIiZzf6t1nSWKIDmmUpcK6uVATFS2Er7vOSacYjrNA7Y3ct1tLOQSkwcPk2YoRgJ-GI7MoXzkJtneTHxdLmTE1mI8J3I9Ula7DstqE59YSJVV5imNw4Xi7sfjogSfCvGeoYaqpzMweBXfxRCEb7G-3AMMTKwNymfTSK4BV57z8R2YVFqrHkaUOsONt8dFC86WrJulssInsqkM5RcaqeEZsj37g4ELxHvFihuFUNkXeA'
      },
      {
        id: 2,
        name: '钢制支架',
        model: 'BKT-2',
        size: '标准',
        qty: 120,
        price: '$1,800.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12346',
    company: '环球贸易科技',
    date: '10月25日, 09:15 AM',
    status: '待处理',
    total: '$1,200.00',
    products: [
      {
        id: 1,
        name: '工业传感器',
        model: 'SN-100',
        size: '小号',
        qty: 15,
        price: '$1,200.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12344',
    company: '科技创新公司',
    date: '10月23日, 14:15 PM',
    status: '已送达',
    total: '$8,500.00',
    products: [
      {
        id: 1,
        name: '电路板 v2',
        model: 'CB-2024',
        size: '微型',
        qty: 200,
        price: '$8,500.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRGYc_onha2lZ0arzfEWdlG-4MyBaI_g_G7MexJm56kHsVTjRwt07z9JwUI2n4GNGyS4VT0f3c0c-TtFKLnKNSPaYwmUBo7voYW8OE7IqyE8g4kCkWAQLlHqd_oJrJWCEYBhBIOWA2B8aDFvmlLW-VniD5AT6yxOBjClDGWP6WeuDEg8Mf87f_-yVhcuRkiwQbU4LilK6VyzsYXQ1w98yncq_4kz4gUovYpoW2-vA2cMDw_phNMO0J6LCu_2EwNWPDgKQunfmBijE'
      }
    ]
  },
  {
    id: '12347',
    company: '星辰实业',
    date: '10月21日, 16:45 PM',
    status: '已送达',
    total: '$5,600.00',
    products: [
      {
        id: 1,
        name: '重型轴承',
        model: 'TX-500',
        size: '大号',
        qty: 100,
        price: '$5,000.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB9qBnYl_CKrDuqRP4rON46rZFuJyHVo58PXIiZzf6t1nSWKIDmmUpcK6uVATFS2Er7vOSacYjrNA7Y3ct1tLOQSkwcPk2YoRgJ-GI7MoXzkJtneTHxdLmTE1mI8J3I9Ula7DstqE59YSJVV5imNw4Xi7sfjogSfCvGeoYaqpzMweBXfxRCEb7G-3AMMTKwNymfTSK4BV57z8R2YVFqrHkaUOsONt8dFC86WrJulssInsqkM5RcaqeEZsj37g4ELxHvFihuFUNkXeA'
      },
      {
        id: 2,
        name: '钢制支架',
        model: 'BKT-2',
        size: '标准',
        qty: 40,
        price: '$600.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDuqrZlsbuURs7J5K_qOtEkC_9G3zPcVB7paCyeO0IuYwe9TcdfhlOW9QPgLJdtbXnzqtN2eLZzYcufLFWcNSxSVcefj-Yxgf5czlEEwvGbTo1bJcZmW4S9v2MtnC5euMOu5Cq4rTd7GQIjBx_fJpP3ubqGISUBRoxji3-9nHt_YZ_qSGiGVhJ75BXoPYKFU7TX7yU3KhsUnL18Ua65vqA5ShXq_-LTE68K_Ge0I0aB68NL4OiuK7QkWYRjmykpGoBElEAEaQeGqwM'
      }
    ]
  },
  {
    id: '12348',
    company: '创新动力',
    date: '10月26日, 11:20 AM',
    status: '待处理',
    total: '$3,400.00',
    products: [
      {
        id: 1,
        name: '电路板 v2',
        model: 'CB-2024',
        size: '微型',
        qty: 80,
        price: '$3,400.00',
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRGYc_onha2lZ0arzfEWdlG-4MyBaI_g_G7MexJm56kHsVTjRwt07z9JwUI2n4GNGyS4VT0f3c0c-TtFKLnKNSPaYwmUBo7voYW8OE7IqyE8g4kCkWAQLlHqd_oJrJWCEYBhBIOWA2B8aDFvmlLW-VniD5AT6yxOBjClDGWP6WeuDEg8Mf87f_-yVhcuRkiwQbU4LilK6VyzsYXQ1w98yncq_4kz4gUovYpoW2-vA2cMDw_phNMO0J6LCu_2EwNWPDgKQunfmBijE'
      }
    ]
  }
]

const customerSubFilters: CustomerSubFilter[] = ['全部', '待处理', '已发货', '已送达']

const customerSubOrdersById: Record<number, CustomerSubOrder[]> = {
  1: [
    { id: 'CUST-1001', date: '10月24日', amount: '$4,300', status: '已发货' },
    { id: 'CUST-1002', date: '10月19日', amount: '$2,150', status: '待处理' }
  ],
  2: [
    { id: 'CUST-1003', date: '10月25日', amount: '$1,200', status: '待处理' },
    { id: 'CUST-1004', date: '10月03日', amount: '$9,800', status: '已送达' }
  ],
  3: [
    { id: 'CUST-1005', date: '10月23日', amount: '$8,500', status: '已送达' },
    { id: 'CUST-1006', date: '10月21日', amount: '$5,600', status: '已送达' }
  ],
  4: [
    { id: 'CUST-1007', date: '10月26日', amount: '$3,400', status: '待处理' }
  ]
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: '主页', Icon: AppsOutlined },
  { key: 'customers', label: '客户', Icon: FriendsOutlined },
  { key: 'orders', label: '订单', Icon: OrdersOutlined },
  { key: 'accounting', label: '财务', Icon: BalanceOutlined }
]

const getStatusTone = (status: OrderStatus) => {
  if (status === '待处理') {
    return { bg: 'bg-amber-100', text: 'text-amber-700' }
  }
  if (status === '已送达') {
    return { bg: 'bg-emerald-100', text: 'text-emerald-600' }
  }
  return { bg: 'sales-primary-soft-bg', text: 'sales-primary-text' }
}

function DashboardView() {
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

function CustomersView() {
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

function OrdersView() {
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
                          <Text className='mt-1 text-sm font-medium text-slate-500'>型号: {product.model}, 规格: {product.size}</Text>
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

function AccountingView() {
  const [selectedMonth, setSelectedMonth] = useState('2023年 8月')
  const [isDropdownMenuOpen, setIsDropdownMenuOpen] = useState(false)
  const availableMonths = ['2023年 8月', '2023年 7月', '2023年 6月', '2023年 5月', '2023年 4月']

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
        <View className='sales-primary-soft-border sales-primary-soft-bg flex flex-col gap-2 rounded-xl border p-4'>
          <View className='sales-primary-text flex items-center gap-2'>
            <BarChartOutlined className='text-base' />
            <Text className='text-sm font-semibold'>总销售额</Text>
          </View>
          <Text className='text-2xl font-bold leading-tight tracking-tight text-slate-900'>$45,230</Text>
          <View className='mt-2 h-1.5 w-full rounded-full bg-blue-100'>
            <View className='h-1.5 rounded-full bg-blue-500' style={{ width: '92%' }} />
          </View>
          <Text className='mt-1 text-xs text-slate-500'>已达成 $50k 目标的 92%</Text>
        </View>

        <View className='flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4'>
          <View className='flex items-center gap-2 text-emerald-600'>
            <BalanceOutlined className='text-base' />
            <Text className='text-sm font-semibold'>预计佣金</Text>
          </View>
          <Text className='text-2xl font-bold leading-tight tracking-tight text-slate-900'>$2,261</Text>
          <Text className='mt-auto text-xs font-medium text-emerald-600'>较上月增长 15%</Text>
        </View>
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
                <Logistics className='text-lg' />
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

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('dashboard')

  return (
    <View className='sales-page-shell sales-font h-screen w-full text-slate-900'>
      <View className='sales-main-container relative mx-auto flex h-screen w-full max-w-md flex-col overflow-hidden shadow-2xl'>
        <View className='min-h-0 flex-1'>
          {activeTab === 'dashboard' ? <DashboardView /> : null}
          {activeTab === 'customers' ? <CustomersView /> : null}
          {activeTab === 'orders' ? <OrdersView /> : null}
          {activeTab === 'accounting' ? <AccountingView /> : null}
        </View>

        <View className='sales-bottom-nav sales-bottom-nav-shadow absolute bottom-0 left-0 right-0 z-50 flex gap-2 border-t border-slate-200 bg-white px-4 pb-6 pt-3'>
          {navItems.map(({ key, label, Icon }) => {
            const active = activeTab === key
            const iconStyle = { fontSize: active ? '44rpx' : '40rpx' }

            return (
              <View
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 flex-col items-center justify-end gap-1 ${active ? 'sales-primary-text' : 'text-slate-500'}`}
              >
                <View className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? 'sales-primary-soft-bg' : ''}`}>
                  <Icon className={active ? 'sales-primary-text' : 'text-slate-500'} style={iconStyle} />
                </View>
                <Text className='text-10 font-semibold leading-normal tracking-wide uppercase'>{label}</Text>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}
