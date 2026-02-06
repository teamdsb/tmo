import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { saveBootstrap, savePendingRoleSelection } from './bootstrap'

export const mockBootstrap: BootstrapResponse = {
  me: {
    displayName: '测试账号',
    roles: ['TEST'],
    userType: 'TEST'
  },
  permissions: {
    items: []
  },
  featureFlags: {
    paymentEnabled: false,
    wechatPayEnabled: false,
    alipayPayEnabled: false
  }
}

export const applyMockLogin = async (): Promise<void> => {
  await saveBootstrap(mockBootstrap)
  await savePendingRoleSelection(null)
}
