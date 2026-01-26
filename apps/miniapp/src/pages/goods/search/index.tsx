import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Empty from '@taroify/core/empty'
import Grid from '@taroify/core/grid'
import Image from '@taroify/core/image'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import Plus from '@taroify/icons/Plus'
import type { ProductSummary } from '@tmo/api-client'
import { ROUTES, goodsDetailRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

const fallbackImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDqcO0ZsF478oZ2ptOGZ-USmvK1N6w1JKiG3NEuzCtVxtUYWGTjb9CQMSPcvIx_0Jt3TrSDyA1QZ1SMSk7MCkIZ5P3VdLbub-OlzJZZmVGtjO8I4AE81fs3qbZYJkARLwmxi2WPUqLMJPKcODqfdGwfWx-2odJQMiiU8pN4dvpQF43Qqh8o7InQwDdm56riyjAsS6gYCgm6vjmxijmdB80iIMPDuEdjM_Ul5VaH_XgGIOEP4yBu8A5R7RPW0UphBnG6fHZUW3pOMtrk'

export default function SearchEmptyState() {
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<ProductSummary[]>([])
  const [recommended, setRecommended] = useState<ProductSummary[]>([])
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        const query = searchValue.trim()
        setLoading(true)
        try {
          if (!query) {
            const fallback = await commerceServices.catalog.listProducts({ page: 1, pageSize: 6 })
            setRecommended(fallback.items ?? [])
            setResults([])
            return
          }
          const response = await commerceServices.catalog.listProducts({ q: query, page: 1, pageSize: 10 })
          setResults(response.items ?? [])
          if (!response.items || response.items.length === 0) {
            const fallback = await commerceServices.catalog.listProducts({ page: 1, pageSize: 6 })
            setRecommended(fallback.items ?? [])
          } else {
            setRecommended([])
          }
        } catch (error) {
          console.warn('search failed', error)
          await Taro.showToast({ title: 'Search failed', icon: 'none' })
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(handle)
  }, [searchValue])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
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
        {results.length === 0 ? (
          <>
            <Empty>
              <Empty.Image src='search' />
              <Empty.Description>
                {loading
                  ? 'Searching...'
                  : `We couldn't find matches for "${searchValue || 'your query'}". Try adjusting your keywords or submit a direct request.`}
              </Empty.Description>
            </Empty>

            <Button block color='primary' icon={<Plus />} onClick={() => navigateTo(ROUTES.demandCreate)}>
              Submit a Demand Request
            </Button>
            <Text className='section-subtitle'>Our sourcing team will contact you with quotes within 24 hours.</Text>

            {recommended.length > 0 ? (
              <>
                <Flex justify='space-between' align='center' className='section-header'>
                  <Text className='section-title'>Recommended for You</Text>
                </Flex>
                <Grid columns={2} gutter={12}>
                  {recommended.map((item) => (
                    <Grid.Item key={item.id}>
                      <View className='recommend-card' onClick={() => navigateTo(goodsDetailRoute(item.id))}>
                        <Image width='100%' height={140} src={item.coverImageUrl || fallbackImage} mode='aspectFill' />
                        <View className='recommend-card-body'>
                          <Text className='recommend-card-title'>{item.name}</Text>
                          <Text className='recommend-card-price'>View pricing in details</Text>
                          <Tag size='small' color='primary'>
                            {item.tags?.[0] ?? 'Catalog'}
                          </Tag>
                        </View>
                      </View>
                    </Grid.Item>
                  ))}
                </Grid>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Flex justify='space-between' align='center' className='section-header'>
              <Text className='section-title'>Search Results</Text>
              <Text className='section-subtitle'>{results.length} items</Text>
            </Flex>
            <Grid columns={2} gutter={12}>
              {results.map((item) => (
                <Grid.Item key={item.id}>
                  <View className='recommend-card' onClick={() => navigateTo(goodsDetailRoute(item.id))}>
                    <Image width='100%' height={140} src={item.coverImageUrl || fallbackImage} mode='aspectFill' />
                    <View className='recommend-card-body'>
                      <Text className='recommend-card-title'>{item.name}</Text>
                      <Text className='recommend-card-price'>View pricing in details</Text>
                      <Tag size='small' color='primary'>
                        {item.tags?.[0] ?? 'Catalog'}
                      </Tag>
                    </View>
                  </View>
                </Grid.Item>
              ))}
            </Grid>
          </>
        )}
      </View>
    </View>
  )
}
