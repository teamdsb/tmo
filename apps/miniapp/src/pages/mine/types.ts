import type { ComponentType } from 'react'

export type IconComponent = ComponentType<{ className?: string }>

export type MenuItem = {
  key: string
  label: string
  icon: IconComponent
  description?: string
  action?: () => void
  route?: string
}

export type OrderItem = {
  key: string
  label: string
  icon: IconComponent
  badge?: string
  onClick: () => void
}

export type MineSubview = 'profile' | 'orders' | 'address' | 'demand'

export type MineOrderItem = {
  name: string
  specs: string
  price: number
  count: number
  image: string
}

export type MineOrder = {
  id: string
  status: string
  sourceStatus: string
  date: string
  totalPrice: number
  items: MineOrderItem[]
  tracking: {
    latest: string
    time: string
  }
}

export type MockAddress = {
  id: number
  name: string
  phone: string
  tag: string
  address: string
  isDefault: boolean
}

export type MockDemand = {
  id: number
  title: string
  status: string
  count: string
  date: string
  createdAt: string
}

export type OrderBadges = Partial<Record<'pending' | 'shipped' | 'delivered' | 'returns', string>>
