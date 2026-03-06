import type { ComponentType, CSSProperties } from 'react'

export type SalesTab = 'dashboard' | 'customers' | 'orders' | 'accounting'

export type Customer = {
  id: number
  initial: string
  name: string
  contact: string
  active: string
  orders: number
}

export type SettledOrder = {
  id: string
  company: string
  date: string
  amount: string
  commission: string
}

export type OrderProduct = {
  id: number
  name: string
  model: string
  size: string
  qty: number
  price: string
  image: string
}

export type OrderStatus = '待处理' | '已发货' | '已送达'

export type Order = {
  id: string
  company: string
  date: string
  status: OrderStatus
  total: string
  products: OrderProduct[]
}

export type CustomerSubFilter = '全部' | OrderStatus

export type CustomerSubOrder = {
  id: string
  date: string
  amount: string
  status: OrderStatus
}

export type SalesIconComponent = ComponentType<{ className?: string; style?: CSSProperties }>

export type NavItem = {
  key: SalesTab
  label: string
  Icon: SalesIconComponent
}
