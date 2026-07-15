import {
  getOrders,
  getOrdersStats,
  getOrdersOrderId,
  postAdminOrdersOrderIdConfirmDelivery,
  postAdminOrdersOrderIdShip,
  postOrders,
  postOrdersOrderIdConfirmReceipt,
  type CreateOrderRequest,
  type GetOrdersParams,
  type Order,
  type OrderStatsResponse,
  type PagedOrderList,
  type ShipOrderRequest
} from '@tmo/api-client'

import type { OrderIdempotency } from '../idempotency'

export interface OrdersService {
  submit: (request: CreateOrderRequest, options?: { idempotencyKey?: string }) => Promise<Order>
  list: (params?: GetOrdersParams) => Promise<PagedOrderList>
  stats: () => Promise<OrderStatsResponse>
  get: (orderId: string) => Promise<Order>
  ship: (orderId: string, request: ShipOrderRequest) => Promise<Order>
  confirmDelivery: (orderId: string) => Promise<Order>
  confirmReceipt: (orderId: string) => Promise<Order>
  resetIdempotency: () => void
}

export const createOrdersService = (idempotency: OrderIdempotency): OrdersService => {
  return {
    submit: async (request, options) => {
      const idempotencyKey = options?.idempotencyKey
        ?? idempotency.getKey({
          items: request.items.map((item) => ({ skuId: item.skuId, qty: item.qty })),
          address: request.address,
          remark: request.remark ?? null
        })

      const response = await postOrders(request, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      })
      return response.data as Order
    },
    list: async (params) => (await getOrders(params)).data,
    stats: async () => (await getOrdersStats()).data,
    get: async (orderId) => (await getOrdersOrderId(orderId)).data,
    ship: async (orderId, request) => (await postAdminOrdersOrderIdShip(orderId, request)).data as Order,
    confirmDelivery: async (orderId) => (await postAdminOrdersOrderIdConfirmDelivery(orderId)).data as Order,
    confirmReceipt: async (orderId) => (await postOrdersOrderIdConfirmReceipt(orderId)).data as Order,
    resetIdempotency: () => idempotency.reset()
  }
}
