import { View, Text } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import AppTabbar from '../../components/app-tabbar'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'

export default function DemandHome() {
  const navbarStyle = getNavbarStyle()

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>Demand is under construction</Text>
        <Text className='section-subtitle'>This area will host demand creation and tracking.</Text>
        <View className='placeholder-actions'>
          <Button color='primary' onClick={() => switchTabLike(ROUTES.home)}>
            Back to Home
          </Button>
        </View>
      </View>
      <AppTabbar value='demand' />
    </View>
  )
}
