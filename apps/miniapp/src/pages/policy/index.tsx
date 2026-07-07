import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'

import { isPolicyKey, POLICY_CONTENT } from '../../content/policies'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'
import './index.scss'

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
      <View className='page-content policy-page-content'>
        <View className='policy-card'>
          <Text className='policy-title'>{policy.title}</Text>
          <Text className='policy-body'>{policy.body}</Text>
        </View>
      </View>
    </View>
  )
}
