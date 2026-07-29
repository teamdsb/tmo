import type { Order, OrderPaymentStatus, OrderStatus } from '@tmo/api-client'

export type OrderProgress = 'pending' | 'shipped' | 'delivered' | 'returns' | 'hidden'

type OrderState = Pick<Order, 'status' | 'paymentStatus'>

const terminalStatuses = new Set<string>(['CANCELLED', 'CLOSED'])
const pendingStatuses = new Set<string>(['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED', 'PAID', 'CONFIRMED'])

const normalized = (value: unknown): string => typeof value === 'string' ? value.trim().toUpperCase() : ''

export const classifyOrderProgress = (order: OrderState): OrderProgress => {
  const status = normalized(order.status)
  const paymentStatus = normalized(order.paymentStatus)
  if (terminalStatuses.has(status)) {
    return 'hidden'
  }
  if (!paymentStatus) {
    if (status === 'SHIPPED' || status === 'DISPATCHED') return 'shipped'
    if (status === 'DELIVERED') return 'delivered'
    return pendingStatuses.has(status) ? 'pending' : 'hidden'
  }
  if (paymentStatus !== 'PAID') {
    return 'pending'
  }
  if (status === 'SHIPPED' || status === 'DISPATCHED') {
    return 'shipped'
  }
  if (status === 'DELIVERED') {
    return 'delivered'
  }
  return pendingStatuses.has(status) ? 'pending' : 'hidden'
}

export const orderProgressLabel = (order: OrderState): string => {
  const paymentStatus = normalized(order.paymentStatus)
  if (paymentStatus === 'UNPAID' || paymentStatus === 'PAY_PENDING') return '待付款'
  if (paymentStatus === 'PAY_FAILED') return '支付失败'
  switch (normalized(order.status)) {
    case 'CONFIRMED': return '已确认，待发货'
    case 'PAID': return '已付款，待发货'
    case 'SHIPPED':
    case 'DISPATCHED': return '已发货'
    case 'DELIVERED': return '已送达'
    default: return '待处理'
  }
}

export const progressFromStat = (status: OrderStatus | string, paymentStatus?: OrderPaymentStatus | string): OrderProgress =>
  classifyOrderProgress({ status: status as OrderStatus, paymentStatus: paymentStatus as OrderPaymentStatus })
