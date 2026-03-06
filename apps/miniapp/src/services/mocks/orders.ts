import type { Order, Sku, TrackingInfo } from '@tmo/api-client'
import { canonicalOrderFixtures } from '../../../../../packages/shared/src/mock-data/index.js'

import { findMockSkuById } from './catalog'

const toSku = (skuId: string): Sku => {
  const found = findMockSkuById(skuId)
  if (found) {
    return found
  }

  return {
    id: skuId,
    spuId: skuId,
    name: `示例规格 ${skuId.slice(0, 8)}`,
    spec: '默认规格',
    priceTiers: [{ minQty: 1, maxQty: null, unitPriceFen: 9800 }],
    isActive: true
  }
}

const cloneTracking = (tracking: any): TrackingInfo => {
  return {
    orderId: String(tracking?.orderId || ''),
    shipments: Array.isArray(tracking?.shipments)
      ? tracking.shipments.map((shipment: any) => ({
          carrier: shipment?.carrier ?? null,
          waybillNo: String(shipment?.waybillNo || ''),
          shippedAt: shipment?.shippedAt ?? null
        }))
      : []
  }
}

export const buildSeedOrders = (): Order[] => {
  return (canonicalOrderFixtures as any[]).map((fixture) => ({
    id: String(fixture?.id || ''),
    status: String(fixture?.status || 'SUBMITTED') as Order['status'],
    paymentStatus: String(fixture?.paymentStatus || 'UNPAID') as Order['paymentStatus'],
    latestPaymentId: typeof fixture?.latestPaymentId === 'string' ? fixture.latestPaymentId : undefined,
    paymentChannel: typeof fixture?.paymentChannel === 'string' ? fixture.paymentChannel : undefined,
    paidAt: typeof fixture?.paidAt === 'string' ? fixture.paidAt : undefined,
    address: fixture?.address
      ? {
          receiverName: String(fixture.address.receiverName || ''),
          receiverPhone: String(fixture.address.receiverPhone || ''),
          detail: String(fixture.address.detail || '')
        }
      : undefined,
    items: Array.isArray(fixture?.items)
      ? fixture.items.map((item: any) => {
          const sku = toSku(String(item?.skuId || 'mock-sku'))
          const qty = Number(item?.qty || 1)
          const unitPriceFen = Number(item?.unitPriceFen ?? sku.priceTiers?.[0]?.unitPriceFen ?? 0)
          return {
            sku,
            qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
            unitPriceFen: Number.isFinite(unitPriceFen) ? Math.max(0, Math.floor(unitPriceFen)) : 0
          }
        })
      : [],
    remark: typeof fixture?.remark === 'string' ? fixture.remark : undefined,
    createdAt: String(fixture?.createdAt || new Date().toISOString()),
    updatedAt: String(fixture?.updatedAt || fixture?.createdAt || new Date().toISOString())
  }))
}

export const buildSeedTrackingByOrderId = (): Record<string, TrackingInfo> => {
  return (canonicalOrderFixtures as any[]).reduce<Record<string, TrackingInfo>>((acc, fixture) => {
    const orderId = String(fixture?.id || '')
    if (!orderId) {
      return acc
    }

    acc[orderId] = cloneTracking(
      fixture?.tracking || {
        orderId,
        shipments: []
      }
    )
    return acc
  }, {})
}
