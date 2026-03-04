import { runtimeEnv } from '../config/runtime-env'
import { saveBootstrap, savePendingRoleSelection } from './bootstrap'
import {
  buildIsolatedMockBootstrap,
  createIsolatedMockAccessToken,
  setIsolatedMockToken
} from './mock/runtime'

export const MOCK_USER_ID = 'mock-user-id'

export const applyMockLogin = async (): Promise<void> => {
  if (!runtimeEnv.isIsolatedMock) {
    throw new Error('测试登录仅在 TARO_APP_MOCK_MODE=isolated 下可用')
  }

  const token = createIsolatedMockAccessToken()
  await setIsolatedMockToken(token)
  await saveBootstrap(buildIsolatedMockBootstrap(token))
  await savePendingRoleSelection(null)
}
