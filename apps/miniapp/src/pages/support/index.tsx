import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { ROUTES } from '../../routes'
import { switchTabLike } from '../../utils/navigation'
import { isSalesUser } from '../../utils/authz'
import { loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import { gatewayServices } from '../../services/gateway'
import SupportCustomerView from './support-customer-view'
import SupportSalesView from './support-sales-view'

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

    try {
      const fresh = await gatewayServices.bootstrap.get()
      setBootstrap(fresh)
      await saveBootstrap(fresh)
    } catch (error) {
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

  return isSalesUser(bootstrap)
    ? <SupportSalesView onBack={handleBack} />
    : <SupportCustomerView onBack={handleBack} />
}
