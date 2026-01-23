import { request as platformRequest, type RequestMethod, type RequestResult } from '@tmo/platform-adapter'
import { Platform } from '@tmo/shared/enums'
import { getPlatform } from '@tmo/platform-adapter'
import type { ApiClientRequestOptions, ApiClientRequester, ApiClientResponse } from '@tmo/api-client'

import { ApiError, toApiError } from './errors'

export interface RequesterConfig {
  getToken: () => Promise<string | null>
  timeoutMs?: number
  extraHeaders?: Record<string, string>
}

const isFormData = (value: unknown): value is FormData => {
  return typeof FormData !== 'undefined' && value instanceof FormData
}

const normalizeHeaders = async (
  options: ApiClientRequestOptions,
  config: RequesterConfig
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    ...(config.extraHeaders ?? {}),
    ...(options.headers ?? {})
  }

  const token = await config.getToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.body !== undefined && options.body !== null && !headers['Content-Type'] && !headers['content-type']) {
    if (typeof options.body === 'string') {
      // let caller decide content-type
    } else if (!isFormData(options.body)) {
      headers['Content-Type'] = 'application/json'
    }
  }

  return headers
}

const parseMaybeJson = (data: unknown): unknown => {
  if (typeof data !== 'string') {
    return data
  }
  const trimmed = data.trim()
  if (!trimmed) {
    return data
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return data
    }
  }
  return data
}

const handlePlatformResponse = <T>(result: RequestResult<T>): ApiClientResponse<T> => {
  const parsed = parseMaybeJson(result.data) as T
  if (result.statusCode >= 200 && result.statusCode < 300) {
    return {
      data: parsed,
      status: result.statusCode,
      headers: result.headers
    }
  }
  throw toApiError(result.statusCode, parsed, result.headers, result.raw)
}

const createPlatformRequester = (config: RequesterConfig): ApiClientRequester => {
  return async <T>(options: ApiClientRequestOptions): Promise<ApiClientResponse<T>> => {
    const headers = await normalizeHeaders(options, config)
    try {
      const result = await platformRequest<T>({
        url: options.url,
        method: options.method as RequestMethod,
        data: options.body,
        headers,
        timeoutMs: config.timeoutMs
      })
      return handlePlatformResponse(result)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      throw error
    }
  }
}

const headersToRecord = (headers: Headers): Record<string, string> => {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

const createFetchRequester = (config: RequesterConfig): ApiClientRequester => {
  return async <T>(options: ApiClientRequestOptions): Promise<ApiClientResponse<T>> => {
    const headers = await normalizeHeaders(options, config)
    const init: RequestInit = {
      method: options.method,
      headers
    }
    if (options.body !== undefined) {
      init.body = typeof options.body === 'string' || isFormData(options.body)
        ? (options.body as BodyInit)
        : JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await fetch(options.url, init)
    } catch (error) {
      throw error
    }

    const text = await response.text()
    const parsed = parseMaybeJson(text)
    if (response.ok) {
      return {
        data: parsed as T,
        status: response.status,
        headers: headersToRecord(response.headers)
      }
    }
    throw toApiError(response.status, parsed, headersToRecord(response.headers))
  }
}

export const createRequester = (config: RequesterConfig): ApiClientRequester => {
  const platform = getPlatform()
  if (platform === Platform.Weapp || platform === Platform.Alipay) {
    return createPlatformRequester(config)
  }
  if (typeof fetch !== 'undefined') {
    return createFetchRequester(config)
  }
  return async () => {
    throw new Error('No requester available')
  }
}
