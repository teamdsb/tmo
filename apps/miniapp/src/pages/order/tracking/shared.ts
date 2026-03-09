import type { TrackingInfoShipmentsItem } from '@tmo/api-client'

export const formatTrackingDate = (value?: string | null) => {
  if (!value) {
    return '待物流处理'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export const trackingCarrierLabel = (shipment?: TrackingInfoShipmentsItem | null) => {
  const carrier = shipment?.carrier?.trim()
  return carrier ? carrier : '未知承运商'
}

export const trackingStatusLabel = (shipment?: TrackingInfoShipmentsItem | null) => {
  return shipment?.shippedAt ? '已发货，等待物流更新' : '待发货/待物流处理'
}

export const resolveShipment = (
  shipments: TrackingInfoShipmentsItem[],
  waybillNo?: string,
  shipmentIndex?: number
) => {
  if (waybillNo) {
    const found = shipments.find((shipment) => shipment.waybillNo === waybillNo)
    if (found) {
      return found
    }
  }

  if (typeof shipmentIndex === 'number' && shipmentIndex >= 0 && shipmentIndex < shipments.length) {
    return shipments[shipmentIndex]
  }

  return null
}
