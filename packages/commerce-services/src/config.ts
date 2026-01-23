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

export const resolveBaseUrl = (value?: string): string => {
  if (value) {
    return value
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env.TARO_APP_COMMERCE_BASE_URL ?? ''
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

export const defaultTokenStorageKey = 'tmo:commerce:token'
