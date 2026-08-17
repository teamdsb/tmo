import type { ComponentType, CSSProperties } from 'react'

export type SalesTab = 'dashboard' | 'customers' | 'orders' | 'accounting'

export type OrderStatus = '待处理' | '已确认' | '已发货' | '已送达'

export type CustomerSubFilter = '全部' | OrderStatus

export type SalesIconComponent = ComponentType<{ className?: string; style?: CSSProperties }>

export type NavItem = {
  key: SalesTab
  label: string
  Icon: SalesIconComponent
}
