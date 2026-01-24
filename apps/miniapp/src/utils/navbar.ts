import Taro from '@tarojs/taro'
import type { CSSProperties } from 'react'

type NavbarMetrics = {
  height: number
  lineHeight: number
}

let cachedMetrics: NavbarMetrics | null = null

const DEFAULT_NAVBAR_HEIGHT = 44
const NAVBAR_OFFSET = 10

export const getNavbarMetrics = (): NavbarMetrics => {
  if (cachedMetrics) {
    return cachedMetrics
  }

  const systemInfo = Taro.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight ?? 0
  const menuButton = Taro.getMenuButtonBoundingClientRect?.()

  if (menuButton && menuButton.height) {
    const topGap = Math.max(menuButton.top - statusBarHeight, 0)
    const height = menuButton.height + topGap * 2 + NAVBAR_OFFSET
    cachedMetrics = {
      height,
      lineHeight: menuButton.height
    }
    return cachedMetrics
  }

  cachedMetrics = {
    height: statusBarHeight + DEFAULT_NAVBAR_HEIGHT + NAVBAR_OFFSET,
    lineHeight: DEFAULT_NAVBAR_HEIGHT
  }
  return cachedMetrics
}

export const getNavbarStyle = (): CSSProperties => {
  const { height, lineHeight } = getNavbarMetrics()
  return {
    '--navbar-height': `${height}px`,
    '--navbar-line-height': `${lineHeight}px`
  } as CSSProperties
}
