import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'

import './app.scss'
import { initApp } from './bootstrap'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    initApp()
  })

  // children 是将要会渲染的页面
  return children
}

export default App
