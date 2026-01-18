export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface LoginResult {
  code: string
  raw?: unknown
}

export interface RequestOptions {
  url: string
  method?: RequestMethod
  data?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface RequestResult<T> {
  data: T
  statusCode: number
  headers?: Record<string, string>
  raw?: unknown
}

export interface PayOptions {
  payload: Record<string, unknown>
}

export interface PayResult {
  raw?: unknown
}

export interface ChooseImageOptions {
  count?: number
  sizeType?: Array<'original' | 'compressed'>
  sourceType?: Array<'album' | 'camera'>
}

export interface ChooseImageResult {
  tempFilePaths: string[]
  raw?: unknown
}
