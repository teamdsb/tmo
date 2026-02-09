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
import { saveBootstrap } from './services/bootstrap'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    void bootstrapApp()
  })

  // children 是将要会渲染的页面
  return children
}

export default App

const bootstrapApp = async (): Promise<void> => {
  const bootstrap = await tryBootstrap()
  if (bootstrap?.me) {
    return
  }
  const token = await identityServices.tokens.getToken()
  if (!token) {
    return
  }
  await fallbackIdentityBootstrap()
}

const tryBootstrap = async () => {
  try {
    const bootstrap = await gatewayServices.bootstrap.get()
    await saveBootstrap(bootstrap)
    return bootstrap
  } catch (error) {
    if (isUnauthorized(error)) {
      await identityServices.tokens.setToken(null)
    }
    console.warn('bootstrap failed', error)
    return null
  }
}

const fallbackIdentityBootstrap = async (): Promise<void> => {
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
    console.warn('fallback bootstrap failed', error)
  }
}

const isUnauthorized = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && (error as { statusCode?: number }).statusCode === 401
}
