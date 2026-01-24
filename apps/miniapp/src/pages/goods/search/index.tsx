import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Empty from '@taroify/core/empty'
import Grid from '@taroify/core/grid'
import Image from '@taroify/core/image'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import ArrowLeft from '@taroify/icons/ArrowLeft'
import MoreOutlined from '@taroify/icons/MoreOutlined'
import Plus from '@taroify/icons/Plus'
import { ROUTES } from '../../../routes'
import { navigateTo } from '../../../utils/navigation'

export default function SearchEmptyState() {
  const [searchValue, setSearchValue] = useState('Industrial Drill 5000')

  const recommendations = [
    {
      id: 1,
      title: 'Heavy Duty Pump G-400',
      price: '$1,220.00',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCY5JYrFhnIoUuDG0ic4fBnO7KDMeNonFlELbfSZFt7fkidRSCoWKSTt72p6BlP2PFRUxBx3YTlLhLCN1nfWo7RbXFDn8F6YtukSKLy2i_5143WkApJH69tkMK6C0x0L7BYassAq11KJibdiVKnXxDHWggwOJQoyT6XTkDORecfo21pWRRfdt1N0cjPfBMcBOhBQr-g_lK09_8GAYiHCQqQogNUnlMNP4c1ZF1_Oq4vxPgE8Pr2K1O6NsC6Vh7fjGcIH9WfT5GcNLYH',
      badgeText: 'In stock',
      badgeColor: 'success'
    },
    {
      id: 2,
      title: 'High-Grade Steel Coupler',
      price: '$45.50',
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDqcO0ZsF478oZ2ptOGZ-USmvK1N6w1JKiG3NEuzCtVxtUYWGTjb9CQMSPcvIx_0Jt3TrSDyA1QZ1SMSk7MCkIZ5P3VdLbub-OlzJZZmVGtjO8I4AE81fs3qbZYJkARLwmxi2WPUqLMJPKcODqfdGwfWx-2odJQMiiU8pN4dvpQF43Qqh8o7InQwDdm56riyjAsS6gYCgm6vjmxijmdB80iIMPDuEdjM_Ul5VaH_XgGIOEP4yBu8A5R7RPW0UphBnG6fHZUW3pOMtrk',
      badgeText: 'Low stock',
      badgeColor: 'warning'
    }
  ]

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top'>
        <Navbar.NavLeft>
          <Button variant='text' size='small' icon={<ArrowLeft />} />
        </Navbar.NavLeft>
        <Navbar.Title>Search Results</Navbar.Title>
        <Navbar.NavRight>
          <Button variant='text' size='small' icon={<MoreOutlined />} />
        </Navbar.NavRight>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchValue}
          shape='round'
          clearable
          placeholder='Search products...'
          onChange={(event) => setSearchValue(event.detail.value)}
        />
      </View>

      <View className='page-content'>
        <Empty>
          <Empty.Image src='search' />
          <Empty.Description>
            {`We couldn't find matches for "${searchValue}". Try adjusting your keywords or submit a direct request.`}
          </Empty.Description>
        </Empty>

        <Button block color='primary' icon={<Plus />} onClick={() => navigateTo(ROUTES.demandCreate)}>
          Submit a Demand Request
        </Button>
        <Text className='section-subtitle'>Our sourcing team will contact you with quotes within 24 hours.</Text>

        <Flex justify='space-between' align='center' className='section-header'>
          <Text className='section-title'>Recommended for You</Text>
        </Flex>

        <Grid columns={2} gutter={12}>
          {recommendations.map((item) => (
            <Grid.Item key={item.id}>
              <View className='recommend-card'>
                <Image width='100%' height={140} src={item.image} mode='aspectFill' />
                <View className='recommend-card-body'>
                  <Text className='recommend-card-title'>{item.title}</Text>
                  <Text className='recommend-card-price'>{item.price}</Text>
                  <Tag size='small' color={item.badgeColor as 'success' | 'warning'}>
                    {item.badgeText}
                  </Tag>
                </View>
              </View>
            </Grid.Item>
          ))}
        </Grid>
      </View>
    </View>
  )
}
