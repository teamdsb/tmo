import Taro from '@tarojs/taro'
import { ROUTES } from '../routes'

const normalize = (url: string) => (url.startsWith('/') ? url : `/${url}`)

const stripQuery = (url: string) => url.split('?')[0]

export const TAB_ROUTES = [ROUTES.home, ROUTES.category, ROUTES.cart, ROUTES.mine] as const

export const isTabRoute = (url: string) => {
  const target = normalize(stripQuery(url))
  return TAB_ROUTES.some((route) => route === target)
}

export const getTabRouteIndex = (url: string) => {
  const target = normalize(stripQuery(url))
  return TAB_ROUTES.findIndex((route) => route === target)
}

export const syncCustomTabBar = (url: string) => {
  const selected = getTabRouteIndex(url)
  if (selected < 0) return
  const tabBar = (Taro as any).getTabBar?.()
  if (!tabBar) return
  if (typeof tabBar.setSelected === 'function') {
    tabBar.setSelected(selected)
    return
  }
  if (typeof tabBar.setData === 'function') {
    tabBar.setData({ selected })
  }
}
