import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Search from '@taroify/core/search'
import Button from '@taroify/core/button'
import SearchIcon from '@taroify/icons/Search'
import type { Category, ProductSummary } from '@tmo/api-client'
import SafeImage from '../../components/safe-image'
import { goodsDetailRoute } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { renderCategoryIcon, resolveCategoryIconKey } from '../../utils/category-icons'
import { navigateTo } from '../../utils/navigation'
import { commerceServices } from '../../services/commerce'
import './index.scss'

const sortCategories = (items: Category[]) => {
  return [...items].sort((left, right) => {
    const leftSort = typeof left.sort === 'number' ? left.sort : Number.MAX_SAFE_INTEGER
    const rightSort = typeof right.sort === 'number' ? right.sort : Number.MAX_SAFE_INTEGER
    return leftSort - rightSort
  })
}

export default function CategoryPage() {
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  const sortedCategories = useMemo(() => sortCategories(categories), [categories])

  const activeCategory = useMemo(() => {
    return sortedCategories.find((item) => item.id === activeCategoryId) ?? null
  }, [activeCategoryId, sortedCategories])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setCategoriesLoading(true)
      try {
        const response = await commerceServices.catalog.listCategories()
        if (cancelled) {
          return
        }
        const nextCategories = sortCategories(response.items ?? [])
        setCategories(nextCategories)
        setActiveCategoryId((prev) => {
          if (prev && nextCategories.some((item) => item.id === prev)) {
            return prev
          }
          return nextCategories[0]?.id ?? ''
        })
      } catch (error) {
        console.warn('load categories failed', error)
        await Taro.showToast({ title: '加载分类失败', icon: 'none' })
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeCategoryId) {
      setProducts([])
      return
    }

    let cancelled = false

    void (async () => {
      setProductsLoading(true)
      try {
        const response = await commerceServices.catalog.listProducts({
          categoryId: activeCategoryId,
          q: query || undefined,
          page: 1,
          pageSize: 40
        })
        if (!cancelled) {
          setProducts(response.items ?? [])
        }
      } catch (error) {
        console.warn('load category products failed', error)
        await Taro.showToast({ title: '加载商品失败', icon: 'none' })
      } finally {
        if (!cancelled) {
          setProductsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeCategoryId, query])

  return (
    <View className='page category-page' style={isH5 ? navbarStyle : undefined}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary' /> : null}

      <View className='category-search'>
        <Search
          value={query}
          shape='rounded'
          clearable
          icon={<SearchIcon />}
          placeholder='搜索 SKU 或商品...'
          onChange={(event) => setQuery(event.detail.value)}
        />
      </View>

      <View className='category-body'>
        <ScrollView className='category-sidebar' scrollY>
          <View className='category-sidebar-scroll-inner'>
            {sortedCategories.map((entry, index) => {
              const isActive = entry.id === activeCategoryId
              return (
                <View
                  key={entry.id}
                  className={`category-sidebar-item ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveCategoryId(entry.id)}
                >
                  <View className='category-sidebar-indicator' />
                  <View className='category-sidebar-icon'>{renderCategoryIcon(resolveCategoryIconKey(entry.name, index))}</View>
                  <Text className='category-sidebar-label'>{entry.name}</Text>
                </View>
              )
            })}

            {!categoriesLoading && sortedCategories.length === 0 ? (
              <View className='category-sidebar-empty'>暂无分类</View>
            ) : null}
          </View>
        </ScrollView>

        <ScrollView className='category-content' scrollY>
          <View className='category-content-scroll-inner'>
            <View className='category-content-inner'>
              <View className='category-overview'>
                <Text className='category-overview-title'>{activeCategory?.name ?? '分类'}</Text>
                <Text className='category-overview-subtitle'>
                  {productsLoading ? '正在加载商品...' : `共 ${products.length} 件商品`}
                </Text>
              </View>

              {productsLoading ? (
                <View className='category-loading'>
                  <Text className='category-loading-text'>正在加载...</Text>
                </View>
              ) : null}

              {!productsLoading && products.length > 0 ? (
                <View className='category-grid'>
                  {products.map((item) => (
                    <View
                      key={item.id}
                      className='category-product-card'
                      onClick={() => navigateTo(goodsDetailRoute(item.id))}
                    >
                      <SafeImage
                        className='category-product-image'
                        src={item.coverImageUrl}
                        width='100%'
                        height={168}
                        mode='aspectFill'
                      />
                      <View className='category-product-body'>
                        <Text className='category-product-title'>{item.name}</Text>
                        <View className='category-product-footer'>
                          <Text className='category-product-tag'>{item.tags?.[0] ?? activeCategory?.name ?? '商品'}</Text>
                          <Button size='mini' color='primary'>查看</Button>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {!productsLoading && products.length === 0 ? (
                <View className='category-empty'>
                  <Text className='category-empty-title'>暂无商品</Text>
                  <Text className='category-empty-subtitle'>试试其他关键词或分类。</Text>
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>

    </View>
  )
}
