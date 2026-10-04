import type { OrderStatus as ApiOrderStatus } from '@tmo/api-client'
import {
  AppsOutlined,
  BalanceOutlined,
  FriendsOutlined,
  OrdersOutlined
} from '@taroify/icons'
import type {
  CustomerSubFilter,
  NavItem,
  OrderStatus
} from './types'

export const customerSubFilters: CustomerSubFilter[] = ['全部', '待处理', '已确认', '已发货', '已送达']

export const navItems: NavItem[] = [
  { key: 'dashboard', label: '主页', Icon: AppsOutlined },
  { key: 'customers', label: '客户', Icon: FriendsOutlined },
  { key: 'orders', label: '订单', Icon: OrdersOutlined },
  { key: 'accounting', label: '财务', Icon: BalanceOutlined }
]

export const getStatusTone = (status: OrderStatus) => {
  if (status === '待处理') {
    return { bg: 'sales-status-amber', text: 'sales-status-amber-text' }
  }
  if (status === '已送达') {
    return { bg: 'sales-status-emerald', text: 'sales-status-emerald-text' }
  }
  return { bg: 'sales-status-blue', text: 'sales-status-blue-text' }
}

const statusGroups: Record<Exclude<CustomerSubFilter, '全部'>, ApiOrderStatus[]> = {
  待处理: ['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED'],
  已确认: ['CONFIRMED', 'PAID'],
  已发货: ['SHIPPED'],
  已送达: ['DELIVERED']
}

export const getOrderStatuses = (filter: CustomerSubFilter): ApiOrderStatus[] | undefined => (
  filter === '全部' ? undefined : statusGroups[filter]
)
