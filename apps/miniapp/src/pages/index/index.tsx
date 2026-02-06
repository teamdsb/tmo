import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Tabs from '@taroify/core/tabs'
import Grid from '@taroify/core/grid'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import FilterOutlined from '@taroify/icons/FilterOutlined'
import SearchIcon from '@taroify/icons/Search'
import type { Category, ProductSummary } from '@tmo/api-client'
import AppTabbar from '../../components/app-tabbar'
import SafeImage from '../../components/safe-image'
import { goodsDetailRoute } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo } from '../../utils/navigation'
import { commerceServices } from '../../services/commerce'

export default function ProductCatalogApp() {
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()

  useEffect(() => {
    void (async () => {
      try {
        const data = await commerceServices.catalog.listCategories()
        setCategories(data.items ?? [])
      } catch (error) {
        console.warn('load categories failed', error)
        await Taro.showToast({ title: '加载分类失败', icon: 'none' })
      }
    })()
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const response = await commerceServices.catalog.listProducts({
            q: searchQuery || undefined,
            categoryId: activeCategory === 'all' ? undefined : activeCategory,
            page: 1,
            pageSize: 20
          })
          setProducts(response.items ?? [])
          setTotal(response.total ?? 0)
        } catch (error) {
          console.warn('load products failed', error)
          await Taro.showToast({ title: '加载商品失败', icon: 'none' })
        } finally {
          setLoading(false)
        }
      })()
    }, 300)
    return () => clearTimeout(handle)
  }, [activeCategory, searchQuery])

  const categoryTabs = [{ id: 'all', name: '全部' }, ...categories]

  return (
    <View className='page page-home'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'>
      </Navbar>

      <View className='page-search'>
        <Search
          value={searchQuery}
          shape='rounded'
          clearable
          icon={<SearchIcon />}
          placeholder='按 SKU 或名称搜索...'
          onChange={(event) => setSearchQuery(event.detail.value)}
        />
      </View>

      <Tabs
        value={activeCategory}
        onChange={(value) => setActiveCategory(String(value))}
        sticky
        swipeable={false}
      >
        {categoryTabs.map((category) => (
          <Tabs.TabPane key={category.id} value={category.id} title={category.name}>
            <View className='page-content'>
              <Flex justify='space-between' align='center'>
                <Text className='page-subtitle'>
                  {loading ? '正在加载商品...' : `共 ${total} 件商品`}
                </Text>
                <Flex justify='end' gutter={8}>
                  <Button size='small' variant='outlined' icon={<FilterOutlined />} />
                  <Button size='small' variant='outlined' icon={<AppsOutlined />} />
                </Flex>
              </Flex>

              <Grid columns={2} gutter={12} className='page-grid'>
                {products.map((product) => (
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

function ProductCard({ data }: { data: ProductSummary }) {
  const tagLabel = data.tags?.[0] ?? '分类'
  return (
    <View className='product-card' onClick={() => navigateTo(goodsDetailRoute(data.id))}>
      <SafeImage src={data.coverImageUrl} width='100%' height={150} mode='aspectFill' />
      <View className='product-card-body'>
        <Text className='product-card-title'>{data.name}</Text>
        <Text className='product-card-price'>价格详见详情</Text>
        <Text className='product-card-min'>编号：{data.id.slice(0, 8)}</Text>
        <Flex justify='space-between' align='center'>
          <Tag size='small' variant='outlined' color='primary'>
            {tagLabel}
          </Tag>
          <Button size='mini' color='primary'>详情</Button>
        </Flex>
      </View>
    </View>
  )
}
