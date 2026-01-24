import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Tabs from '@taroify/core/tabs'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Image from '@taroify/core/image'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import AppTabbar from '../../../components/app-tabbar'
import { orderDetailRoute, orderTrackingRoute } from '../../../routes'
import { navigateTo } from '../../../utils/navigation'

const ORDERS = [
  {
    id: 'ORD-88291',
    date: 'Oct 24, 2023 · 14:30',
    status: 'Shipped',
    statusTone: 'info',
    title: 'Industrial Grade Steel Bolt X10...',
    totalUnits: '152 Units',
    priceLabel: 'Total Price',
    price: '$1,240.50',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBPtFkTTnJz7-tK01nu6XyhNmTYWdeeXHFCkor4f-GBb6Mg-42dp6wsTE2K0LOzAs5iMYxmPhEy5DrqPZCNjyOnZmmh4k-tJHYr7mcXK-SyP6UFBk92X4RfLSkdLl4ZYq9f4t0wUHGTSeGpz8mZN6BBkOEvi3qseq7RGZIVrO8n4aZi3WzcugE2huj0TAGp9sPAdbHNfsLs2dgrM-RGjXB12X5RBBSDiMC12wuyApAEXCfP8ixHiQYdbIsSjkm_C_CAsrRORhPY-vzY',
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAnPMvTeyxKpURIclK4WcQBEoztQwcgoIduvJ7elXci4t-b4jmiGH5hINqwNYaVQTsXOmmpmQPJmsVi_q-YOSprnoo5leUAX_nKjw_DKUebMVfcWtLHWDt6qjy7jTJuwl19bipAfw2yGdQExhabRQJJJdViJs2DJY8WTUSxOw7kXlmSBGUKH98nXZpnjmhvF5TWEeOI_t6LkZ-FmvS3rMzptmy8f0S4H0nynw1QUaMPCFHHXpucRlWV5xevXTvYKnm2PM2qWJS297Fi'
    ],
    moreImagesCount: 1,
    actions: [
      { label: 'Details', primary: false },
      { label: 'Track', primary: true }
    ]
  },
  {
    id: 'ORD-88285',
    date: 'Oct 23, 2023 · 09:15',
    status: 'Pending Intent',
    statusTone: 'warning',
    title: 'Ergonomic Office Chair Pro',
    totalUnits: '5 Units',
    priceLabel: 'Est. Total',
    price: '$675.00',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDe7m1RTxL4-VlzD8EF8swLSee4fT57qak-mM014a0GStp2i7S5NuxLAXIR1qAshFpCJkY_-olfmgn5uqRNPN3AcbADyS0WGM2Y4wiJ6ZghxFoM-g7S-WJJUVGBoAaDUJU2alarMOlRXqX-kwDDZW6PrcSesHu1l1PMb6HG6H2vO77ahxmtngETasDsGbgWPaGybJr5q7_IMCQUHC46kts-wHVc-rhvyW8K2E9SFReV38XXYjmcYfcd7HkkBzsGnchKBzw8O_X7o17q'
    ],
    moreImagesCount: 0,
    actions: [{ label: 'View Quote', primary: false }]
  },
  {
    id: 'ORD-88102',
    date: 'Oct 15, 2023 · 16:45',
    status: 'Completed',
    statusTone: 'success',
    title: 'Heavy Duty Shipping Box L',
    totalUnits: '500 Units',
    priceLabel: 'Final Price',
    price: '$850.00',
    images: [
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDGj0LySxxnfLRBsNvxC-nPykQ5urTBjIfVH6fpVr8Mq6q86Eoc900uHrsM4CWGhiTa9mh1Hjt_59YVZA8IA8o2egRuHhPMh4OOTNdFLPyy2z65oun7A7T75qdtMxB9Gx2g6hdqG7a6CoFl7wbFQ5OqSxcViSThFyQsbrrOF2K3eSm2S5yLloAGrV9xlvJmEFK-mPaQa76VxZBF-w06tpKTQ_Ecu_J9NqQcflv5Lxn_pdg9JpuXZou5PV-r29n5aUgmxkh1RVsTN382'
    ],
    moreImagesCount: 0,
    actions: [{ label: 'Reorder', primary: false }]
  }
]

const TABS = ['All', 'Pending Intent', 'Confirmed', 'Shipped', 'Completed']

export default function OrderHistoryApp() {
  const [activeTab, setActiveTab] = useState(TABS[0])
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <View className='page page-compact-navbar'>
      <Navbar bordered fixed placeholder safeArea='top'>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchQuery}
          shape='round'
          clearable
          placeholder='Search by Order ID or Product...'
          onChange={(event) => setSearchQuery(event.detail.value)}
        />
      </View>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
        {TABS.map((tab) => (
          <Tabs.TabPane key={tab} value={tab} title={tab}>
            <Cell.Group inset>
              {ORDERS.map((order) => (
                <Cell key={order.id} bordered={false}>
                  <Flex justify='space-between' align='center'>
                    <View>
                      <Text className='order-id'>{order.id}</Text>
                      <Text className='order-date'>{order.date}</Text>
                    </View>
                    <Tag size='small' color={order.statusTone as 'info' | 'warning' | 'success'}>
                      {order.status}
                    </Tag>
                  </Flex>

                  <View className='order-title'>
                    <Text>{order.title}</Text>
                  </View>

                  <Flex justify='space-between' align='center'>
                    <Text className='order-meta'>{order.totalUnits}</Text>
                    <View className='order-price'>
                      <Text className='order-label'>{order.priceLabel}</Text>
                      <Text className='order-value'>{order.price}</Text>
                    </View>
                  </Flex>

                  <Flex align='center' gutter={8} className='order-images'>
                    {order.images.map((image, index) => (
                      <Image key={`${order.id}-${index}`} src={image} width={44} height={44} round />
                    ))}
                    {order.moreImagesCount > 0 ? (
                      <View className='order-more'>
                        <Text>+{order.moreImagesCount}</Text>
                      </View>
                    ) : null}
                  </Flex>

                  <Flex align='center' gutter={8} className='order-actions'>
                    {order.actions.map((action) => (
                      <Button
                        key={`${order.id}-${action.label}`}
                        size='small'
                        color={action.primary ? 'primary' : 'default'}
                        variant={action.primary ? 'contained' : 'outlined'}
                        onClick={() => {
                          if (action.label === 'Track') {
                            navigateTo(orderTrackingRoute(order.id))
                            return
                          }
                          navigateTo(orderDetailRoute(order.id))
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </Flex>
                </Cell>
              ))}
            </Cell.Group>
          </Tabs.TabPane>
        ))}
      </Tabs>

      <AppTabbar value='orders' />
    </View>
  )
}
