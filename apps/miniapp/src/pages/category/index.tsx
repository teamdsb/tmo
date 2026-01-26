import { View } from '@tarojs/components'
import Navbar from '@taroify/core/navbar'
import AppTabbar from '../../components/app-tabbar'
import { getNavbarStyle } from '../../utils/navbar'

export default function CategoryPage() {
  const navbarStyle = getNavbarStyle()

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}></Navbar>
      <AppTabbar value='category' />
    </View>
  )
}
