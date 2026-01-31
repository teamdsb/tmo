import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'

type PlaceholderPageProps = {
  title: string
  description?: string
  actionLabel?: string
}

export default function PlaceholderPage({
  title,
  description = '该功能正在开发中。',
  actionLabel = '返回首页'
}: PlaceholderPageProps) {
  const navbarStyle = getNavbarStyle()

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>{title}</Text>
        <Text className='section-subtitle'>{description}</Text>
        <View className='section-notice text-blue-600'>已启用工具类</View>
        <View className='placeholder-actions'>
          <Button color='primary' onClick={() => switchTabLike(ROUTES.home)}>
            {actionLabel}
          </Button>
        </View>
      </View>
    </View>
  )
}
