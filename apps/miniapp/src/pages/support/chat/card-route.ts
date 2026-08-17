import { goodsDetailRoute } from '../../../routes'

const internalPageRoutePattern = /^\/pages\/[A-Za-z0-9_/-]+(?:\?[^\s#]*)?$/
const legacyGoodsLinkPattern = /^\/goods\/([^/?#]+)$/

export const resolveSupportCardRoute = (payload?: Record<string, unknown>): string => {
  const route = typeof payload?.route === 'string' ? payload.route.trim() : ''
  if (internalPageRoutePattern.test(route)) {
    return route
  }

  const linkUrl = typeof payload?.linkUrl === 'string' ? payload.linkUrl.trim() : ''
  const legacyMatch = legacyGoodsLinkPattern.exec(linkUrl)
  if (!legacyMatch) {
    return ''
  }

  try {
    const productId = decodeURIComponent(legacyMatch[1]).trim()
    return productId ? goodsDetailRoute(productId) : ''
  } catch {
    return ''
  }
}
