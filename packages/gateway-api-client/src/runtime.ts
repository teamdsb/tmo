import { joinUrl } from '@tmo/openapi-client'

export interface ApiClientRequestOptions {
  url: string
  method: string
  headers?: Record<string, string>
  body?: BodyInit | null
}

export interface ApiClientResponse<T> {
  data: T
  status: number
  headers?: Record<string, string>
}

export type ApiClientRequester = <T>(options: ApiClientRequestOptions) => Promise<ApiClientResponse<T>>

export interface ApiClientConfig {
  baseUrl: string
  requester: ApiClientRequester
}

let gatewayApiClientConfig: ApiClientConfig | null = null

export const setGatewayApiClientConfig = (config: ApiClientConfig): void => {
  gatewayApiClientConfig = config
}

export const getGatewayApiClientConfig = (): ApiClientConfig => {
  if (!gatewayApiClientConfig) {
    throw new Error('Gateway api client is not configured')
  }
  return gatewayApiClientConfig
}

const toHeaderRecord = (headers?: HeadersInit): Record<string, string> | undefined => {
  if (!headers) {
    return undefined
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const record: Record<string, string> = {}
    headers.forEach((value, key) => {
      record[key] = value
    })
    return record
  }
  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})
  }
  return headers
}

const toHeaders = (headers?: Record<string, string>): Headers => {
  if (typeof Headers !== 'undefined') {
    return new Headers(headers)
  }
  return headers as unknown as Headers
}

export const apiMutator = async <T>(url: string, options: RequestInit): Promise<T> => {
  const { baseUrl, requester } = getGatewayApiClientConfig()
  const targetUrl = joinUrl(baseUrl, url)
  const result = await requester<T>({
    url: targetUrl,
    method: options.method ?? 'GET',
    headers: toHeaderRecord(options.headers),
    body: options.body ?? undefined
  })

  return {
    data: result.data,
    status: result.status,
    headers: toHeaders(result.headers)
  } as T
}
