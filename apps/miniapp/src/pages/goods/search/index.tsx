import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Empty from '@taroify/core/empty'
import Grid from '@taroify/core/grid'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Plus from '@taroify/icons/Plus'
import type { ProductSummary } from '@tmo/api-client'
import Flex from '../../../components/flex'
import { useProductStartingPrices } from '../../../hooks/use-product-starting-prices'
import { ROUTES, goodsDetailRoute, withQuery } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import SafeImage from '../../../components/safe-image'

export default function SearchEmptyState() {
  const [searchValue, setSearchValue] = useState('')
  const [results, setResults] = useState<ProductSummary[]>([])
  const [recommended, setRecommended] = useState<ProductSummary[]>([])
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()
  const trimmedQuery = searchValue.trim()
  const resultStartingPrices = useProductStartingPrices(results)
  const recommendedStartingPrices = useProductStartingPrices(recommended)

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
          await Taro.showToast({ title: '搜索失败', icon: 'none' })
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(handle)
  }, [searchValue])

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.home))} />
        <Navbar.Title>搜索</Navbar.Title>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchValue}
          shape='rounded'
          clearable
          placeholder='搜索商品...'
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
                  ? '正在搜索...'
                  : `未找到与“${searchValue || '你的关键词'}”匹配的结果。请调整关键词或提交需求。`}
              </Empty.Description>
            </Empty>

            {!loading && trimmedQuery ? (
              <Text
                className='section-link demand-inline-link'
                onClick={() => navigateTo(withQuery(ROUTES.demandCreate, { kw: trimmedQuery }))}
              >
                未找到“{trimmedQuery}”？点击发布需求
              </Text>
            ) : null}

            <Button block color='primary' icon={<Plus />} onClick={() => navigateTo(ROUTES.demandCreate)}>
              提交需求
            </Button>
            <Text className='section-subtitle'>我们的寻源团队会在 24 小时内联系并提供报价。</Text>

            {recommended.length > 0 ? (
              <>
                <Flex justify='between' align='center' className='section-header'>
                  <Text className='section-title'>为你推荐</Text>
                </Flex>
                <Grid columns={2} gutter={12} className='product-grid'>
                  {recommended.map((item) => (
                    <Grid.Item key={item.id}>
                      <View className='recommend-card' onClick={() => navigateTo(goodsDetailRoute(item.id))}>
                        <SafeImage width='100%' height={140} src={item.coverImageUrl} mode='aspectFill' />
                        <View className='recommend-card-body'>
                          <Text className='recommend-card-title u-safe-title-2'>{item.name}</Text>
                          <Text className='recommend-card-price'>{recommendedStartingPrices[item.id] ?? '询价'}</Text>
                          <Tag size='small' color='primary'>
                            {item.tags?.[0] ?? '分类'}
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
            <Flex justify='between' align='center' className='section-header'>
              <Text className='section-title'>搜索结果</Text>
              <Text className='section-subtitle'>{results.length} 件</Text>
            </Flex>
            <Grid columns={2} gutter={12} className='product-grid'>
              {results.map((item) => (
                <Grid.Item key={item.id}>
                  <View className='recommend-card' onClick={() => navigateTo(goodsDetailRoute(item.id))}>
                    <SafeImage width='100%' height={140} src={item.coverImageUrl} mode='aspectFill' />
                      <View className='recommend-card-body'>
                        <Text className='recommend-card-title u-safe-title-2'>{item.name}</Text>
                        <Text className='recommend-card-price'>{resultStartingPrices[item.id] ?? '询价'}</Text>
                      <Tag size='small' color='primary'>
                        {item.tags?.[0] ?? '分类'}
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
