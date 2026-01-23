export type ErrorDetails = Record<string, unknown> | null | undefined

export interface ErrorResponse {
  code?: string
  message?: string
  requestId?: string
  details?: ErrorDetails
}

export class ApiError extends Error {
  statusCode: number
  code?: string
  requestId?: string
  details?: ErrorDetails
  raw?: unknown

  constructor(message: string, statusCode: number, options?: { code?: string; requestId?: string; details?: ErrorDetails; raw?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = options?.code
    this.requestId = options?.requestId
    this.details = options?.details
    this.raw = options?.raw
  }
}

export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError
}

const headerValue = (headers: Record<string, string> | undefined, key: string): string | undefined => {
  if (!headers) {
    return undefined
  }
  const lowerKey = key.toLowerCase()
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === lowerKey) {
      return value
    }
  }
  return undefined
}

export const toApiError = (statusCode: number, data: unknown, headers?: Record<string, string>, raw?: unknown): ApiError => {
  const payload = (data && typeof data === 'object') ? (data as ErrorResponse) : undefined
  const requestId = payload?.requestId ?? headerValue(headers, 'x-request-id')
  const message = payload?.message ?? 'request failed'
  return new ApiError(message, statusCode, {
    code: payload?.code,
    requestId,
    details: payload?.details,
    raw
  })
}
