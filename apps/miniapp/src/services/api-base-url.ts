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

const readEnv = (name: string): string => {
  if (typeof process === 'undefined' || !process?.env) {
    return ''
  }
  return process.env[name]?.trim() ?? ''
}

const isIsolatedMockMode = (): boolean => readEnv('TARO_APP_MOCK_MODE').toLowerCase() === 'isolated'

const readEnvBaseUrl = (): string => {
  return firstNonEmpty(
    readEnv('TARO_APP_API_BASE_URL'),
    readEnv('TARO_APP_GATEWAY_BASE_URL'),
    readEnv('TARO_APP_COMMERCE_BASE_URL'),
    readEnv('TARO_APP_IDENTITY_BASE_URL')
  )
}

const resolveDefaultApiBaseUrl = (): string => (isIsolatedMockMode() ? '' : 'http://localhost:8080')

export const resolveApiBaseUrl = (): string => {
  const fromEnv = readEnvBaseUrl()
  if (fromEnv) {
    return normalizeBaseUrl(fromEnv)
  }
  return resolveDefaultApiBaseUrl()
}

export const defaultApiBaseUrl = resolveDefaultApiBaseUrl()
