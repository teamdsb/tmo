import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import type { TrackingInfoShipmentsItem } from '@tmo/api-client'
import { ROUTES, orderTrackingRoute } from '../../../../routes'
import { getNavbarStyle } from '../../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../../utils/navigation'
import { commerceServices } from '../../../../services/commerce'
import {
  formatTrackingDate,
  resolveShipment,
  trackingCarrierLabel,
  trackingStatusLabel
} from '../shared'

export default function ShipmentTrackingDetail() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [shipment, setShipment] = useState<TrackingInfoShipmentsItem | null>(null)
  const [loading, setLoading] = useState(false)

  const orderId = typeof router.params?.orderId === 'string' ? router.params.orderId : ''
  const waybillNo = typeof router.params?.waybillNo === 'string' ? router.params.waybillNo : undefined
  const shipmentIndexValue = Number(router.params?.shipmentIndex)
  const shipmentIndex = Number.isFinite(shipmentIndexValue) ? shipmentIndexValue : undefined

  const handleBack = () => {
    if (orderId) {
      Taro.navigateBack().catch(() => navigateTo(orderTrackingRoute(orderId)))
      return
    }
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.orders))
  }

  const handleCopyWaybill = async () => {
    if (!shipment?.waybillNo) {
      return
    }
    try {
      await Taro.setClipboardData({ data: shipment.waybillNo })
      await Taro.showToast({ title: '运单号已复制', icon: 'none' })
    } catch (error) {
      console.warn('copy waybill failed', error)
      await Taro.showToast({ title: '复制失败', icon: 'none' })
    }
  }

  useEffect(() => {
    if (!orderId) {
      setShipment(null)
      return
    }

    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.tracking.getTracking(orderId)
        setShipment(resolveShipment(response.shipments ?? [], waybillNo, shipmentIndex))
      } catch (error) {
        console.warn('load shipment detail failed', error)
        await Taro.showToast({ title: '加载物流详情失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [orderId, shipmentIndex, waybillNo])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>物流详情</Navbar.Title>
        <Navbar.NavRight>
          <Tag size='small' color={shipment ? 'primary' : 'default'}>
            {shipment ? '运单详情' : '暂无物流'}
          </Tag>
        </Navbar.NavRight>
      </Navbar>

      <View className='page-content'>
        <View className='bg-white rounded-2xl border border-slate-100 p-4 mb-4'>
          <View className='flex items-start justify-between gap-3'>
            <View className='min-w-0 flex-1'>
              <Text className='block text-xs text-slate-400'>订单号</Text>
              <Text className='block mt-1 text-sm font-semibold text-slate-900'>{orderId || '--'}</Text>
            </View>
            <Tag size='small' color={shipment?.shippedAt ? 'success' : 'warning'}>
              {trackingStatusLabel(shipment)}
            </Tag>
          </View>
          <Text className='block mt-3 text-xs text-slate-500'>
            {shipment ? '当前接口仅返回承运商、运单号和发货时间。后续有轨迹节点时可继续扩展。' : '未找到对应运单，请返回上一页重新选择。'}
          </Text>
        </View>

        {shipment ? (
          <>
            <Cell.Group inset>
              <Cell title='承运商' brief={trackingCarrierLabel(shipment)} />
              <Cell title='运单号' brief={shipment.waybillNo || '--'} />
              <Cell title='发货时间' brief={formatTrackingDate(shipment.shippedAt)} />
              <Cell title='当前状态' brief={trackingStatusLabel(shipment)} />
            </Cell.Group>

            <View className='placeholder-actions'>
              <Button block color='primary' onClick={handleCopyWaybill}>
                复制运单号
              </Button>
            </View>
          </>
        ) : (
          <Cell.Group inset>
            <Cell title={loading ? '正在加载物流详情...' : '运单不存在'} />
          </Cell.Group>
        )}
      </View>
    </View>
  )
}
