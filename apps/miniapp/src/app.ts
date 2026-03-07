import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

/* #ifdef rn */
import './app.rn.scss'
/* #endif */
/* #ifndef rn */
import './app.scss'
/* #endif */

import { identityServices } from './services/identity'
import { gatewayServices } from './services/gateway'
import { clearBootstrap, saveBootstrap } from './services/bootstrap'
import { assertRuntimeApiConfig, runtimeEnv } from './config/runtime-env'
import { clearAuthSession, hasAuthToken, isUnauthorized } from './utils/auth'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    if (process.env.NODE_ENV !== 'production') {
      console.info('[runtime-env]', {
        gatewayBaseUrl: runtimeEnv.gatewayBaseUrl,
        commerceBaseUrl: runtimeEnv.commerceBaseUrl,
        identityBaseUrl: runtimeEnv.identityBaseUrl,
        paymentBaseUrl: runtimeEnv.paymentBaseUrl
      })
    }
    try {
      assertRuntimeApiConfig()
    } catch (error) {
      console.error('runtime api config invalid', error)
      return
    }
    void bootstrapApp()
  })

  // children 是将要会渲染的页面
  return children
}

export default App

export const bootstrapApp = async (): Promise<void> => {
  const hasToken = await hasAuthToken()
  if (!hasToken) {
    await clearBootstrap()
    return
  }

  const bootstrap = await tryBootstrap()
  if (bootstrap?.me) {
    return
  }
  if (!(await hasAuthToken())) {
    return
  }
  await fallbackIdentityBootstrap()
}

export const tryBootstrap = async () => {
  try {
    const bootstrap = await gatewayServices.bootstrap.get()
    await saveBootstrap(bootstrap)
    return bootstrap
  } catch (error) {
    if (isUnauthorized(error)) {
      await clearAuthSession()
      return null
    }
    console.warn('bootstrap failed', error)
    return null
  }
}

export const fallbackIdentityBootstrap = async (): Promise<void> => {
  try {
    const [me, permissions] = await Promise.all([
      identityServices.me.get(),
      identityServices.me.getPermissions()
    ])
    await saveBootstrap({
      me,
      permissions,
      featureFlags: {
        paymentEnabled: false,
        wechatPayEnabled: false,
        alipayPayEnabled: false
      }
    })
  } catch (error) {
    if (isUnauthorized(error)) {
      await clearAuthSession()
      return
    }
    console.warn('fallback bootstrap failed', error)
  }
}
