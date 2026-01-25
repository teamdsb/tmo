import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import AppTabbar from '../../../components/app-tabbar'
import { getNavbarStyle } from '../../../utils/navbar'
import { commerceServices } from '../../../services/commerce'
import type { ProductRequest } from '@tmo/api-client'

export default function DemandList() {
  const navbarStyle = getNavbarStyle()
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.productRequests.list({ page: 1, pageSize: 20 })
        setRequests(response.items ?? [])
      } catch (error) {
        console.warn('load demand list failed', error)
        await Taro.showToast({ title: 'Failed to load requests', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>My Demand Requests</Text>
        <Cell.Group inset>
          {requests.map((request) => (
            <Cell
              key={request.id}
              title={request.name}
              brief={`Qty: ${request.qty ?? 'N/A'}`}
              rightIcon={<Tag size='small' color='primary'>Submitted</Tag>}
            />
          ))}
          {requests.length === 0 ? (
            <Cell title={loading ? 'Loading requests...' : 'No demand requests yet'} />
          ) : null}
        </Cell.Group>
      </View>
      <AppTabbar value='demand' />
    </View>
  )
}
