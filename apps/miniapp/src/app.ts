import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { RoleSelectionRequiredError } from '@tmo/identity-services'

/* #ifdef rn */
import './app.rn.scss'
/* #endif */
/* #ifndef rn */
import './app.scss'
/* #endif */

import { identityServices } from './services/identity'
import { gatewayServices } from './services/gateway'
import { saveBootstrap, savePendingRoleSelection } from './services/bootstrap'
import { ROUTES } from './routes'
import { navigateTo } from './utils/navigation'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    void bootstrapApp()
  })

  // children 是将要会渲染的页面
  return children
}

export default App

type LaunchContext = {
  scene?: string
  bindingToken?: string
}

const bootstrapApp = async (): Promise<void> => {
  const context = readLaunchContext()
  const bootstrap = await tryBootstrap()
  if (bootstrap?.me) {
    return
  }

  await loginAndBootstrap(context)
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

const loginAndBootstrap = async (context: LaunchContext): Promise<void> => {
  try {
    await identityServices.auth.miniLogin({
      scene: context.scene,
      bindingToken: context.bindingToken
    })
  } catch (error) {
    if (error instanceof RoleSelectionRequiredError) {
      await savePendingRoleSelection({
        roles: error.availableRoles,
        scene: context.scene,
        bindingToken: context.bindingToken
      })
      await navigateTo(ROUTES.authRoleSelect)
      return
    }
    console.warn('identity login failed', error)
    return
  }

  const bootstrap = await tryBootstrap()
  if (bootstrap?.me) {
    await savePendingRoleSelection(null)
    return
  }
  await fallbackIdentityBootstrap()
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

const readLaunchContext = (): LaunchContext => {
  const options = Taro.getLaunchOptionsSync?.()
  const query = (options?.query ?? {}) as Record<string, unknown>
  const sceneFromOptions = options?.scene !== undefined && options?.scene !== null
    ? String(options.scene)
    : undefined
  const sceneFromQuery = typeof query.scene === 'string' && query.scene.trim()
    ? query.scene.trim()
    : undefined
  const bindingToken = typeof query.bindingToken === 'string'
    ? query.bindingToken
    : typeof query.binding_token === 'string'
      ? query.binding_token
      : undefined
  return {
    scene: sceneFromOptions ?? sceneFromQuery,
    bindingToken
  }
}

const isUnauthorized = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && (error as { statusCode?: number }).statusCode === 401
}
