import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tabs from '@taroify/core/tabs'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import type { AfterSalesTicket, PriceInquiry } from '@tmo/api-client'
import { getNavbarStyle } from '../../utils/navbar'
import { commerceServices } from '../../services/commerce'
import { ROUTES } from '../../routes'
import { navigateTo, switchTabLike } from '../../utils/navigation'

export default function SupportPage() {
  const navbarStyle = getNavbarStyle()
  const [activeTab, setActiveTab] = useState('after-sales')
  const [tickets, setTickets] = useState<AfterSalesTicket[]>([])
  const [inquiries, setInquiries] = useState<PriceInquiry[]>([])
  const [loading, setLoading] = useState(false)

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [ticketResp, inquiryResp] = await Promise.all([
          commerceServices.afterSales.listTickets({ page: 1, pageSize: 20 }),
          commerceServices.inquiries.list({ page: 1, pageSize: 20 })
        ])
        setTickets(ticketResp.items ?? [])
        setInquiries(inquiryResp.items ?? [])
      } catch (error) {
        console.warn('load support data failed', error)
        await Taro.showToast({ title: '加载客服数据失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>客服支持</Navbar.Title>
        <Navbar.NavRight>
          <Text className='text-xs text-blue-600' onClick={() => navigateTo(ROUTES.supportCreate)}>
            新建工单
          </Text>
        </Navbar.NavRight>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>跟踪售后工单与询价。</Text>
      </View>
      <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
        <Tabs.TabPane value='after-sales' title='售后'>
          <Cell.Group inset>
            {tickets.map((ticket) => (
              <Cell
                key={ticket.id}
                title={ticket.subject}
                brief={`状态：${ticket.status}`}
                rightIcon={<Tag size='small' color='primary'>工单</Tag>}
              />
            ))}
            {tickets.length === 0 ? (
              <Cell title={loading ? '正在加载工单...' : '暂无售后工单'} />
            ) : null}
          </Cell.Group>
        </Tabs.TabPane>
        <Tabs.TabPane value='inquiries' title='询价'>
          <Cell.Group inset>
            {inquiries.map((inquiry) => (
              <Cell
                key={inquiry.id}
                title={inquiry.message}
                brief={`状态：${inquiry.status}`}
                rightIcon={<Tag size='small' color='primary'>询价</Tag>}
              />
            ))}
            {inquiries.length === 0 ? (
              <Cell title={loading ? '正在加载询价...' : '暂无询价'} />
            ) : null}
          </Cell.Group>
        </Tabs.TabPane>
      </Tabs>
    </View>
  )
}
