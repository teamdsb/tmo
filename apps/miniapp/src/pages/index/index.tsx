import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Tabs from '@taroify/core/tabs'
import Grid from '@taroify/core/grid'
import Image from '@taroify/core/image'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import FilterOutlined from '@taroify/icons/FilterOutlined'
import SearchIcon from '@taroify/icons/Search'
import ShoppingCartOutlined from '@taroify/icons/ShoppingCartOutlined'
import AppTabbar from '../../components/app-tabbar'
import { goodsDetailRoute } from '../../routes'
import { navigateTo } from '../../utils/navigation'

const PRODUCTS = [
  {
    id: 1,
    sku: 'BOLT-X10',
    title: 'Industrial Grade Steel Bolt X10',
    price: '$2.50 - $4.00',
    minUnits: 'Min: 50 units',
    tag: 'Bulk Ready',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPtFkTTnJz7-tK01nu6XyhNmTYWdeeXHFCkor4f-GBb6Mg-42dp6wsTE2K0LOzAs5iMYxmPhEy5DrqPZCNjyOnZmmh4k-tJHYr7mcXK-SyP6UFBk92X4RfLSkdLl4ZYq9f4t0wUHGTSeGpz8mZN6BBkOEvi3qseq7RGZIVrO8n4aZi3WzcugE2huj0TAGp9sPAdbHNfsLs2dgrM-RGjXB12X5RBBSDiMC12wuyApAEXCfP8ixHiQYdbIsSjkm_C_CAsrRORhPY-vzY'
  },
  {
    id: 2,
    sku: 'CHR-PRO',
    title: 'Ergonomic Office Chair Pro',
    price: '$120.00 - $150.00',
    minUnits: 'Min: 5 units',
    tag: 'Stock Low',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDe7m1RTxL4-VlzD8EF8swLSee4fT57qak-mM014a0GStp2i7S5NuxLAXIR1qAshFpCJkY_-olfmgn5uqRNPN3AcbADyS0WGM2Y4wiJ6ZghxFoM-g7S-WJJUVGBoAaDUJU2alarMOlRXqX-kwDDZW6PrcSesHu1l1PMb6HG6H2vO77ahxmtngETasDsGbgWPaGybJr5q7_IMCQUHC46kts-wHVc-rhvyW8K2E9SFReV38XXYjmcYfcd7HkkBzsGnchKBzw8O_X7o17q'
  },
  {
    id: 3,
    sku: 'CBL-E100',
    title: 'High-Speed Ethernet Cable 100m',
    price: '$5.00 - $8.00',
    minUnits: 'Min: 100 units',
    tag: 'Fast Ship',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnPMvTeyxKpURIclK4WcQBEoztQwcgoIduvJ7elXci4t-b4jmiGH5hINqwNYaVQTsXOmmpmQPJmsVi_q-YOSprnoo5leUAX_nKjw_DKUebMVfcWtLHWDt6qjy7jTJuwl19bipAfw2yGdQExhabRQJJJdViJs2DJY8WTUSxOw7kXlmSBGUKH98nXZpnjmhvF5TWEeOI_t6LkZ-FmvS3rMzptmy8f0S4H0nynw1QUaMPCFHHXpucRlWV5xevXTvYKnm2PM2qWJS297Fi'
  },
  {
    id: 4,
    sku: 'BOX-HD',
    title: 'Heavy Duty Shipping Box L',
    price: '$1.20 - $2.00',
    minUnits: 'Min: 200 units',
    tag: 'Recyclable',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGj0LySxxnfLRBsNvxC-nPykQ5urTBjIfVH6fpVr8Mq6q86Eoc900uHrsM4CWGhiTa9mh1Hjt_59YVZA8IA8o2egRuHhPMh4OOTNdFLPyy2z65oun7A7T75qdtMxB9Gx2g6hdqG7a6CoFl7wbFQ5OqSxcViSThFyQsbrrOF2K3eSm2S5yLloAGrV9xlvJmEFK-mPaQa76VxZBF-w06tpKTQ_Ecu_J9NqQcflv5Lxn_pdg9JpuXZou5PV-r29n5aUgmxkh1RVsTN382'
  }
]

const CATEGORIES = ['Electronics', 'Office Supplies', 'Industrial Tools', 'Packaging']

export default function ProductCatalogApp() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <View className='page page-home'>
      <Navbar bordered fixed placeholder safeArea='top'>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchQuery}
          shape='round'
          clearable
          icon={<SearchIcon />}
          placeholder='Search by SKU or Name...'
          onChange={(event) => setSearchQuery(event.detail.value)}
        />
      </View>

      <Tabs
        value={activeCategory}
        onChange={(value) => setActiveCategory(String(value))}
        sticky
        swipeable={false}
      >
        {CATEGORIES.map((category) => (
          <Tabs.TabPane key={category} value={category} title={category}>
            <View className='page-content'>
              <Flex justify='space-between' align='center'>
                <Text className='page-subtitle'>Showing 124 products</Text>
                <Flex justify='end' gutter={8}>
                  <Button size='small' variant='outlined' icon={<FilterOutlined />} />
                  <Button size='small' variant='outlined' icon={<AppsOutlined />} />
                </Flex>
              </Flex>

              <Grid columns={2} gutter={12} className='page-grid'>
                {PRODUCTS.map((product) => (
                  <Grid.Item key={product.id}>
                    <ProductCard data={product} />
                  </Grid.Item>
                ))}
              </Grid>
            </View>
          </Tabs.TabPane>
        ))}
      </Tabs>

      <AppTabbar value='home' />
    </View>
  )
}

function ProductCard({ data }: { data: (typeof PRODUCTS)[number] }) {
  return (
    <View className='product-card' onClick={() => navigateTo(goodsDetailRoute(data.id))}>
      <Image src={data.image} width='100%' height={150} mode='aspectFill' />
      <View className='product-card-body'>
        <Text className='product-card-title'>{data.title}</Text>
        <Text className='product-card-price'>{data.price}</Text>
        <Text className='product-card-min'>{data.minUnits}</Text>
        <Flex justify='space-between' align='center'>
          <Tag size='small' variant='outlined' color='primary'>
            {data.tag}
          </Tag>
          <Button size='mini' color='primary' icon={<ShoppingCartOutlined />} />
        </Flex>
      </View>
    </View>
  )
}
