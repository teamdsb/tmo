import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { commerceServices } from '../../services/commerce'
import './index.scss'

export default function Index () {
  const [categoryCount, setCategoryCount] = useState(0)

  useLoad(() => {
    console.log('Page loaded.')
    commerceServices.catalog.listCategories()
      .then((response) => setCategoryCount(response.items?.length ?? 0))
      .catch((error) => console.error('load categories failed', error))
  })

  return (
    <View className='index'>
      <Text>Hello world! Categories: {categoryCount}</Text>
    </View>
  )
}
