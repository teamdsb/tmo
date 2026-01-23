export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface RequestOptions {
  method: RequestMethod
  path: string
  query?: QueryParams
  headers?: Record<string, string>
  body?: unknown
}

export type Requester = <T>(options: RequestOptions) => Promise<T>

export interface ClientConfig {
  baseUrl: string
  requester: Requester
}

export interface Client {
  request: <T>(options: RequestOptions) => Promise<T>
}

export const buildQuery = (params?: QueryParams): string => {
  if (!params) {
    return ''
  }

  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === null || entry === undefined) {
          continue
        }
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`)
      }
      continue
    }

    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  if (parts.length === 0) {
    return ''
  }

  return `?${parts.join('&')}`
}

export const joinUrl = (baseUrl: string, path: string): string => {
  const trimmedBase = baseUrl.replace(/\/+$/, '')
  if (!trimmedBase) {
    return path.startsWith('/') ? path : `/${path}`
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${trimmedBase}${normalizedPath}`
}

export const buildUrl = (baseUrl: string, path: string, query?: QueryParams): string => {
  return `${joinUrl(baseUrl, path)}${buildQuery(query)}`
}

export const createClient = (config: ClientConfig): Client => {
  return {
    request: async <T>(options: RequestOptions) => {
      const url = buildUrl(config.baseUrl, options.path, options.query)
      const { query, ...rest } = options
      return config.requester<T>({ ...rest, path: url })
    }
  }
}
