import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { View, Text, Swiper, SwiperItem } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import type { Category, DisplayCategory, ProductSummary } from '@tmo/api-client'
import Flex from '../../components/flex'
import SafeImage from '../../components/safe-image'
import HomeSearchInput from '../../components/home-search-input'
import { useProductStartingPrices } from '../../hooks/use-product-starting-prices'
import { ROUTES, goodsDetailRoute, withQuery } from '../../routes'
import { type CategoryIconKey, renderCategoryIcon, resolveCategoryIconKey } from '../../utils/category-icons'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { commerceServices } from '../../services/commerce'
import { getNavbarStyle } from '../../utils/navbar'
import { getWindowSystemInfo } from '../../utils/system-info'
import './index.scss'

type QuickCategoryItem = {
  id: string
  name: string
  iconKey: CategoryIconKey
  isPlaceholder: boolean
  targetRoute?: string
}

type ShowcaseItem = {
  key: string
  eyebrow: string
  title: string
  copy: string
  actionLabel: string
  tone: 'catalog' | 'demand' | 'import'
  onClick: () => void
}

const QUICK_CATEGORY_CAPACITY = 8
const QUICK_CATEGORY_PLACEHOLDER_NAME = '敬请期待'
const HOME_PRODUCT_GRID_GAP_PX = 12
const HOME_PRODUCT_SECTION_PADDING_PX = 16
const HOME_SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    key: 'catalog',
    eyebrow: 'V1 主链路',
    title: '目录采购更快开始',
    copy: '从分类找货到提交意向订单，先把客户最常走的采购路径做顺。',
    actionLabel: '去找商品',
    tone: 'catalog',
    onClick: () => void switchTabLike(ROUTES.category)
  },
  {
    key: 'demand',
    eyebrow: '找不到也能继续',
    title: '缺货或规格不清就提需求',
    copy: '客户不用离开小程序，直接把名称、规格和数量交给寻源团队跟进。',
    actionLabel: '发布需求',
    tone: 'demand',
    onClick: () => void navigateTo(ROUTES.demandCreate)
  },
  {
    key: 'import',
    eyebrow: '工业采购效率入口',
    title: 'Excel 一次导入整单',
    copy: '适合一口气采购几十个物料，能自动识别的直接加购，其他项再确认。',
    actionLabel: '批量导入',
    tone: 'import',
    onClick: () => void navigateTo(ROUTES.import)
  }
]

const isCategoryIconKey = (value: string): value is CategoryIconKey => {
  return ['notes', 'setting', 'desktop', 'shield', 'brush', 'hot', 'apps'].includes(value)
}

const resolveQuickCategoryIconKey = (iconKey: string | undefined, name: string, index: number): CategoryIconKey => {
  const normalized = String(iconKey || '').trim().toLowerCase()
  if (isCategoryIconKey(normalized)) {
    return normalized
  }
  return resolveCategoryIconKey(name, index)
}

const sortDisplayCategories = (items: DisplayCategory[]) => {
  return [...items].sort((left, right) => {
    const leftSort = typeof left.sort === 'number' ? left.sort : Number.MAX_SAFE_INTEGER
    const rightSort = typeof right.sort === 'number' ? right.sort : Number.MAX_SAFE_INTEGER
    return leftSort - rightSort
  })
}

const toDisplayCategoriesFromCatalog = (categories: Category[]): DisplayCategory[] => {
  return categories.map((item, index) => ({
    id: String(item.id),
    name: item.name,
    iconKey: resolveCategoryIconKey(item.name, index),
    sort: typeof item.sort === 'number' ? item.sort : index + 1,
    enabled: true
  }))
}

const buildQuickCategories = (categories: DisplayCategory[]): QuickCategoryItem[] => {
  const enabledItems = sortDisplayCategories(categories)
    .filter((item) => item.enabled !== false && Boolean(item.id) && Boolean(item.name))
    .map((item, index) => ({
      id: String(item.id),
      name: item.name,
      iconKey: resolveQuickCategoryIconKey(item.iconKey, item.name, index),
      isPlaceholder: false,
      targetRoute: ROUTES.category
    }))
    .slice(0, QUICK_CATEGORY_CAPACITY)

  const placeholders = Array.from({ length: Math.max(0, QUICK_CATEGORY_CAPACITY - enabledItems.length) }, (_, index) => ({
    id: `quick-category-placeholder-${index + 1}`,
    name: QUICK_CATEGORY_PLACEHOLDER_NAME,
    iconKey: 'apps' as CategoryIconKey,
    isPlaceholder: true
  }))

  return [...enabledItems, ...placeholders]
}

const getHomeProductImageSize = () => {
  const systemInfo = getWindowSystemInfo()
  const windowWidth = typeof systemInfo.windowWidth === 'number' ? systemInfo.windowWidth : 375
  return Math.max(120, Math.floor((windowWidth - HOME_PRODUCT_SECTION_PADDING_PX * 2 - HOME_PRODUCT_GRID_GAP_PX) / 2))
}

export default function ProductCatalogApp() {
  const [categories, setCategories] = useState<DisplayCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const isH5 = process.env.TARO_ENV === 'h5'
  const navbarStyle = getNavbarStyle()
  const quickCategories = useMemo(() => buildQuickCategories(categories), [categories])
  const productStartingPrices = useProductStartingPrices(products)
  const homeProductImageSize = useMemo(() => getHomeProductImageSize(), [])
  const trimmedSearchQuery = searchQuery.trim()
  const showEmptyDemandHint = !productsLoading && trimmedSearchQuery.length > 0 && products.length === 0

  const handleQuickCategoryTap = useCallback((item: QuickCategoryItem) => {
    if (item.isPlaceholder || !item.targetRoute) {
      return
    }
    void switchTabLike(item.targetRoute)
  }, [])
  const pageStyle = (isH5 ? navbarStyle : undefined) as CSSProperties | undefined

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setCategoriesLoading(true)
      try {
        const data = await commerceServices.catalog.listDisplayCategories()
        if (!cancelled) {
          setCategories(data.items ?? [])
        }
      } catch (error) {
        console.warn('load display categories failed, fallback catalog categories', error)
        try {
          const data = await commerceServices.catalog.listCategories()
          if (!cancelled) {
            setCategories(toDisplayCategoriesFromCatalog(data.items ?? []))
          }
        } catch (fallbackError) {
          console.warn('load categories failed', fallbackError)
          await Taro.showToast({ title: '加载分类失败', icon: 'none' })
        }
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
    let cancelled = false
    setProductsLoading(true)
    const handle = setTimeout(() => {
      void (async () => {
        if (!cancelled) {
          setProductsLoading(true)
        }
        try {
          const response = await commerceServices.catalog.listProducts({
            q: searchQuery || undefined,
            page: 1,
            pageSize: 20
          })
          if (!cancelled) {
            setProducts(response.items ?? [])
          }
        } catch (error) {
          console.warn('load products failed', error)
          if (!cancelled) {
            await Taro.showToast({ title: '加载商品失败', icon: 'none' })
          }
        } finally {
          if (!cancelled) {
            setProductsLoading(false)
          }
        }
      })()
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [searchQuery])

  return (
    <View className='page page-home' style={pageStyle}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary' /> : null}

      <View className='page-search'>
        <HomeSearchInput value={searchQuery} onInput={setSearchQuery} />
      </View>

      <HomeShowcase />

      <HomeCategoryQuickGrid
        items={quickCategories}
        loading={categoriesLoading}
        onTap={handleQuickCategoryTap}
      />

      <View className='page-content home-product-section'>
        <View className='home-product-toolbar'>
          <Text className='home-product-title'>推荐商品</Text>
        </View>

        {showEmptyDemandHint ? (
          <Text className='home-empty-demand-tip'>
            未找到“{trimmedSearchQuery}”？
            <Text
              className='home-empty-demand-action'
              onClick={() => navigateTo(withQuery(ROUTES.demandCreate, { kw: trimmedSearchQuery }))}
            >
              点击发布需求
            </Text>
          </Text>
        ) : null}

        <View className='home-product-matrix' data-testid='home-product-matrix'>
          {products.map((product) => (
            <View key={product.id} className='home-product-cell'>
              <ProductCard
                data={product}
                priceLabel={productStartingPrices[product.id] ?? '询价'}
                imageSize={homeProductImageSize}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

type HomeCategoryQuickGridProps = {
  items: QuickCategoryItem[]
  loading: boolean
  onTap: (item: QuickCategoryItem) => void
}

function HomeCategoryQuickGrid({ items, loading, onTap }: HomeCategoryQuickGridProps) {
  if (loading) {
    return (
      <View className='home-category-panel' data-testid='home-category-panel'>
        <View className='home-category-grid'>
          {Array.from({ length: QUICK_CATEGORY_CAPACITY }).map((_, index) => (
            <View key={`home-category-skeleton-${index}`} className='home-category-item is-skeleton' data-testid='home-category-item'>
              <View className='home-category-icon home-category-icon--skeleton' />
              <View className='home-category-label home-category-label--skeleton' />
            </View>
          ))}
        </View>
      </View>
    )
  }

  return (
    <View className='home-category-panel' data-testid='home-category-panel'>
      <View className='home-category-grid'>
        {items.map((item) => {
          const className = `home-category-item ${item.isPlaceholder ? 'is-placeholder' : ''}`
          return (
            <View
              key={item.id}
              className={className}
              role={item.isPlaceholder ? undefined : 'button'}
              onClick={item.isPlaceholder ? undefined : () => onTap(item)}
              data-testid='home-category-item'
            >
              <View className='home-category-icon'>
                {renderCategoryIcon(item.iconKey)}
              </View>
              <Text className='home-category-label'>{item.name}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function HomeShowcase() {
  const [activePage, setActivePage] = useState(0)

  return (
    <View className='home-showcase'>
      <Swiper
        className='home-showcase-swiper'
        current={activePage}
        circular
        autoplay
        interval={4500}
        duration={480}
        onChange={(event) => setActivePage(event.detail.current)}
      >
        {HOME_SHOWCASE_ITEMS.map((item) => (
          <SwiperItem key={item.key}>
            <View className={`home-showcase-card home-showcase-card--${item.tone}`} data-testid='home-showcase-card'>
              <View className='home-showcase-decoration' />
              <View className={`home-showcase-body ${item.key === 'demand' ? 'home-showcase-body--demand' : ''}`.trim()}>
                <Text className='home-showcase-eyebrow'>{item.eyebrow}</Text>
                <Text className={`home-showcase-title ${item.key === 'demand' ? 'home-showcase-title--demand' : ''}`.trim()}>
                  {item.title}
                </Text>
                <Text className='home-showcase-copy'>{item.copy}</Text>
              </View>
              <View className='home-showcase-footer'>
                <View className='home-showcase-action' role='button' onClick={item.onClick}>
                  <Text>{item.actionLabel}</Text>
                </View>
                <View className='home-showcase-dots' data-testid='home-showcase-dots'>
                  {HOME_SHOWCASE_ITEMS.map((dotItem, index) => (
                    <View
                      key={dotItem.key}
                      className={`home-showcase-dot ${index === activePage ? 'is-active' : ''}`}
                    />
                  ))}
                </View>
              </View>
            </View>
          </SwiperItem>
        ))}
      </Swiper>
    </View>
  )
}

function ProductCard({ data, priceLabel, imageSize }: { data: ProductSummary; priceLabel: string; imageSize: number }) {
  const tagLabel = data.tags?.[0] ?? '分类'
  return (
    <View className='product-card product-card--home' onClick={() => navigateTo(goodsDetailRoute(data.id))}>
      <View className='product-card-image-shell' style={{ height: `${imageSize}px` }}>
        <SafeImage
          wrapperClassName='product-card-image-wrapper'
          className='product-card-image'
          src={data.coverImageUrl}
          width='100%'
          height='100%'
          mode='aspectFill'
        />
      </View>
      <View className='product-card-body'>
        <Text className='product-card-title u-safe-title-2'>{data.name}</Text>
        <Text className='product-card-price'>{priceLabel}</Text>
        <Flex justify='space-between' align='center' className='product-card-footer'>
          <View className='product-card-tag'>
            <Text>{tagLabel}</Text>
          </View>
        </Flex>
      </View>
    </View>
  )
}
