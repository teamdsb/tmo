import { useEffect, useMemo, useState } from 'react'
import { View, Text, Button as TaroButton } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tag from '@taroify/core/tag'
import Grid from '@taroify/core/grid'
import Cell from '@taroify/core/cell'
import TaroifyButton from '@taroify/core/button'
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

const MIN_PURCHASE_QTY = 1
const MAX_PURCHASE_QTY = 999

export default function ProductDetail() {
  const router = useRouter()
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const [purchaseQty, setPurchaseQty] = useState(MIN_PURCHASE_QTY)
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
        if (response.skus?.length === 1) {
          setSelectedSkuId(response.skus[0].id)
          return
        }
        setSelectedSkuId(null)
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
  const selectedSku = skus.find((sku) => sku.id === selectedSkuId) ?? null
  const favoriteIdSet = useMemo(() => new Set(favoriteSkuIds), [favoriteSkuIds])
  const isFavorite = selectedSku ? favoriteIdSet.has(selectedSku.id) : false

  const normalizePurchaseQty = (value: number): number => {
    if (!Number.isFinite(value)) {
      return MIN_PURCHASE_QTY
    }
    const safeValue = Math.floor(value)
    if (safeValue < MIN_PURCHASE_QTY) {
      return MIN_PURCHASE_QTY
    }
    if (safeValue > MAX_PURCHASE_QTY) {
      return MAX_PURCHASE_QTY
    }
    return safeValue
  }

  const handleDecreasePurchaseQty = () => {
    setPurchaseQty((prev) => normalizePurchaseQty(prev - 1))
  }

  const handleIncreasePurchaseQty = () => {
    setPurchaseQty((prev) => normalizePurchaseQty(prev + 1))
  }

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
      const cart = await commerceServices.cart.addItem(selectedSku.id, purchaseQty)
      const count = Array.isArray(cart.items)
        ? cart.items.reduce((total, item) => total + item.qty, 0)
        : 0
      await Taro.showToast({ title: count > 0 ? `已加入购物车（${purchaseQty}）` : '已加入购物车', icon: 'success' })
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

  const actionBase = 'flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center'

  return (
    <View className='page page-detail'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.home))} />
        <Navbar.Title>{detail?.product?.name ?? '商品详情'}</Navbar.Title>
      </Navbar>

      <View className='page-content'>
        <View className='media'>
          <SafeImage
            width='100%'
            height={208}
            mode='aspectFill'
            src={images[0]}
          />
          <Tag size='small' color='default' className='media-counter'>
            {images.length} 张
          </Tag>
        </View>

        <View className='product-header'>
          <Text className='product-title'>{detail?.product?.name ?? '加载中...'}</Text>
          <View className='product-price-row'>
            <View className='product-price'>
              <Text className='product-price-value'>
                {selectedSku ? formatSkuPrice(selectedSku) : '请选择规格'}
              </Text>
              <Text className='product-price-note'>单件参考价</Text>
            </View>
            <View className='product-price-actions'>
              <TaroifyButton
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
            <Tag size='small' variant='outlined' className='product-meta-tag'>可选规格 {skus.length}</Tag>
            <Text className='product-meta-text'>{loading ? '正在加载详情...' : '含税单价'}</Text>
          </Flex>
        </View>

        <View className='product-section'>
          <Flex justify='space-between' align='center'>
            <Text className='product-section-title'>阶梯单价</Text>
            <Text className='product-section-link'>采购量越高单价越低</Text>
          </Flex>

          <Grid columns={3} gutter={10} className='product-tier-grid'>
            {renderPriceTiers(selectedSku?.priceTiers, purchaseQty)}
          </Grid>
        </View>

        <View className='product-section'>
          <Text className='product-section-title'>SKU 选项</Text>
          <Flex wrap='wrap' gutter={8}>
            {skus.map((sku) => (
              <TaroifyButton
                key={sku.id}
                className='product-sku-button'
                size='small'
                color={selectedSku?.id === sku.id ? 'primary' : 'default'}
                variant={selectedSku?.id === sku.id ? 'contained' : 'outlined'}
                onClick={() => setSelectedSkuId(sku.id)}
              >
                {sku.spec ?? sku.name}
              </TaroifyButton>
            ))}
          </Flex>
          {!selectedSku && skus.length > 1 ? (
            <Text className='product-sku-hint'>请选择规格后再加入购物车</Text>
          ) : null}
        </View>

        <View className='product-section'>
          <Flex justify='space-between' align='center'>
            <Text className='product-section-title'>购买数量</Text>
            <Text className='product-qty-hint'>可加入 {MIN_PURCHASE_QTY}-{MAX_PURCHASE_QTY}</Text>
          </Flex>
          <View className='product-qty-picker'>
            <TaroButton
              className='product-qty-button'
              hoverClass='none'
              onClick={handleDecreasePurchaseQty}
              disabled={purchaseQty <= MIN_PURCHASE_QTY}
            >
              -
            </TaroButton>
            <Text className='product-qty-value'>{purchaseQty}</Text>
            <TaroButton
              className='product-qty-button'
              hoverClass='none'
              onClick={handleIncreasePurchaseQty}
              disabled={purchaseQty >= MAX_PURCHASE_QTY}
            >
              +
            </TaroButton>
          </View>
        </View>

        {selectedSku?.attributes ? (
          <View className='product-section'>
            <Text className='product-section-title'>属性</Text>
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
          className='product-logistics'
          icon={<Logistics />}
          title='标准配送'
          brief='预计 9月12日 - 9月18日送达（工作日）'
          rightIcon={<ArrowRight />}
        />
      </View>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex className='action-bar detail-action-bar'>
          <TaroButton
            className={`${actionBase} detail-action-button cart-action-secondary`}
            hoverClass='none'
            onClick={handleInquiry}
          >
            议价
          </TaroButton>
          <TaroButton
            className={`${actionBase} detail-action-button cart-action-primary`}
            hoverClass='none'
            onClick={handleAddToCart}
          >
            加入购物车
          </TaroButton>
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

const isMatchedTier = (tier: PriceTier, qty: number) => {
  if (!Number.isFinite(qty)) {
    return false
  }
  const safeQty = Math.floor(qty)
  if (safeQty < tier.minQty) {
    return false
  }
  if (tier.maxQty === null || tier.maxQty === undefined) {
    return true
  }
  return safeQty <= tier.maxQty
}

const renderPriceTiers = (tiers: PriceTier[] | undefined, qty: number) => {
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
  const visibleTiers = tiers.slice(0, 3)
  const matchedTierIndex = visibleTiers.findIndex((tier) => isMatchedTier(tier, qty))

  return visibleTiers.map((tier, index) => (
    <Grid.Item key={`${tier.minQty}-${tier.maxQty ?? 'max'}`}>
      <View className={`tier-card ${matchedTierIndex === index ? 'tier-card-highlight' : ''}`}>
        <Text className='tier-card-range'>{formatPriceTierRange(tier)}</Text>
        <Text className='tier-card-price'>{formatFen(tier.unitPriceFen)}</Text>
      </View>
    </Grid.Item>
  ))
}
