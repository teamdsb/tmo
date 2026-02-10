import { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import type { ProductRequest } from '@tmo/api-client'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

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
        await Taro.showToast({ title: '加载需求失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>我的需求</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <View className='demand-list-create'>
          <Button block color='primary' onClick={() => navigateTo(ROUTES.demandCreate)}>
            创建新需求
          </Button>
        </View>
        <Cell.Group inset>
          {requests.map((request) => (
            <Cell
              key={request.id}
              title={request.name}
              brief={`数量：${request.qty ?? '暂无'}`}
              rightIcon={<Tag size='small' color='primary'>已提交</Tag>}
            />
          ))}
          {requests.length === 0 ? (
            <Cell title={loading ? '正在加载需求...' : '暂无需求'} />
          ) : null}
        </Cell.Group>
      </View>
    </View>
  )
}
