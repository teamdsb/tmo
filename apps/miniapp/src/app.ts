import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.scss'
import { identityServices } from './services/identity'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    void restoreIdentity()
  })

  // children 是将要会渲染的页面
  return children
}

export default App

const restoreIdentity = async (): Promise<void> => {
  try {
    const token = await identityServices.tokens.getToken()
    if (!token) {
      return
    }
    await identityServices.me.get()
  } catch (error) {
    const isUnauthorized = typeof error === 'object'
      && error !== null
      && 'statusCode' in error
      && (error as { statusCode?: number }).statusCode === 401

    if (isUnauthorized) {
      try {
        await identityServices.auth.miniLogin({})
      } catch (loginError) {
        console.warn('identity login failed', loginError)
      }
      return
    }

    console.warn('restore identity failed', error)
  }
}
