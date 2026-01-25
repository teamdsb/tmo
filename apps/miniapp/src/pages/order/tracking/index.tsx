import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import AppTabbar from '../../../components/app-tabbar'
import { getNavbarStyle } from '../../../utils/navbar'
import { commerceServices } from '../../../services/commerce'
import type { TrackingInfoShipmentsItem } from '@tmo/api-client'

export default function OrderTracking() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [shipments, setShipments] = useState<TrackingInfoShipmentsItem[]>([])
  const [loading, setLoading] = useState(false)

  const orderId = router.params?.id

  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return
    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.tracking.getTracking(orderId)
        setShipments(response.shipments ?? [])
      } catch (error) {
        console.warn('load tracking failed', error)
        await Taro.showToast({ title: 'Failed to load tracking', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <View className='order-header'>
          <Text className='section-title'>Tracking</Text>
          <Tag size='small' color='primary'>{shipments.length} shipments</Tag>
        </View>

        <Cell.Group inset>
          {shipments.map((shipment) => (
            <Cell
              key={`${shipment.waybillNo}-${shipment.shippedAt ?? ''}`}
              title={shipment.waybillNo}
              brief={`Carrier: ${shipment.carrier ?? 'Unknown'}`}
              rightIcon={<Text>{shipment.shippedAt ? formatDate(shipment.shippedAt) : 'Pending'}</Text>}
            />
          ))}
          {shipments.length === 0 ? (
            <Cell title={loading ? 'Loading tracking...' : 'No shipments yet'} />
          ) : null}
        </Cell.Group>
      </View>
      <AppTabbar value='orders' />
    </View>
  )
}

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString()
}
