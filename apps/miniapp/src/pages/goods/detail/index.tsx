import { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Button as TaroButton } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tag from '@taroify/core/tag'
import Grid from '@taroify/core/grid'
import Cell from '@taroify/core/cell'
import TaroifyButton from '@taroify/core/button'
import FixedView from '@taroify/core/fixed-view'
import ArrowRight from '@taroify/icons/ArrowRight'
import Logistics from '@taroify/icons/Logistics'
import Star from '@taroify/icons/Star'
import StarOutlined from '@taroify/icons/StarOutlined'
import type { PriceTier, ProductDetail, Sku } from '@tmo/api-client'
import Flex from '../../../components/flex'
import { ROUTES, goodsDetailRoute } from '../../../routes'
import SafeImage from '../../../components/safe-image'
import { getNavbarStyle } from '../../../utils/navbar'
import { matchPriceTier } from '../../../utils/price-tier'
import { ensureLoggedIn, isUnauthorized } from '../../../utils/auth'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'
import placeholderProductImage from '../../../assets/images/placeholder-product.svg'
import { saveSupportComposeIntent } from '../../support/chat/compose-intent'
import './index.scss'

const MIN_PURCHASE_QTY = 1
const MAX_PURCHASE_QTY = 999

export default function ProductDetail() {
  const router = useRouter()
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null)
  const [purchaseQty, setPurchaseQty] = useState(MIN_PURCHASE_QTY)
  const [purchaseQtyInput, setPurchaseQtyInput] = useState(String(MIN_PURCHASE_QTY))
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

  useEffect(() => {
    setPurchaseQtyInput(String(purchaseQty))
  }, [purchaseQty])

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
  const productDescription = detail?.product?.description?.trim() ?? ''
  const displayPrice = useMemo(() => formatStartingPrice(skus), [skus])
  const categoryLabel = useMemo(() => formatCategoryLabel(detail?.product?.categoryId), [detail?.product?.categoryId])
  const productSummary = useMemo(() => {
    if (productDescription) {
      return truncateText(productDescription, 38)
    }
    if (loading) {
      return '正在加载详情...'
    }
    return '适合工程采购与批量交付场景'
  }, [loading, productDescription])
  const selectedSkuLabel = selectedSku?.spec ?? selectedSku?.name ?? ''

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
    setPurchaseQty((prev) => {
      const nextQty = normalizePurchaseQty(prev - 1)
      setPurchaseQtyInput(String(nextQty))
      return nextQty
    })
  }

  const handleIncreasePurchaseQty = () => {
    setPurchaseQty((prev) => {
      const nextQty = normalizePurchaseQty(prev + 1)
      setPurchaseQtyInput(String(nextQty))
      return nextQty
    })
  }

  const handlePurchaseQtyInput = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, String(MAX_PURCHASE_QTY).length)
    setPurchaseQtyInput(digitsOnly)

    if (!digitsOnly) {
      return
    }

    setPurchaseQty(normalizePurchaseQty(Number(digitsOnly)))
  }

  const commitPurchaseQtyInput = () => {
    const nextQty = normalizePurchaseQty(Number(purchaseQtyInput || MIN_PURCHASE_QTY))
    setPurchaseQty(nextQty)
    setPurchaseQtyInput(String(nextQty))
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
    const redirectTo = typeof spuId === 'string' ? goodsDetailRoute(spuId) : undefined
    const allowed = await ensureLoggedIn({ redirect: true, redirectTo })
    if (!allowed) return
    try {
      await saveSupportComposeIntent({
        kind: 'product_inquiry',
        productId: detail.product.id,
        productName: detail.product.name,
        productImageUrl: detail.product.images?.[0] || undefined,
        message: `咨询报价：${detail.product.name}`
      })
      await navigateTo(ROUTES.support)
    } catch (error) {
      console.warn('prepare support inquiry failed', error)
      await Taro.showToast({ title: '打开在线客服失败', icon: 'none' })
    }
  }

  const actionBase = 'flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center'

  return (
    <View className='page page-detail'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.home))} />
        <Navbar.Title>{detail?.product?.name ?? '商品详情'}</Navbar.Title>
      </Navbar>

      <View className='page-content detail-page-content'>
        <View className='detail-hero-card'>
          <View className='detail-hero-frame'>
            <SafeImage
              className='detail-hero-image'
              width='100%'
              height='100%'
              mode='aspectFill'
              src={images[0]}
            />
          </View>
          <Tag size='small' color='default' className='media-counter detail-hero-counter'>
            {images.length} 张
          </Tag>
        </View>

        <View className='product-header detail-surface-card u-shrinkable'>
          <View className='detail-header-top'>
            <View className='detail-header-badges'>
              <Tag size='small' color='primary' className='detail-category-tag'>{categoryLabel}</Tag>
              <Tag size='small' variant='outlined' className='product-meta-tag'>可选规格 {skus.length}</Tag>
            </View>
            <TaroifyButton
              size='mini'
              variant='outlined'
              icon={isFavorite ? <Star className='text-base' /> : <StarOutlined className='text-base' />}
              loading={favoriteLoading}
              onClick={handleToggleFavorite}
              className='product-save-button detail-favorite-button'
            >
              {isFavorite ? '已收藏' : '收藏'}
            </TaroifyButton>
          </View>
          <Text className='product-title detail-product-title u-safe-title-2'>{detail?.product?.name ?? '加载中...'}</Text>
          <Text className='detail-product-summary'>{productSummary}</Text>
          <View className='product-price-row'>
            <View className='product-price'>
              <Text className='product-price-value'>{displayPrice}</Text>
              <Text className='product-price-note'>最低起订单价</Text>
            </View>
            <View className='detail-price-aside'>
              <Text className='detail-price-aside-label'>当前选择</Text>
              <Text className='detail-price-aside-value'>{selectedSkuLabel || (skus.length > 1 ? '请选择规格' : '默认规格')}</Text>
            </View>
          </View>
          <Text className='product-meta-text'>{loading ? '正在加载详情...' : '含税单价，最终价格以所选规格和采购量为准'}</Text>
        </View>

        <View className='product-section detail-surface-card detail-tier-section'>
          <View className='detail-section-header'>
            <Text className='product-section-title'>阶梯单价</Text>
            <Text className='product-section-link'>采购量越高单价越低</Text>
          </View>
          <Grid columns={3} gutter={10} className='product-tier-grid'>
            {renderPriceTiers(selectedSku?.priceTiers, purchaseQty)}
          </Grid>
        </View>

        <View className='product-section detail-surface-card'>
          <Text className='product-section-title'>SKU 选项</Text>
          <Flex wrap='wrap' gutter={8} className='detail-sku-list'>
            {skus.map((sku) => (
              <TaroifyButton
                key={sku.id}
                className={`product-sku-button ${selectedSku?.id === sku.id ? 'product-sku-button--selected' : ''}`}
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

        <View className='product-section detail-surface-card'>
          <View className='detail-section-header'>
            <Text className='product-section-title'>购买数量</Text>
            <Text className='product-qty-hint'>可加入 {MIN_PURCHASE_QTY}-{MAX_PURCHASE_QTY}</Text>
          </View>
          <View className='product-qty-picker'>
            <TaroButton
              className={`product-qty-button ${
                purchaseQty <= MIN_PURCHASE_QTY ? 'product-qty-button--disabled' : ''
              }`}
              hoverClass='none'
              onClick={handleDecreasePurchaseQty}
              disabled={purchaseQty <= MIN_PURCHASE_QTY}
            >
              <Text className='product-qty-button-icon'>-</Text>
            </TaroButton>
            <Input
              className='product-qty-value'
              type='number'
              value={purchaseQtyInput}
              onInput={(event) => handlePurchaseQtyInput(event.detail.value)}
              onBlur={commitPurchaseQtyInput}
            />
            <TaroButton
              className={`product-qty-button ${
                purchaseQty >= MAX_PURCHASE_QTY ? 'product-qty-button--disabled' : ''
              }`}
              hoverClass='none'
              onClick={handleIncreasePurchaseQty}
              disabled={purchaseQty >= MAX_PURCHASE_QTY}
            >
              <Text className='product-qty-button-icon'>+</Text>
            </TaroButton>
          </View>
        </View>

        <Cell
          className='product-logistics detail-surface-card detail-logistics-card'
          icon={<Logistics />}
          title='标准配送'
          brief='预计 9月12日 - 9月18日送达（工作日）'
          rightIcon={<ArrowRight />}
        />
      </View>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <View className='action-bar detail-action-bar'>
          <TaroButton
            className='detail-light-action'
            hoverClass='none'
            onClick={handleToggleFavorite}
          >
            {isFavorite ? <Star className='detail-light-action-icon' /> : <StarOutlined className='detail-light-action-icon' />}
            <Text className='detail-light-action-label'>{isFavorite ? '已收藏' : '收藏'}</Text>
          </TaroButton>
          <View className='detail-footer-actions'>
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
          </View>
        </View>
      </FixedView>
    </View>
  )
}

const formatCategoryLabel = (categoryId?: string | null) => {
  const raw = typeof categoryId === 'string' ? categoryId.trim() : ''
  if (!raw) {
    return '工业商品'
  }

  return raw
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => {
      if (segment.length <= 2) {
        return segment.toUpperCase()
      }
      return `${segment[0].toUpperCase()}${segment.slice(1)}`
    })
    .join(' / ')
}

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength).trimEnd()}...`
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

const formatStartingPrice = (skus: Sku[]) => {
  const minPriceFen = skus.reduce<number | null>((currentMin, sku) => {
    if (!Array.isArray(sku.priceTiers) || sku.priceTiers.length === 0) {
      return currentMin
    }

    const skuMin = sku.priceTiers.reduce<number | null>((tierMin, tier) => {
      if (!Number.isFinite(tier.unitPriceFen)) {
        return tierMin
      }
      if (tierMin === null) {
        return tier.unitPriceFen
      }
      return Math.min(tierMin, tier.unitPriceFen)
    }, null)

    if (skuMin === null) {
      return currentMin
    }
    if (currentMin === null) {
      return skuMin
    }
    return Math.min(currentMin, skuMin)
  }, null)

  if (minPriceFen === null) {
    return '询价'
  }

  return `${formatFen(minPriceFen)} 起`
}

const renderPriceTiers = (tiers: PriceTier[] | undefined, qty: number) => {
  if (!tiers || tiers.length === 0) {
    return (
      <Grid.Item>
        <View className='tier-card'>
          <Text className='tier-card-range u-safe-title-2'>暂无阶梯价</Text>
          <Text className='tier-card-price'>联系销售</Text>
        </View>
      </Grid.Item>
    )
  }
  const visibleTiers = tiers.slice(0, 3)
  const matchedTier = matchPriceTier(visibleTiers, qty)
  const matchedTierIndex = matchedTier ? visibleTiers.findIndex((tier) => tier === matchedTier) : -1

  return visibleTiers.map((tier, index) => (
    <Grid.Item key={`${tier.minQty}-${tier.maxQty ?? 'max'}`}>
      <View className={`tier-card ${matchedTierIndex === index ? 'tier-card-highlight' : ''}`}>
        <Text className='tier-card-range u-safe-title-2'>{formatPriceTierRange(tier)}</Text>
        <Text className='tier-card-price'>{formatFen(tier.unitPriceFen)}</Text>
      </View>
    </Grid.Item>
  ))
}
