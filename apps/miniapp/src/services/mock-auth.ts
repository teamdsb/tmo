import { runtimeEnv } from '../config/runtime-env'
import { saveBootstrap, savePendingRoleSelection } from './bootstrap'
import {
  buildMockAuthContext,
  buildIsolatedMockBootstrap,
  createIsolatedMockAccessToken,
  saveIsolatedMockAuthContext,
  setIsolatedMockToken
} from './mock/runtime'

export const MOCK_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

export const applyMockLogin = async (): Promise<void> => {
  if (!runtimeEnv.isIsolatedMock) {
    throw new Error('测试登录仅在 TARO_APP_MOCK_MODE=isolated 下可用')
  }

  const token = createIsolatedMockAccessToken()
  const context = buildMockAuthContext('mock_sales_001', 'SALES')
  await setIsolatedMockToken(token)
  await saveIsolatedMockAuthContext(context)
  await saveBootstrap(await buildIsolatedMockBootstrap(token))
  await savePendingRoleSelection(null)
}
