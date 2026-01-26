import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import AppTabbar from '../../components/app-tabbar'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo } from '../../utils/navigation'
import { commerceServices } from '../../services/commerce'

export default function DemandHome() {
  const navbarStyle = getNavbarStyle()
  const [total, setTotal] = useState(0)

  useEffect(() => {
    void (async () => {
      try {
        const response = await commerceServices.productRequests.list({ page: 1, pageSize: 1 })
        setTotal(response.total ?? 0)
      } catch (error) {
        console.warn('load demand summary failed', error)
        await Taro.showToast({ title: 'Failed to load summary', icon: 'none' })
      }
    })()
  }, [])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>Demand Requests</Text>
        <Text className='section-subtitle'>Track sourcing requests and submit new demand.</Text>
        <Text className='section-subtitle'>Total requests: {total}</Text>
        <View className='placeholder-actions'>
          <Button color='primary' onClick={() => navigateTo(ROUTES.demandCreate)}>
            Create Demand
          </Button>
          <Button variant='outlined' onClick={() => navigateTo(ROUTES.demandList)}>
            View My Requests
          </Button>
        </View>
      </View>
      <AppTabbar value='mine' />
    </View>
  )
}
