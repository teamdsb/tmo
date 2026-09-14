import { ROUTES } from '../routes'

const normalize = (url: string) => (url.startsWith('/') ? url : `/${url}`)

const stripQuery = (url: string) => url.split('?')[0]

export const TAB_ROUTES = [ROUTES.home, ROUTES.category, ROUTES.cart, ROUTES.mine] as const

export const isTabRoute = (url: string) => {
  const target = normalize(stripQuery(url))
  return TAB_ROUTES.some((route) => route === target)
}
