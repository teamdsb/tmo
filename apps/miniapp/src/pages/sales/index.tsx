import { useMemo, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import {
  AppsOutlined,
  ArrowRight,
  BarChartOutlined,
  Logistics,
  OrdersOutlined,
  Search,
  ShoppingCartOutlined,
  TodoList,
  UserOutlined
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

type Order = {
  id: string
  company: string
  date: string
  status: '待处理' | '已发货' | '已送达'
  total: string
  products: OrderProduct[]
}

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

function DashboardView() {
  return (
    <View className='flex-1 flex flex-col items-center overflow-y-auto bg-[#f3f4f6] px-8 pt-16 pb-36'>
      <View className='mb-14 flex flex-col items-center justify-center text-center'>
        <View className='mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#f6b298] shadow-[0_4px_12px_rgba(15,23,42,0.08)]'>
          <UserOutlined className='text-[42px] text-[#1f2937]' />
        </View>
        <Text className='text-[34px] font-bold leading-tight tracking-tight text-[#111827]'>李明浩</Text>
        <Text className='mt-2 text-sm font-semibold text-[#64748b]'>高级 B2B 客户经理</Text>
      </View>

      <View className='w-full rounded-[30px] border border-[#e3e8ef] bg-[#eceff3] px-8 py-9 shadow-[0_8px_20px_rgba(15,23,42,0.06)]'>
        <View className='mb-6 flex items-center justify-center rounded-[22px] border border-[#dde4ec] bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.06)]'>
          <AppsOutlined className='text-[132px] text-[#0f172a]' />
        </View>
        <Text className='text-center text-[26px] font-bold leading-tight text-[#0f172a]'>您的专属推广二维码</Text>
        <Text className='mt-2 text-center text-sm font-medium text-[#64748b]'>请客户扫码以绑定归属</Text>
      </View>
    </View>
  )
}

function CustomersView() {
  return (
    <View className='flex-1 overflow-y-auto pb-28'>
      <View className='flex items-center bg-white p-4 pb-2 justify-between sticky top-0 z-10 shadow-sm border-b border-slate-100'>
        <Text className='text-lg font-bold leading-tight tracking-tight flex-1'>客户列表</Text>
        <View className='flex w-12 items-center justify-end'>
          <View className='flex items-center justify-center rounded-lg h-10 w-10 bg-[#137fec]/10 text-[#137fec]'>
            <AppsOutlined className='text-lg' />
          </View>
        </View>
      </View>

      <View className='px-4 py-4 bg-white shadow-sm mb-2 border-b border-slate-100'>
        <View className='flex w-full items-stretch rounded-lg h-12 bg-slate-100'>
          <View className='text-slate-500 flex items-center justify-center pl-4'>
            <Search className='text-base' />
          </View>
          <Input
            className='flex-1 text-slate-900 bg-transparent h-full px-4 pl-2 text-base'
            placeholder='搜索客户...'
          />
        </View>
      </View>

      <View className='flex flex-col gap-3 px-4 py-2'>
        {customersData.map((customer) => (
          <View key={customer.id} className='flex items-center gap-4 bg-white px-4 py-4 justify-between rounded-xl shadow-sm border border-slate-100'>
            <View className='flex items-center gap-4 flex-1 min-w-0'>
              <View className='bg-slate-100 rounded-full h-14 w-14 shrink-0 flex items-center justify-center'>
                <Text className='text-xl font-bold text-slate-600'>{customer.initial}</Text>
              </View>
              <View className='flex flex-1 flex-col justify-center min-w-0'>
                <Text className='text-base font-bold leading-tight mb-1 text-slate-900 truncate'>{customer.name}</Text>
                <Text className='text-slate-500 text-sm font-medium leading-none mb-1.5 truncate'>{customer.contact}</Text>
                <Text className='text-slate-400 text-xs font-normal leading-none truncate'>
                  最近活跃: {customer.active} • {customer.orders} 笔订单
                </Text>
              </View>
            </View>
            <View className='flex items-center shrink-0'>
              <ArrowRight className='text-slate-400 text-base' />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function OrdersView() {
  const [filter, setFilter] = useState('全部')
  const filters = ['全部', '待处理', '已发货', '已送达']

  const filteredOrders = useMemo(
    () => ordersListData.filter((order) => (filter === '全部' ? true : order.status === filter)),
    [filter]
  )

  return (
    <View className='flex-1 flex flex-col overflow-y-auto pb-28'>
      <View className='flex items-center p-4 pb-2 justify-between sticky top-0 bg-white z-20 shadow-sm border-b border-slate-100'>
        <Text className='text-xl font-bold leading-tight flex-1'>订单列表</Text>
        <View className='flex items-center justify-center text-slate-600'>
          <Search className='text-xl' />
        </View>
      </View>

      <View className='sticky top-[52px] bg-white z-10 shadow-sm'>
        <View className='flex border-b border-slate-200 px-4 gap-6 overflow-x-auto whitespace-nowrap'>
          {filters.map((item) => (
            <View
              key={item}
              onClick={() => setFilter(item)}
              className={`flex flex-col items-center justify-center border-b-[3px] pb-3 pt-4 ${
                filter === item ? 'border-[#137fec] text-[#137fec]' : 'border-transparent text-slate-600'
              }`}
            >
              <Text className='text-sm font-semibold leading-normal'>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='p-4 flex flex-col gap-4'>
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <View key={order.id} className='flex flex-col rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden'>
              <View className='flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50'>
                <View>
                  <Text className='text-lg font-bold'>{order.company}</Text>
                  <Text className='text-xs text-slate-500 mt-0.5'>订单号 #ORD-{order.id} • {order.date}</Text>
                </View>
                <View
                  className={`px-2.5 py-1 rounded-full ${
                    order.status === '待处理'
                      ? 'bg-amber-100'
                      : order.status === '已发货'
                        ? 'bg-[#137fec]/10'
                        : 'bg-emerald-100'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      order.status === '待处理'
                        ? 'text-amber-700'
                        : order.status === '已发货'
                          ? 'text-[#137fec]'
                          : 'text-emerald-700'
                    }`}
                  >
                    {order.status}
                  </Text>
                </View>
              </View>

              <View className='p-4 flex flex-col gap-4'>
                {order.products.map((product, idx) => (
                  <View key={product.id}>
                    <View className='flex items-start gap-4'>
                      <View
                        className='bg-slate-100 rounded-lg w-16 h-16 shrink-0 bg-cover bg-center border border-slate-200'
                        style={{ backgroundImage: `url("${product.image}")` }}
                      />
                      <View className='flex flex-1 flex-col justify-start'>
                        <Text className='text-base font-semibold leading-tight'>{product.name}</Text>
                        <Text className='text-slate-500 text-sm mt-1'>型号: {product.model}, 规格: {product.size}</Text>
                        <View className='flex justify-between items-center mt-2'>
                          <Text className='text-slate-700 font-medium text-sm'>数量: x{product.qty}</Text>
                          <Text className='font-semibold text-slate-900'>{product.price}</Text>
                        </View>
                      </View>
                    </View>
                    {idx !== order.products.length - 1 ? <View className='h-px bg-slate-100 w-full mt-4' /> : null}
                  </View>
                ))}
              </View>

              <View className='bg-slate-50 p-4 flex justify-between items-center border-t border-slate-100'>
                <Text className='text-[#137fec] font-semibold text-sm'>查看详情</Text>
                <View className='text-right'>
                  <Text className='text-xs text-slate-500 uppercase tracking-wide font-semibold'>总计金额</Text>
                  <Text className='text-xl font-bold text-[#137fec] mt-0.5'>{order.total}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View className='flex flex-col items-center justify-center py-12 text-slate-400'>
            <TodoList className='text-4xl mb-4' />
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
    <View className='flex-1 flex flex-col overflow-y-auto pb-28'>
      <View className='flex items-center p-4 pb-2 justify-center sticky top-0 bg-white z-10 border-b border-slate-100 shadow-sm'>
        <Text className='text-lg font-bold leading-tight tracking-tight'>财务结算</Text>
      </View>

      <View className='flex items-center justify-between p-4 bg-white border-b border-slate-100 relative z-20'>
        <View className='flex flex-col relative'>
          <Text className='text-sm text-slate-500'>结算周期</Text>
          <View
            onClick={() => setIsDropdownMenuOpen((prev) => !prev)}
            className='flex items-center gap-1.5 mt-0.5'
          >
            <Text className='text-lg font-bold leading-tight'>{selectedMonth}</Text>
            <ArrowRight className={`text-slate-400 ${isDropdownMenuOpen ? 'rotate-90' : '-rotate-90'}`} />
          </View>

          {isDropdownMenuOpen ? (
            <View className='absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-30 overflow-hidden'>
              {availableMonths.map((month) => (
                <View
                  key={month}
                  onClick={() => {
                    setSelectedMonth(month)
                    setIsDropdownMenuOpen(false)
                  }}
                  className={`px-4 py-3 ${selectedMonth === month ? 'text-[#137fec] bg-[#137fec]/5' : 'text-slate-700'}`}
                >
                  <Text className='text-sm font-medium'>{month}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {selectedMonth === availableMonths[0] ? (
          <View className='px-3 py-1 bg-[#137fec]/10 rounded-full'>
            <Text className='text-[#137fec] text-xs font-bold uppercase tracking-wider'>最新</Text>
          </View>
        ) : null}
      </View>

      <View className='grid grid-cols-2 gap-3 p-4'>
        <View className='flex flex-col gap-2 rounded-xl p-4 bg-[#137fec]/10 border border-[#137fec]/20'>
          <View className='flex items-center gap-2 text-[#137fec]'>
            <BarChartOutlined className='text-base' />
            <Text className='text-sm font-semibold'>总销售额</Text>
          </View>
          <Text className='text-2xl font-bold leading-tight text-slate-900'>$45,230</Text>
          <View className='w-full bg-[#137fec]/20 rounded-full h-1.5 mt-2'>
            <View className='bg-[#137fec] h-1.5 rounded-full w-[92%]' />
          </View>
          <Text className='text-xs text-slate-500 mt-1'>已达成 $50k 目标的 92%</Text>
        </View>
        <View className='flex flex-col gap-2 rounded-xl p-4 bg-emerald-50 border border-emerald-200'>
          <View className='flex items-center gap-2 text-emerald-600'>
            <Logistics className='text-base' />
            <Text className='text-sm font-semibold'>预计佣金</Text>
          </View>
          <Text className='text-2xl font-bold leading-tight text-slate-900'>$2,261</Text>
          <Text className='text-xs text-emerald-600 mt-auto font-medium'>较上月增长 15%</Text>
        </View>
      </View>

      <View className='flex px-4 border-b border-slate-100'>
        <View className='flex-1 py-3 border-b-2 border-[#137fec] text-center'>
          <Text className='text-sm font-bold text-[#137fec]'>已结算订单</Text>
        </View>
        <View className='flex-1 py-3 border-b-2 border-transparent text-center'>
          <Text className='text-sm font-medium text-slate-500'>数据明细</Text>
        </View>
      </View>

      <View className='flex flex-col p-4 gap-3'>
        {settledOrdersData.map((order) => (
          <View key={order.id} className='flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50'>
            <View className='flex items-center gap-3'>
              <View className='flex w-10 h-10 items-center justify-center rounded-full bg-[#137fec]/10 text-[#137fec]'>
                <ShoppingCartOutlined className='text-lg' />
              </View>
              <View>
                <Text className='text-sm font-bold leading-tight text-slate-900'>{order.id}</Text>
                <Text className='text-xs text-slate-500 mt-0.5'>{order.company} • {order.date}</Text>
              </View>
            </View>
            <View className='text-right'>
              <Text className='text-sm font-bold leading-tight text-slate-900'>{order.amount}</Text>
              <Text className='text-xs text-emerald-600 font-medium mt-0.5'>{order.commission}</Text>
            </View>
          </View>
        ))}
        <View className='w-full py-3 mt-2 rounded-lg bg-[#137fec]/10 text-center'>
          <Text className='text-sm font-bold text-[#137fec]'>查看所有订单</Text>
        </View>
      </View>
    </View>
  )
}

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>('dashboard')

  return (
    <View className='min-h-screen w-full bg-[#eceff3] text-slate-900'>
      <View className='relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-[#f3f4f6]'>
        {activeTab === 'dashboard' ? <DashboardView /> : null}
        {activeTab === 'customers' ? <CustomersView /> : null}
        {activeTab === 'orders' ? <OrdersView /> : null}
        {activeTab === 'accounting' ? <AccountingView /> : null}

        <View className='absolute bottom-0 left-0 right-0 z-50 flex border-t border-[#dbe1ea] bg-white px-3 pb-6 pt-3 shadow-[0_-4px_10px_rgba(15,23,42,0.04)]'>
          <View
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 ${activeTab === 'dashboard' ? 'text-[#2f67c7]' : 'text-[#94a3b8]'}`}
          >
            <AppsOutlined className='text-[22px]' />
            <Text className='text-[11px] font-semibold leading-none'>主页</Text>
          </View>

          <View
            onClick={() => setActiveTab('customers')}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 ${activeTab === 'customers' ? 'text-[#2f67c7]' : 'text-[#94a3b8]'}`}
          >
            <UserOutlined className='text-[22px]' />
            <Text className='text-[11px] font-semibold leading-none'>客户</Text>
          </View>

          <View
            onClick={() => setActiveTab('orders')}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 ${activeTab === 'orders' ? 'text-[#2f67c7]' : 'text-[#94a3b8]'}`}
          >
            <OrdersOutlined className='text-[22px]' />
            <Text className='text-[11px] font-semibold leading-none'>订单</Text>
          </View>

          <View
            onClick={() => setActiveTab('accounting')}
            className={`flex flex-1 flex-col items-center justify-center gap-1.5 ${activeTab === 'accounting' ? 'text-[#2f67c7]' : 'text-[#94a3b8]'}`}
          >
            <TodoList className='text-[22px]' />
            <Text className='text-[11px] font-semibold leading-none'>财务</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
