import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { ROUTES } from '../../routes'
import { switchTabLike } from '../../utils/navigation'
import { clearAuthSession, hasAuthToken, isUnauthorized } from '../../utils/auth'
import { isCustomerUser } from '../../utils/authz'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import { gatewayServices } from '../../services/gateway'
import SupportSalesView from './support-sales-view'
import SupportChatPage from './chat/index'

export default function SupportPage() {
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [loadingBootstrap, setLoadingBootstrap] = useState(true)

  const handleBack = () => {
    Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))
  }

  const refreshBootstrap = useCallback(async () => {
    const cached = await loadBootstrap()
    if (cached) {
      setBootstrap(cached)
    }

    const tokenExists = await hasAuthToken()
    if (!tokenExists) {
      setBootstrap(null)
      await clearBootstrap()
      setLoadingBootstrap(false)
      return
    }

    try {
      const fresh = await gatewayServices.bootstrap.get()
      setBootstrap(fresh)
      await saveBootstrap(fresh)
    } catch (error) {
      if (isUnauthorized(error)) {
        setBootstrap(null)
        await clearAuthSession()
        return
      }
      console.warn('support bootstrap refresh failed', error)
    } finally {
      setLoadingBootstrap(false)
    }
  }, [])

  useEffect(() => {
    void refreshBootstrap()
  }, [refreshBootstrap])

  if (loadingBootstrap) {
    return (
      <View className='page'>
        <View className='page-content'>
          <Text className='section-subtitle'>正在加载页面...</Text>
        </View>
      </View>
    )
  }

  if (isCustomerUser(bootstrap)) {
    return <SupportChatPage />
  }

  return <SupportSalesView onBack={handleBack} />
}
