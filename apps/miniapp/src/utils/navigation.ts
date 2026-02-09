import Taro from '@tarojs/taro'
import { isTabRoute } from './tabbar'

const normalizeUrl = (url: string) => (url.startsWith('/') ? url : `/${url}`)

const stripQuery = (url: string) => url.split('?')[0]

export const getCurrentPath = () => {
  const pages = Taro.getCurrentPages()
  const current = pages[pages.length - 1] as { route?: string } | undefined
  if (!current?.route) return ''
  return `/${current.route}`
}

export const navigateTo = async (url: string) => {
  const target = normalizeUrl(url)
  if (!target) return
  if (stripQuery(target) === getCurrentPath()) return
  await Taro.navigateTo({ url: target })
}

export const switchTabLike = async (url: string) => {
  const target = normalizeUrl(url)
  if (!target) return
  if (stripQuery(target) === getCurrentPath()) return
  if (isTabRoute(target)) {
    await Taro.switchTab({ url: stripQuery(target) })
    return
  }
  await Taro.reLaunch({ url: target })
}
