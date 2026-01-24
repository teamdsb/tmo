import type { ApiClientRequester } from '@tmo/identity-api-client'

declare const process: { env?: Record<string, string | undefined> } | undefined

export interface IdentityServicesConfig {
  baseUrl?: string
  devToken?: string
  tokenStorageKey?: string
  requester?: ApiClientRequester
  timeoutMs?: number
}

export const resolveBaseUrl = (value?: string): string => {
  if (value) {
    return value
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env.TARO_APP_API_BASE_URL ?? process.env.TARO_APP_IDENTITY_BASE_URL ?? ''
  }
  return ''
}

export const resolveDevToken = (value?: string): string | undefined => {
  if (value !== undefined) {
    return value
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env.TARO_APP_IDENTITY_DEV_TOKEN
  }
  return undefined
}

export const defaultTokenStorageKey = 'tmo:auth:token'
export const legacyTokenStorageKey = 'tmo:commerce:token'
