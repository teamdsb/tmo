import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tag from '@taroify/core/tag'
import Grid from '@taroify/core/grid'
import Cell from '@taroify/core/cell'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import FixedView from '@taroify/core/fixed-view'
import ArrowRight from '@taroify/icons/ArrowRight'
import Logistics from '@taroify/icons/Logistics'
import Star from '@taroify/icons/Star'
import StarOutlined from '@taroify/icons/StarOutlined'
import type { PriceTier, ProductDetail, Sku } from '@tmo/api-client'
import { ROUTES, goodsDetailRoute } from '../../../routes'
import SafeImage from '../../../components/safe-image'
import { getNavbarStyle } from '../../../utils/navbar'
import { ensureLoggedIn, isUnauthorized } from '../../../utils/auth'
import { switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import placeholderProductImage from '../../../assets/images/placeholder-product.svg'

export default function ProductDetail() {
  const router = useRouter()
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const [favoriteSkuIds, setFavoriteSkuIds] = useState<string[]>([])
  const [favoriteLoading, setFavoriteLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()

  const spuId = router.params?.id

  useEffect(() => {
    if (!spuId || typeof spuId !== 'string') {
      return
    }
    void (async () => {
      setLoading(true)
      try {
        const response = await commerceServices.catalog.getProductDetail(spuId)
        setDetail(response)
        if (response.skus?.length) {
          setSelectedSkuId(response.skus[0].id)
        }
      } catch (error) {
        console.warn('load product detail failed', error)
        await Taro.showToast({ title: '加载商品失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [spuId])

  useEffect(() => {
    void (async () => {
      try {
        const list = await commerceServices.wishlist.list()
        setFavoriteSkuIds(list.map((item) => item.sku.id))
      } catch (error) {
        if (!isUnauthorized(error)) {
          console.warn('load wishlist failed', error)
        }
      }
    })()
  }, [])

  const images = useMemo(() => {
    if (!detail?.product?.images || detail.product.images.length === 0) {
      return [placeholderProductImage]
    }
    return detail.product.images
  }, [detail])

  const skus = detail?.skus ?? []
  const selectedSku = skus.find((sku) => sku.id === selectedSkuId) ?? skus[0]
  const favoriteIdSet = useMemo(() => new Set(favoriteSkuIds), [favoriteSkuIds])
  const isFavorite = selectedSku ? favoriteIdSet.has(selectedSku.id) : false

  const handleToggleFavorite = async () => {
    if (!selectedSku) {
      await Taro.showToast({ title: '请先选择 SKU', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    setFavoriteLoading(true)
    try {
      if (isFavorite) {
        await commerceServices.wishlist.remove(selectedSku.id)
        setFavoriteSkuIds((prev) => prev.filter((id) => id !== selectedSku.id))
        await Taro.showToast({ title: '已取消收藏', icon: 'none' })
      } else {
        await commerceServices.wishlist.add(selectedSku.id)
        setFavoriteSkuIds((prev) => [...prev, selectedSku.id])
        await Taro.showToast({ title: '已收藏', icon: 'success' })
      }
    } catch (error) {
      console.warn('toggle favorite failed', error)
      await Taro.showToast({ title: '更新失败', icon: 'none' })
    } finally {
      setFavoriteLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!selectedSku) {
      await Taro.showToast({ title: '请先选择 SKU', icon: 'none' })
      return
    }
    const redirectTo = typeof spuId === 'string' ? goodsDetailRoute(spuId) : undefined
    const allowed = await ensureLoggedIn({ redirect: true, redirectTo })
    if (!allowed) return
    try {
      await commerceServices.cart.addItem(selectedSku.id, 1)
      await Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      console.warn('add to cart failed', error)
      await Taro.showToast({ title: '加入失败', icon: 'none' })
    }
  }

  const handleInquiry = async () => {
    if (!selectedSku || !detail?.product) {
      return
    }
    try {
      await commerceServices.inquiries.create({
        skuId: selectedSku.id,
        message: `咨询报价：${detail.product.name}`
      })
      await Taro.showToast({ title: '已发送询价', icon: 'success' })
    } catch (error) {
      console.warn('create inquiry failed', error)
      await Taro.showToast({ title: '发送询价失败', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.home))} />
        <Navbar.Title>{detail?.product?.name ?? '商品详情'}</Navbar.Title>
      </Navbar>

      <View className='page-content'>
        <View className='media'>
          <SafeImage
            width='100%'
            height={168}
            mode='aspectFill'
            src={images[0]}
          />
          <Tag size='small' color='default' className='media-counter'>
            {images.length} 张图片
          </Tag>
        </View>

        <View className='product-header'>
          <Text className='product-title'>{detail?.product?.name ?? '加载中...'}</Text>
          <View className='product-price-row'>
            <View className='product-price'>
              <Text className='product-price-value'>
                {selectedSku ? formatSkuPrice(selectedSku) : '询价'}
              </Text>
              <Text className='product-price-note'>每件</Text>
            </View>
            <View className='product-price-actions'>
              <Button
                size='mini'
                variant='outlined'
                icon={isFavorite ? <Star className='text-base' /> : <StarOutlined className='text-base' />}
                loading={favoriteLoading}
                onClick={handleToggleFavorite}
                className='product-save-button'
              />
            </View>
          </View>

          <Flex align='center' gutter={8} className='product-meta'>
            <Tag size='small' variant='outlined'>SKU 数量：{skus.length}</Tag>
            <Text className='product-meta-text'>{loading ? '正在加载详情...' : '实时价格'}</Text>
          </Flex>
        </View>

        <View className='product-section'>
          <Flex justify='space-between' align='center'>
            <Text className='section-title'>阶梯价格</Text>
            <Text className='section-link'>批量优惠</Text>
          </Flex>

          <Grid columns={3} gutter={8}>
            {renderPriceTiers(selectedSku?.priceTiers)}
          </Grid>
        </View>

        <View className='product-section'>
          <Text className='section-title'>SKU 选项</Text>
          <Flex wrap='wrap' gutter={8}>
            {skus.map((sku) => (
              <Button
                key={sku.id}
                size='small'
                color={selectedSku?.id === sku.id ? 'primary' : 'default'}
                variant={selectedSku?.id === sku.id ? 'contained' : 'outlined'}
                onClick={() => setSelectedSkuId(sku.id)}
              >
                {sku.spec ?? sku.name}
              </Button>
            ))}
          </Flex>
        </View>

        {selectedSku?.attributes ? (
          <View className='product-section'>
            <Text className='section-title'>属性</Text>
            <Flex wrap='wrap' gutter={8}>
              {Object.entries(selectedSku.attributes).map(([key, value]) => (
                <Tag key={key} size='small' variant='outlined'>
                  {key}: {String(value)}
                </Tag>
              ))}
            </Flex>
          </View>
        ) : null}

        <Cell
          icon={<Logistics />}
          title='标准空运'
          brief='预计 9月12日 - 9月18日送达'
          rightIcon={<ArrowRight />}
        />
      </View>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex gutter={12} className='action-bar'>
          <Button block variant='outlined' onClick={handleInquiry}>议价</Button>
          <Button block color='primary' onClick={handleAddToCart}>加入购物车</Button>
        </Flex>
      </FixedView>
    </View>
  )
}

const formatPriceTierRange = (tier: PriceTier) => {
  if (tier.maxQty === null || tier.maxQty === undefined) {
    return `${tier.minQty}+`
  }
  return `${tier.minQty}-${tier.maxQty}`
}

const formatFen = (fen: number) => {
  return `¥${(fen / 100).toFixed(2)}`
}

const formatSkuPrice = (sku: Sku) => {
  const tier = sku.priceTiers?.[0]
  if (!tier) {
    return '询价'
  }
  return formatFen(tier.unitPriceFen)
}

const renderPriceTiers = (tiers?: PriceTier[]) => {
  if (!tiers || tiers.length === 0) {
    return (
      <Grid.Item>
        <View className='tier-card'>
          <Text className='tier-card-range'>暂无阶梯价</Text>
          <Text className='tier-card-price'>联系销售</Text>
        </View>
      </Grid.Item>
    )
  }
  return tiers.slice(0, 3).map((tier) => (
    <Grid.Item key={`${tier.minQty}-${tier.maxQty ?? 'max'}`}>
      <View className='tier-card'>
        <Text className='tier-card-range'>{formatPriceTierRange(tier)}</Text>
        <Text className='tier-card-price'>{formatFen(tier.unitPriceFen)}</Text>
      </View>
    </Grid.Item>
  ))
}
