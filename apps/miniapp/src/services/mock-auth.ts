import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { runtimeEnv } from '../config/runtime-env'
import { saveBootstrap, savePendingRoleSelection } from './bootstrap'
import {
  buildIsolatedMockBootstrap,
  createIsolatedMockAccessToken,
  setIsolatedMockToken
} from './mock/runtime'

export const MOCK_USER_ID = 'mock-user-id'

export const mockBootstrap: BootstrapResponse = buildIsolatedMockBootstrap('mock-token')

export const applyMockLogin = async (): Promise<void> => {
  if (runtimeEnv.isIsolatedMock) {
    const token = createIsolatedMockAccessToken()
    await setIsolatedMockToken(token)
    await saveBootstrap(buildIsolatedMockBootstrap(token))
    await savePendingRoleSelection(null)
    return
  }
  await saveBootstrap(mockBootstrap)
  await savePendingRoleSelection(null)
}
