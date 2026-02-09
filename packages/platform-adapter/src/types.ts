export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface LoginResult {
  code: string
  raw?: unknown
}

export interface PhoneProofResult {
  code?: string
  phone?: string
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

export interface StorageGetResult<T = unknown> {
  data: T | null
  raw?: unknown
}

export interface StorageSetResult {
  raw?: unknown
}

export interface StorageRemoveResult {
  raw?: unknown
}

export interface StorageClearResult {
  raw?: unknown
}

export interface ChooseFileOptions {
  count?: number
  type?: 'all' | 'image' | 'video' | 'file'
  extension?: string[]
}

export interface ChooseFile {
  path: string
  name?: string
  size?: number
  type?: string
}

export interface ChooseFileResult {
  files: ChooseFile[]
  raw?: unknown
}

export interface UploadFileOptions {
  url: string
  filePath: string
  name: string
  headers?: Record<string, string>
  formData?: Record<string, unknown>
  timeoutMs?: number
  fileType?: string
}

export interface UploadFileResult {
  statusCode: number
  data: string
  headers?: Record<string, string>
  raw?: unknown
}
