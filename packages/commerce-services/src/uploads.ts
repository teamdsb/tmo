import { chooseFile, uploadFile, type ChooseFile, type UploadFileResult } from '@tmo/platform-adapter'
import { joinUrl } from '@tmo/openapi-client'

import { toApiError } from './errors'

export interface UploadClientConfig {
  baseUrl: string
  getAuthHeaders: () => Promise<Record<string, string>>
  timeoutMs?: number
  onUnauthorized?: () => void | Promise<void>
}

export interface UploadClient {
  upload: <T>(path: string, filePath: string, fieldName: string, formData?: Record<string, unknown>) => Promise<T>
}

const parseUploadData = <T>(result: UploadFileResult): T => {
  const raw = result.data
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        parsed = raw
      }
    }
  }
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw toApiError(result.statusCode, parsed, result.headers, result.raw)
  }
  return parsed as T
}

export const createUploadClient = (config: UploadClientConfig): UploadClient => {
  return {
    upload: async <T>(path: string, filePath: string, fieldName: string, formData?: Record<string, unknown>) => {
      const headers = await config.getAuthHeaders()
      const result = await uploadFile({
        url: joinUrl(config.baseUrl, path),
        filePath,
        name: fieldName,
        headers,
        formData,
        timeoutMs: config.timeoutMs
      })
      if (result.statusCode === 401 && config.onUnauthorized) {
        try {
          await config.onUnauthorized()
        } catch {
          // Preserve the upload response when local session cleanup fails.
        }
      }
      return parseUploadData<T>(result)
    }
  }
}

export const chooseExcelFile = async (): Promise<ChooseFile> => {
  const result = await chooseFile({
    count: 1,
    type: 'file',
    extension: ['xls', 'xlsx']
  })
  const file = result.files[0]
  if (!file) {
    throw new Error('no file selected')
  }
  return file
}
