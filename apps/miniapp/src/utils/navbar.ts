import Taro from '@tarojs/taro'
import type { CSSProperties } from 'react'

type NavbarMetrics = {
  height: number
  lineHeight: number
  top: number
}

let cachedMetrics: NavbarMetrics | null = null

const DEFAULT_NAVBAR_HEIGHT = 44

export const getNavbarMetrics = (): NavbarMetrics => {
  if (cachedMetrics) {
    return cachedMetrics
  }

  const systemInfo = Taro.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight ?? 0
  const menuButton = Taro.getMenuButtonBoundingClientRect?.()

  if (menuButton && menuButton.height) {
    const top = Math.max(menuButton.top, statusBarHeight)
    const height = menuButton.height
    cachedMetrics = {
      height,
      lineHeight: menuButton.height,
      top
    }
    return cachedMetrics
  }

  cachedMetrics = {
    height: DEFAULT_NAVBAR_HEIGHT,
    lineHeight: DEFAULT_NAVBAR_HEIGHT,
    top: statusBarHeight
  }
  return cachedMetrics
}

export const getNavbarStyle = (): CSSProperties => {
  const { height, lineHeight, top } = getNavbarMetrics()
  return {
    '--navbar-height': `${height}px`,
    '--navbar-line-height': `${lineHeight}px`,
    '--navbar-top': `${top}px`
  } as CSSProperties
}
