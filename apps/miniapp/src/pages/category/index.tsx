import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import type { Category, DisplayCategory, ProductSummary } from '@tmo/api-client'
import HomeSearchInput from '../../components/home-search-input'
import SafeImage from '../../components/safe-image'
import { useProductStartingPrices } from '../../hooks/use-product-starting-prices'
import { goodsDetailRoute } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { type CategoryIconKey, renderCategoryIcon, resolveCategoryIconKey } from '../../utils/category-icons'
import { navigateTo } from '../../utils/navigation'
import { commerceServices } from '../../services/commerce'
import './index.scss'

type SecondaryFilter = {
  id: string
  label: string
  keywords: string[]
}

type CategoryViewItem = DisplayCategory & {
  catalogCategoryId: string
  filterKey: string
}

type CategoryProductAvailability = Record<string, boolean>

const FILTER_KEY_BY_DISPLAY_CATEGORY_ID: Record<string, string> = {
  'cat-fasteners': 'fasteners',
  'cat-electrical': 'electrical',
  'cat-ppe': 'safety',
  'cat-tools': 'tools',
  'cat-instrumentation': 'instrumentation',
  'cat-janitorial': 'janitorial',
  'cat-office': 'office',
  'cat-packaging': 'packaging'
}

const FILTER_KEY_BY_CATEGORY_NAME: Record<string, string> = {
  '紧固件': 'fasteners',
  '电气': 'electrical',
  '安全防护': 'safety',
  '工具': 'tools',
  '仪器仪表': 'instrumentation',
  '劳保清洁': 'janitorial',
  '办公文具': 'office',
  '包装耗材': 'packaging'
}

const SECONDARY_FILTERS_BY_CATEGORY: Record<string, SecondaryFilter[]> = {
  fasteners: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'bolts', label: '螺栓螺母', keywords: ['螺栓', '螺母', '紧固'] },
    { id: 'washers', label: '垫圈卡簧', keywords: ['垫圈', '卡簧', '挡圈'] },
    { id: 'anchors', label: '膨胀锚固', keywords: ['膨胀', '锚栓', '锚固'] },
    { id: 'rivets', label: '铆接件', keywords: ['铆钉', '铆接'] }
  ],
  electrical: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'cables', label: '线缆线束', keywords: ['线缆', '线束', '电缆'] },
    { id: 'switches', label: '开关插座', keywords: ['开关', '插座'] },
    { id: 'control', label: '工控元件', keywords: ['控制', '工控', '继电器'] },
    { id: 'lighting', label: '照明设备', keywords: ['照明', '灯', '台灯'] }
  ],
  safety: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'ppe', label: '头手足防护', keywords: ['安全', '防护', '手套', '头盔'] },
    { id: 'visibility', label: '反光警示', keywords: ['反光', '警示'] },
    { id: 'rescue', label: '应急救援', keywords: ['应急', '救援'] },
    { id: 'shoes', label: '安全鞋服', keywords: ['鞋', '服', '跑鞋'] }
  ],
  tools: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'hand', label: '手动工具', keywords: ['扳手', '钳', '锤'] },
    { id: 'power', label: '电动工具', keywords: ['电动', '钻', '切割'] },
    { id: 'measuring', label: '测量工具', keywords: ['测量', '尺', '量具'] },
    { id: 'carry', label: '工具收纳', keywords: ['包', '箱', '收纳', '钱包'] }
  ],
  instrumentation: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'meters', label: '检测仪表', keywords: ['仪表', '检测'] },
    { id: 'sensors', label: '传感器', keywords: ['传感', '传感器'] },
    { id: 'wearables', label: '智能穿戴', keywords: ['手表', '智能'] },
    { id: 'monitoring', label: '监测终端', keywords: ['监测', '终端'] }
  ],
  janitorial: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'clean', label: '清洁用品', keywords: ['清洁', '洗', '拖'] },
    { id: 'consumables', label: '劳保耗材', keywords: ['耗材', '防护'] },
    { id: 'garments', label: '工服织物', keywords: ['衬衫', '服', 'T 恤'] },
    { id: 'care', label: '日常养护', keywords: ['养护', '护理'] }
  ],
  office: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'stationery', label: '书写文具', keywords: ['文具', '笔', '本'] },
    { id: 'paper', label: '纸张耗材', keywords: ['纸', '耗材'] },
    { id: 'devices', label: '办公设备', keywords: ['键盘', '椅', '台灯'] },
    { id: 'accessories', label: '电脑附件', keywords: ['键盘', '鼠标', '耳机'] },
    { id: 'furniture', label: '办公家具', keywords: ['椅', '桌', '家具', '花瓶', '双肩包'] }
  ],
  packaging: [
    { id: 'all', label: '全部商品', keywords: [] },
    { id: 'boxes', label: '纸箱箱袋', keywords: ['纸箱', '箱袋'] },
    { id: 'tape', label: '胶带打包', keywords: ['胶带', '打包'] },
    { id: 'labels', label: '标签标识', keywords: ['标签', '标识'] },
    { id: 'storage', label: '容器周转', keywords: ['水壶', '容器', '周转'] }
  ]
}

const isCategoryIconKey = (value: string): value is CategoryIconKey => {
  return ['notes', 'setting', 'desktop', 'shield', 'brush', 'hot', 'apps'].includes(value)
}

const sortCategories = <T extends { sort?: number }>(items: T[]): T[] => {
  return [...items].sort((left, right) => {
    const leftSort = typeof left.sort === 'number' ? left.sort : Number.MAX_SAFE_INTEGER
    const rightSort = typeof right.sort === 'number' ? right.sort : Number.MAX_SAFE_INTEGER
    return leftSort - rightSort
  })
}

const sortCategoriesByProductAvailability = (
  items: CategoryViewItem[],
  availability: CategoryProductAvailability
): CategoryViewItem[] => {
  return sortCategories(items).sort((left, right) => {
    const leftHasProducts = availability[left.id] === true
    const rightHasProducts = availability[right.id] === true
    if (leftHasProducts !== rightHasProducts) {
      return leftHasProducts ? -1 : 1
    }
    return 0
  })
}

const toDisplayCategoriesFromCatalog = (items: Category[]): DisplayCategory[] => {
  return sortCategories(items).map((item, index) => ({
    id: item.id,
    name: item.name,
    iconKey: resolveCategoryIconKey(item.name, index),
    sort: typeof item.sort === 'number' ? item.sort : index + 1,
    enabled: true
  }))
}

const toCategoryViewItems = (displayItems: DisplayCategory[], catalogItems: Category[]): CategoryViewItem[] => {
  const catalogByName = new Map(catalogItems.map((item) => [item.name, item.id]))

  return sortCategories(displayItems)
    .filter((item) => item.enabled !== false)
    .map((item) => {
      const displayId = String(item.id)
      const name = String(item.name)
      return {
        ...item,
        id: displayId,
        catalogCategoryId: catalogByName.get(name) ?? displayId,
        filterKey: FILTER_KEY_BY_DISPLAY_CATEGORY_ID[displayId] ?? FILTER_KEY_BY_CATEGORY_NAME[name] ?? displayId
      }
    })
}

const matchesSecondaryFilter = (product: ProductSummary, filter: SecondaryFilter, categoryName: string): boolean => {
  if (filter.keywords.length === 0) {
    return true
  }

  const haystack = [
    product.name,
    ...(Array.isArray(product.tags) ? product.tags : []),
    categoryName
  ].join(' ').toLowerCase()

  return filter.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))
}

const hasProductNameForSecondaryFilter = (product: ProductSummary, filter: SecondaryFilter): boolean => {
  if (filter.keywords.length === 0) {
    return true
  }

  const productName = product.name.toLowerCase()
  return filter.keywords.some((keyword) => productName.includes(keyword.toLowerCase()))
}

const sortSecondaryFiltersByProductAvailability = (
  filters: SecondaryFilter[],
  products: ProductSummary[]
): SecondaryFilter[] => {
  const [allFilter, ...restFilters] = filters
  if (!allFilter || restFilters.length === 0) {
    return filters
  }

  const sortedRestFilters = restFilters
    .map((filter, index) => ({
      filter,
      index,
      hasProducts: products.some((product) => hasProductNameForSecondaryFilter(product, filter))
    }))
    .sort((left, right) => {
      if (left.hasProducts !== right.hasProducts) {
        return left.hasProducts ? -1 : 1
      }
      return left.index - right.index
    })
    .map((item) => item.filter)

  return [allFilter, ...sortedRestFilters]
}

export default function CategoryPage() {
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'
  const [categories, setCategories] = useState<CategoryViewItem[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [activeFilterId, setActiveFilterId] = useState('all')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [categoryProductAvailability, setCategoryProductAvailability] = useState<CategoryProductAvailability>({})
  const [productsLoading, setProductsLoading] = useState(false)
  const categoriesRequestSeq = useRef(0)
  const productsRequestSeq = useRef(0)
  const userSelectedCategoryRef = useRef(false)
  const productStartingPrices = useProductStartingPrices(products)

  const sortedCategories = useMemo(
    () => sortCategoriesByProductAvailability(categories, categoryProductAvailability),
    [categories, categoryProductAvailability]
  )

  const activeCategory = useMemo(() => {
    return sortedCategories.find((item) => item.id === activeCategoryId) ?? null
  }, [activeCategoryId, sortedCategories])

  const secondaryFilters = useMemo(() => {
    const filters = SECONDARY_FILTERS_BY_CATEGORY[activeCategory?.filterKey ?? activeCategoryId] ?? [{ id: 'all', label: '全部商品', keywords: [] }]
    if (!activeCategory) {
      return filters
    }
    return sortSecondaryFiltersByProductAvailability(filters, products)
  }, [activeCategory, activeCategoryId, products])

  const filteredProducts = useMemo(() => {
    const activeFilter = secondaryFilters.find((item) => item.id === activeFilterId) ?? secondaryFilters[0]
    if (!activeFilter || !activeCategory) {
      return products
    }
    return products.filter((item) => matchesSecondaryFilter(item, activeFilter, activeCategory.name))
  }, [activeCategory, activeFilterId, products, secondaryFilters])

  const applyCategories = useCallback((nextCategories: CategoryViewItem[]) => {
    setCategories((current) => {
      const unchanged =
        current.length === nextCategories.length &&
        current.every((item, index) => {
          const next = nextCategories[index]
          return next &&
            item.id === next.id &&
            item.catalogCategoryId === next.catalogCategoryId &&
            item.name === next.name &&
            item.sort === next.sort &&
            item.enabled === next.enabled &&
            item.iconKey === next.iconKey
        })
      return unchanged ? current : nextCategories
    })
    setActiveCategoryId((prev) => {
      if (prev && nextCategories.some((item) => item.id === prev)) {
        return prev
      }
      return nextCategories[0]?.id ?? ''
    })
  }, [])

  const loadCategoryProductAvailability = useCallback(async (nextCategories: CategoryViewItem[], requestId: number) => {
    if (nextCategories.length === 0) {
      return
    }

    const entries = await Promise.all(
      nextCategories.map(async (category) => {
        try {
          const response = await commerceServices.catalog.listProducts({
            categoryId: category.catalogCategoryId,
            page: 1,
            pageSize: 1
          })
          return [category.id, Number(response.total ?? response.items?.length ?? 0) > 0] as const
        } catch (error) {
          console.warn('load category product availability failed', error)
          return [category.id, false] as const
        }
      })
    )

    if (categoriesRequestSeq.current !== requestId) {
      return
    }

    setCategoryProductAvailability((current) => {
      const next = { ...current }
      for (const [categoryId, hasProducts] of entries) {
        next[categoryId] = hasProducts
      }
      return next
    })
  }, [])

  const loadCategories = useCallback(async (showLoading = true) => {
    const requestId = categoriesRequestSeq.current + 1
    categoriesRequestSeq.current = requestId
    if (showLoading) {
      setCategoriesLoading(true)
    }
    try {
      const [displayResponse, catalogResponse] = await Promise.all([
        commerceServices.catalog.listDisplayCategories(),
        commerceServices.catalog.listCategories()
      ])
      if (categoriesRequestSeq.current === requestId) {
        const nextCategories = toCategoryViewItems(displayResponse.items ?? [], catalogResponse.items ?? [])
        applyCategories(nextCategories)
        void loadCategoryProductAvailability(nextCategories, requestId)
      }
    } catch (error) {
      console.warn('load display categories failed', error)
      try {
        const response = await commerceServices.catalog.listCategories()
        if (categoriesRequestSeq.current === requestId) {
          const catalogItems = response.items ?? []
          const nextCategories = toCategoryViewItems(toDisplayCategoriesFromCatalog(catalogItems), catalogItems)
          applyCategories(nextCategories)
          void loadCategoryProductAvailability(nextCategories, requestId)
        }
      } catch (fallbackError) {
        console.warn('load categories failed', fallbackError)
        if (categoriesRequestSeq.current === requestId) {
          await Taro.showToast({ title: '加载分类失败', icon: 'none' })
        }
      }
    } finally {
      if (categoriesRequestSeq.current === requestId) {
        setCategoriesLoading(false)
      }
    }
  }, [applyCategories, loadCategoryProductAvailability])

  useEffect(() => {
    if (userSelectedCategoryRef.current || sortedCategories.length === 0) {
      return
    }
    const fixedSortFirstCategoryId = sortCategories(categories)[0]?.id ?? ''
    setActiveCategoryId((prev) => {
      if (prev && prev !== fixedSortFirstCategoryId && sortedCategories.some((item) => item.id === prev)) {
        return prev
      }
      return sortedCategories[0]?.id ?? prev
    })
  }, [categories, sortedCategories])

  const loadCategoryProducts = useCallback(async (category: CategoryViewItem | null, keyword: string, showLoading = true) => {
    if (!category) {
      setProducts([])
      return
    }
    const requestId = productsRequestSeq.current + 1
    productsRequestSeq.current = requestId
    if (showLoading) {
      setProductsLoading(true)
    }
    try {
      const response = await commerceServices.catalog.listProducts({
        categoryId: category.catalogCategoryId,
        q: keyword || undefined,
        page: 1,
        pageSize: 40
      })
      if (productsRequestSeq.current === requestId) {
        setProducts(response.items ?? [])
      }
    } catch (error) {
      console.warn('load category products failed', error)
      if (productsRequestSeq.current === requestId) {
        await Taro.showToast({ title: '加载商品失败', icon: 'none' })
      }
    } finally {
      if (productsRequestSeq.current === requestId) {
        setProductsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    setActiveFilterId('all')
  }, [activeCategoryId])

  useEffect(() => {
    void loadCategoryProducts(activeCategory, query)
  }, [activeCategory, loadCategoryProducts, query])

  useDidShow(() => {
    void loadCategories(false)
    void loadCategoryProducts(activeCategory, query, false)
  })

  return (
    <View className='page category-page' style={isH5 ? navbarStyle : undefined}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary' /> : null}

      <View className='page-search'>
        <HomeSearchInput value={query} onInput={setQuery} />
      </View>

      <ScrollView className='category-primary-nav' scrollX>
        <View className='category-primary-nav-inner'>
          {sortedCategories.map((entry, index) => {
            const isActive = entry.id === activeCategoryId
            const iconKey = isCategoryIconKey(String(entry.iconKey || '').toLowerCase())
              ? String(entry.iconKey || '').toLowerCase() as CategoryIconKey
              : resolveCategoryIconKey(entry.name, index)

            return (
              <View
                key={entry.id}
                className={`category-primary-item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  userSelectedCategoryRef.current = true
                  setActiveCategoryId(entry.id)
                }}
              >
                <View className='category-primary-icon'>{renderCategoryIcon(iconKey)}</View>
                <Text className='category-primary-label'>{entry.name}</Text>
                <View className='category-primary-indicator' />
              </View>
            )
          })}

          {!categoriesLoading && sortedCategories.length === 0 ? (
            <View className='category-primary-empty'>暂无分类</View>
          ) : null}
        </View>
      </ScrollView>

      <ScrollView className='category-secondary-nav' scrollX>
        <View className='category-secondary-nav-inner'>
          {secondaryFilters.map((filter) => {
            const isActive = filter.id === activeFilterId
            return (
              <View
                key={filter.id}
                className={`category-secondary-chip ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveFilterId(filter.id)}
              >
                <Text>{filter.label}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <ScrollView className='category-content' scrollY>
        <View className='category-content-scroll-inner'>
          <View className='category-overview'>
            <Text className='category-overview-title'>{activeCategory?.name ?? '分类'}</Text>
            <Text className='category-overview-subtitle'>
              {productsLoading ? '加载中...' : `${filteredProducts.length} ITEMS`}
            </Text>
          </View>

          {productsLoading ? (
            <View className='category-loading'>
              <Text className='category-loading-text'>正在加载商品...</Text>
            </View>
          ) : null}

          {!productsLoading && filteredProducts.length > 0 ? (
            <View className='category-grid'>
              {filteredProducts.map((item) => (
                <View
                  key={item.id}
                  className='category-product-card'
                  onClick={() => navigateTo(goodsDetailRoute(item.id))}
                >
                  <View className='category-product-image-shell'>
                    <SafeImage
                      wrapperClassName='category-product-image-wrapper'
                      className='category-product-image'
                      src={item.coverImageUrl}
                      width='100%'
                      height='100%'
                      mode='aspectFill'
                    />
                  </View>
                  <View className='category-product-body'>
                    <Text className='category-product-title u-safe-title-2'>{item.name}</Text>
                    <Text className='category-product-price'>{productStartingPrices[item.id] ?? '询价'}</Text>
                    <View className='category-product-action'>
                      <Text>查看</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {!productsLoading && filteredProducts.length === 0 ? (
            <View className='category-empty'>
              <Text className='category-empty-title'>暂无商品</Text>
              <Text className='category-empty-subtitle'>试试其他筛选条件或搜索关键词。</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}
