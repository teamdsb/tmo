import { Text, View } from '@tarojs/components'
import type { ProductSummary } from '@tmo/api-client'
import Flex from './flex'
import SafeImage from './safe-image'
import { goodsDetailRoute } from '../routes'
import { navigateTo } from '../utils/navigation'

type ProductSummaryCardProps = {
  data: ProductSummary
  imageSize: number
  priceLabel: string
}

export default function ProductSummaryCard({ data, imageSize, priceLabel }: ProductSummaryCardProps) {
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
