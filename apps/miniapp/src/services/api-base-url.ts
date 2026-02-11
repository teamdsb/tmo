const DEFAULT_API_BASE_URL = 'http://localhost:8080'

declare const process: { env?: Record<string, string | undefined> } | undefined

const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const raw of values) {
    const value = raw?.trim()
    if (value) {
      return value
    }
  }
  return ''
}

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '')

const readEnvBaseUrl = (): string => {
  if (typeof process === 'undefined' || !process?.env) {
    return ''
  }
  return firstNonEmpty(
    process.env.TARO_APP_API_BASE_URL,
    process.env.TARO_APP_GATEWAY_BASE_URL,
    process.env.TARO_APP_COMMERCE_BASE_URL,
    process.env.TARO_APP_IDENTITY_BASE_URL
  )
}

export const resolveApiBaseUrl = (): string => {
  const fromEnv = readEnvBaseUrl()
  if (fromEnv) {
    return normalizeBaseUrl(fromEnv)
  }
  return DEFAULT_API_BASE_URL
}

export const defaultApiBaseUrl = DEFAULT_API_BASE_URL
