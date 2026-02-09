import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { saveBootstrap, savePendingRoleSelection } from './bootstrap'

export const MOCK_USER_ID = 'mock-user-id'

export const mockBootstrap: BootstrapResponse = {
  me: {
    id: MOCK_USER_ID,
    displayName: '测试账号',
    roles: ['TEST'],
    userType: 'staff',
    createdAt: '2026-01-01T00:00:00Z'
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
