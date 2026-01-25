import type { ApiClientRequester } from '@tmo/api-client'

declare const process: { env?: Record<string, string | undefined> } | undefined

export interface CommerceServicesConfig {
  baseUrl?: string
  devToken?: string
  tokenStorageKey?: string
  requester?: ApiClientRequester
  timeoutMs?: number
  uploadTimeoutMs?: number
}

const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const raw of values) {
    const value = raw?.trim()
    if (value) {
      return value
    }
  }
  return ''
}

export const resolveBaseUrl = (value?: string): string => {
  const resolved = value?.trim()
  if (resolved) {
    return resolved
  }
  if (typeof process !== 'undefined' && process?.env) {
    // Gateway-first: when TARO_APP_API_BASE_URL is set, always route via gateway.
    return firstNonEmpty(process.env.TARO_APP_API_BASE_URL, process.env.TARO_APP_COMMERCE_BASE_URL)
  }
  return ''
}

export const resolveDevToken = (value?: string): string | undefined => {
  if (value !== undefined) {
    return value
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env.TARO_APP_COMMERCE_DEV_TOKEN
  }
  return undefined
}

export const defaultTokenStorageKey = 'tmo:auth:token'
export const legacyTokenStorageKey = 'tmo:commerce:token'
