import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Image from '@taroify/core/image'
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
import AppTabbar from '../../../components/app-tabbar'
import { goodsDetailRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { ensureLoggedIn, isUnauthorized } from '../../../utils/auth'
import { commerceServices } from '../../../services/commerce'

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
        await Taro.showToast({ title: 'Failed to load product', icon: 'none' })
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
      return [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCspf7tkk3Cwf2GD5lYQaNodcqBkcYqB_ZBv1e2fVDNw0YMOKkHumvzpQ1mZEKdercQH0hJKeoDWuFaFd0qoHzNg0huzTlzC5-zZ7kBXvWE9Ib08FjC_NddG0UAEIhtDzvhKWIoHFuCHwDIbw0VxEiTfUHw5E2lSdd55A_492g3TzsAwCF8m_qM_vrA2FUIFmA556OMpdd6XsGANJE4w1E8t6cLo6tKrJi7WMOnV3ErcUQcrzM2zDWv12Q92-EVBL6NJcTileQoBmGI'
      ]
    }
    return detail.product.images
  }, [detail])

  const skus = detail?.skus ?? []
  const selectedSku = skus.find((sku) => sku.id === selectedSkuId) ?? skus[0]
  const favoriteIdSet = useMemo(() => new Set(favoriteSkuIds), [favoriteSkuIds])
  const isFavorite = selectedSku ? favoriteIdSet.has(selectedSku.id) : false

  const handleToggleFavorite = async () => {
    if (!selectedSku) {
      await Taro.showToast({ title: 'Select a SKU first', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    setFavoriteLoading(true)
    try {
      if (isFavorite) {
        await commerceServices.wishlist.remove(selectedSku.id)
        setFavoriteSkuIds((prev) => prev.filter((id) => id !== selectedSku.id))
        await Taro.showToast({ title: 'Removed from favorites', icon: 'none' })
      } else {
        await commerceServices.wishlist.add(selectedSku.id)
        setFavoriteSkuIds((prev) => [...prev, selectedSku.id])
        await Taro.showToast({ title: 'Saved to favorites', icon: 'success' })
      }
    } catch (error) {
      console.warn('toggle favorite failed', error)
      await Taro.showToast({ title: 'Update failed', icon: 'none' })
    } finally {
      setFavoriteLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!selectedSku) {
      await Taro.showToast({ title: 'Select a SKU first', icon: 'none' })
      return
    }
    const redirectTo = typeof spuId === 'string' ? goodsDetailRoute(spuId) : undefined
    const allowed = await ensureLoggedIn({ redirect: true, redirectTo })
    if (!allowed) return
    try {
      await commerceServices.cart.addItem(selectedSku.id, 1)
      await Taro.showToast({ title: 'Added to cart', icon: 'success' })
    } catch (error) {
      console.warn('add to cart failed', error)
      await Taro.showToast({ title: 'Failed to add item', icon: 'none' })
    }
  }

  const handleInquiry = async () => {
    if (!selectedSku || !detail?.product) {
      return
    }
    try {
      await commerceServices.inquiries.create({
        skuId: selectedSku.id,
        message: `Request quote for ${detail.product.name}`
      })
      await Taro.showToast({ title: 'Inquiry sent', icon: 'success' })
    } catch (error) {
      console.warn('create inquiry failed', error)
      await Taro.showToast({ title: 'Failed to send inquiry', icon: 'none' })
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>

      <View className='page-content'>
        <View className='media'>
          <Image
            width='100%'
            height={200}
            mode='aspectFill'
            src={images[0]}
          />
          <Tag size='small' color='default' className='media-counter'>
            {images.length} photos
          </Tag>
        </View>

        <View className='product-header'>
          <Flex justify='space-between' align='start'>
            <Text className='product-title'>{detail?.product?.name ?? 'Loading...'}</Text>
            <View className='product-price'>
              <Text className='product-price-value'>
                {selectedSku ? formatSkuPrice(selectedSku) : 'Request quote'}
              </Text>
              <Text className='product-price-note'>Per Unit</Text>
              <Button
                size='small'
                variant='outlined'
                icon={isFavorite ? <Star className='text-base' /> : <StarOutlined className='text-base' />}
                loading={favoriteLoading}
                onClick={handleToggleFavorite}
                className='mt-2'
              >
                {isFavorite ? 'Saved' : 'Save'}
              </Button>
            </View>
          </Flex>

          <Flex align='center' gutter={8} className='product-meta'>
            <Tag size='small' variant='outlined'>SKU Count: {skus.length}</Tag>
            <Text className='product-meta-text'>{loading ? 'Loading details...' : 'Real-time pricing'}</Text>
          </Flex>
        </View>

        <View className='product-section'>
          <Flex justify='space-between' align='center'>
            <Text className='section-title'>Bulk Pricing</Text>
            <Text className='section-link'>Volume Discounts</Text>
          </Flex>

          <Grid columns={3} gutter={8}>
            {renderPriceTiers(selectedSku?.priceTiers)}
          </Grid>
        </View>

        <View className='product-section'>
          <Text className='section-title'>SKU Options</Text>
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
            <Text className='section-title'>Attributes</Text>
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
          title='Standard Air Freight'
          brief='Arrives Sep 12 - Sep 18'
          rightIcon={<ArrowRight />}
        />
      </View>

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex gutter={12} className='action-bar'>
          <Button block variant='outlined' onClick={handleInquiry}>Bargain</Button>
          <Button block color='primary' onClick={handleAddToCart}>Add to Cart</Button>
        </Flex>
        <AppTabbar value='cart' fixed={false} placeholder={false} />
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
    return 'Request quote'
  }
  return formatFen(tier.unitPriceFen)
}

const renderPriceTiers = (tiers?: PriceTier[]) => {
  if (!tiers || tiers.length === 0) {
    return (
      <Grid.Item>
        <View className='tier-card'>
          <Text className='tier-card-range'>No tiers</Text>
          <Text className='tier-card-price'>Contact sales</Text>
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
