import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import type { TrackingInfoShipmentsItem } from '@tmo/api-client'
import { ROUTES, shipmentTrackingDetailRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import { formatTrackingDate, trackingCarrierLabel, trackingStatusLabel } from './shared'

export default function OrderTracking() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [shipments, setShipments] = useState<TrackingInfoShipmentsItem[]>([])
  const [loading, setLoading] = useState(false)

  const orderId = router.params?.id

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.orders))
  }

  useEffect(() => {
    if (!orderId || typeof orderId !== 'string') return
    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.tracking.getTracking(orderId)
        setShipments(response.shipments ?? [])
      } catch (error) {
        console.warn('load tracking failed', error)
        await Taro.showToast({ title: '加载物流失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>物流跟踪</Navbar.Title>
        <Navbar.NavRight>
          <Tag size='small' color='primary'>{shipments.length} 单</Tag>
        </Navbar.NavRight>
      </Navbar>
      <View className='page-content'>
        <Cell.Group inset>
          {shipments.map((shipment, index) => (
            <View
              key={`${shipment.waybillNo}-${shipment.shippedAt ?? ''}-${index}`}
              className='bg-white rounded-2xl border border-slate-100 p-4 mb-3'
            >
              <View className='flex items-start justify-between gap-3'>
                <View className='min-w-0 flex-1'>
                  <Text className='block text-sm font-semibold text-slate-900'>
                    {shipment.waybillNo || `运单 ${index + 1}`}
                  </Text>
                  <Text className='block mt-1 text-xs text-slate-500'>
                    承运商：{trackingCarrierLabel(shipment)}
                  </Text>
                </View>
                <Tag size='small' color={shipment.shippedAt ? 'success' : 'warning'}>
                  {trackingStatusLabel(shipment)}
                </Tag>
              </View>

              <Text className='block mt-3 text-xs text-slate-500'>
                发货时间：{formatTrackingDate(shipment.shippedAt)}
              </Text>

              <View className='mt-4'>
                <Button
                  block
                  color='primary'
                  variant='outlined'
                  onClick={() => {
                    if (!orderId || typeof orderId !== 'string') {
                      return
                    }
                    return navigateTo(shipmentTrackingDetailRoute(orderId, shipment.waybillNo, index))
                  }}
                >
                  查看详情
                </Button>
              </View>
            </View>
          ))}
          {shipments.length === 0 ? (
            <Cell title={loading ? '正在加载物流...' : '暂无物流信息'} />
          ) : null}
        </Cell.Group>
      </View>
    </View>
  )
}
