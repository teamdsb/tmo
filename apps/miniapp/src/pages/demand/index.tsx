import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
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
        await Taro.showToast({ title: '加载汇总失败', icon: 'none' })
      }
    })()
  }, [])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>需求</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>跟踪寻源需求并提交新的需求。</Text>
        <Text className='section-subtitle'>需求总数：{total}</Text>
        <View className='placeholder-actions'>
          <Button color='primary' onClick={() => navigateTo(ROUTES.demandCreate)}>
            创建需求
          </Button>
          <Button variant='outlined' onClick={() => navigateTo(ROUTES.demandList)}>
            查看我的需求
          </Button>
        </View>
      </View>
    </View>
  )
}
