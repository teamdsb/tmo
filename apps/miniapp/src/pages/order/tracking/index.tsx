import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import type { TrackingInfoShipmentsItem } from '@tmo/api-client'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

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
          {shipments.map((shipment) => (
            <Cell
              key={`${shipment.waybillNo}-${shipment.shippedAt ?? ''}`}
              title={shipment.waybillNo}
              brief={`承运商：${shipment.carrier ?? '未知'}`}
              rightIcon={<Text>{shipment.shippedAt ? formatDate(shipment.shippedAt) : '待处理'}</Text>}
            />
          ))}
          {shipments.length === 0 ? (
            <Cell title={loading ? '正在加载物流...' : '暂无物流信息'} />
          ) : null}
        </Cell.Group>
      </View>
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
