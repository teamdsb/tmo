import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import { ROUTES } from '../../routes'
import { switchTabLike } from '../../utils/navigation'

type PlaceholderPageProps = {
  title: string
  description?: string
  actionLabel?: string
}

export default function PlaceholderPage({
  title,
  description = 'This feature is under construction.',
  actionLabel = 'Back to Home'
}: PlaceholderPageProps) {
  return (
    <View className='page'>
      <Navbar bordered fixed placeholder>
        <Navbar.Title>{title}</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>{title}</Text>
        <Text className='section-subtitle'>{description}</Text>
        <View className='placeholder-actions'>
          <Button color='primary' onClick={() => switchTabLike(ROUTES.home)}>
            {actionLabel}
          </Button>
        </View>
      </View>
    </View>
  )
}
