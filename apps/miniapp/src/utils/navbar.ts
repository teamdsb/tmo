import type { CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { getRuntimeDeviceInfo } from './device-info'

type NavbarMetrics = {
  height: number
  lineHeight: number
  top: number
}

let cachedMetrics: NavbarMetrics | null = null

const DEFAULT_NAVBAR_HEIGHT = 44
const DEFAULT_NAVBAR_TOP = 20

const getValidMenuButton = () => {
  const menuButton = Taro.getMenuButtonBoundingClientRect?.()
  if (!menuButton) {
    return null
  }
  const top = typeof menuButton.top === 'number' && Number.isFinite(menuButton.top) ? menuButton.top : 0
  const height = typeof menuButton.height === 'number' && Number.isFinite(menuButton.height) ? menuButton.height : 0
  if (top <= 0 || height <= 0) {
    return null
  }
  return { top, height }
}

export const getNavbarMetrics = (): NavbarMetrics => {
  if (cachedMetrics) {
    return cachedMetrics
  }

  const isAlipay = process.env.TARO_ENV === 'alipay'
  const runtimeInfo = getRuntimeDeviceInfo()
  const statusBarHeight = runtimeInfo.statusBarHeight
  const safeAreaTop = runtimeInfo.safeAreaTop
  const menuButton = getValidMenuButton()
  const topFromSystem = Math.max(statusBarHeight, safeAreaTop)

  cachedMetrics = {
    height: menuButton?.height ?? DEFAULT_NAVBAR_HEIGHT,
    lineHeight: menuButton?.height ?? DEFAULT_NAVBAR_HEIGHT,
    top: isAlipay ? 0 : (topFromSystem > 0 ? topFromSystem : DEFAULT_NAVBAR_TOP)
  }
  return cachedMetrics
}

export const getNavbarStyle = (): CSSProperties => {
  const { height, lineHeight, top } = getNavbarMetrics()
  const totalHeight = getNavbarTotalHeight()
  return {
    '--navbar-height': `${height}px`,
    '--navbar-line-height': `${lineHeight}px`,
    '--navbar-top': `${top}px`,
    '--navbar-total-height': `${totalHeight}px`
  } as CSSProperties
}

export const getNavbarTotalHeight = (): number => {
  const { top, height } = getNavbarMetrics()
  return top + height
}
