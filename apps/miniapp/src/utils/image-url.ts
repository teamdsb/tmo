import { runtimeEnv } from '../config/runtime-env'

const HTTP_URL_PATTERN = /^https?:\/\//i
const IMAGE_PROXY_PATH = '/assets/img'

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const getOrigin = (value: string): string => {
  const match = value.match(/^https?:\/\/[^/]+/i)
  if (!match) {
    return ''
  }
  return match[0].toLowerCase()
}

export const toGatewayImageUrl = (rawSrc?: string | null): string | undefined => {
  if (typeof rawSrc !== 'string') {
    return undefined
  }
  const src = rawSrc.trim()
  if (!src) {
    return undefined
  }
  if (!HTTP_URL_PATTERN.test(src)) {
    return src
  }

  const base = trimTrailingSlash((runtimeEnv.gatewayBaseUrl || '').trim())
  if (!HTTP_URL_PATTERN.test(base)) {
    return src
  }

  if (getOrigin(src) === getOrigin(base)) {
    return src
  }

  const proxiedPrefix = `${base}${IMAGE_PROXY_PATH}`
  if (src.startsWith(proxiedPrefix)) {
    return src
  }

  return `${proxiedPrefix}?url=${encodeURIComponent(src)}`
}
