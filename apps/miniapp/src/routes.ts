export const ROUTES = {
  home: '/pages/index/index',
  demand: '/pages/demand/index',
  cart: '/pages/cart/index',
  orders: '/pages/order/list/index',
  mine: '/pages/mine/index',
  goodsSearch: '/pages/goods/search/index',
  goodsDetail: '/pages/goods/detail/index',
  orderDetail: '/pages/order/detail/index',
  orderTracking: '/pages/order/tracking/index',
  demandList: '/pages/demand/list/index',
  demandCreate: '/pages/demand/create/index',
  addressList: '/pages/account/address/index',
  import: '/pages/import/index',
  trackingBatch: '/pages/tracking/batch/index',
  settings: '/pages/settings/index',
  support: '/pages/support/index',
  authRoleSelect: '/pages/auth/role-select/index'
} as const

const buildQuery = (params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ''
  const query = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `?${query}` : ''
}

export const withQuery = (path: string, params?: Record<string, string | number | boolean | undefined>) => {
  return `${path}${buildQuery(params)}`
}

export const goodsDetailRoute = (id: string | number) => {
  return withQuery(ROUTES.goodsDetail, { id })
}

export const orderDetailRoute = (id: string | number) => {
  return withQuery(ROUTES.orderDetail, { id })
}

export const orderTrackingRoute = (id: string | number) => {
  return withQuery(ROUTES.orderTracking, { id })
}
