import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'

import { isPolicyKey, POLICY_CONTENT } from '../../content/policies'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'

export default function PolicyPage() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const policyKey = isPolicyKey(router.params?.type) ? router.params.type : 'privacy'
  const policy = POLICY_CONTENT[policyKey]

  return (
    <View className='page bg-slate-50'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.authLogin))} />
        <Navbar.Title>{policy.title}</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <View className='rounded-3xl bg-white p-6 shadow-sm'>
          <Text className='block text-xl font-semibold text-slate-900'>{policy.title}</Text>
          <Text className='mt-5 block text-sm leading-7 text-slate-600'>{policy.body}</Text>
        </View>
      </View>
    </View>
  )
}
