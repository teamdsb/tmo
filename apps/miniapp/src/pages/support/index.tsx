import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tabs from '@taroify/core/tabs'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import AppTabbar from '../../components/app-tabbar'
import { getNavbarStyle } from '../../utils/navbar'
import { commerceServices } from '../../services/commerce'
import type { AfterSalesTicket, PriceInquiry } from '@tmo/api-client'

export default function SupportPage() {
  const navbarStyle = getNavbarStyle()
  const [activeTab, setActiveTab] = useState('after-sales')
  const [tickets, setTickets] = useState<AfterSalesTicket[]>([])
  const [inquiries, setInquiries] = useState<PriceInquiry[]>([])
  const [loading, setLoading] = useState(false)

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
        await Taro.showToast({ title: 'Failed to load support', icon: 'none' })
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
        <Text className='section-title'>Support</Text>
      </View>
      <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
        <Tabs.TabPane value='after-sales' title='After Sales'>
          <Cell.Group inset>
            {tickets.map((ticket) => (
              <Cell
                key={ticket.id}
                title={ticket.subject}
                brief={`Status: ${ticket.status}`}
                rightIcon={<Tag size='small' color='primary'>Ticket</Tag>}
              />
            ))}
            {tickets.length === 0 ? (
              <Cell title={loading ? 'Loading tickets...' : 'No after-sales tickets'} />
            ) : null}
          </Cell.Group>
        </Tabs.TabPane>
        <Tabs.TabPane value='inquiries' title='Price Inquiries'>
          <Cell.Group inset>
            {inquiries.map((inquiry) => (
              <Cell
                key={inquiry.id}
                title={inquiry.message}
                brief={`Status: ${inquiry.status}`}
                rightIcon={<Tag size='small' color='primary'>Inquiry</Tag>}
              />
            ))}
            {inquiries.length === 0 ? (
              <Cell title={loading ? 'Loading inquiries...' : 'No price inquiries'} />
            ) : null}
          </Cell.Group>
        </Tabs.TabPane>
      </Tabs>
      <AppTabbar value='mine' />
    </View>
  )
}
