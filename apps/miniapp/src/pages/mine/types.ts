import type { ComponentType } from 'react'

export type IconComponent = ComponentType<{ className?: string }>

export type MenuItem = {
  key: string
  label: string
  icon: IconComponent
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

export type MockOrderItem = {
  name: string
  specs: string
  price: number
  count: number
  image: string
}

export type MockOrder = {
  id: string
  status: string
  date: string
  totalPrice: number
  items: MockOrderItem[]
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
