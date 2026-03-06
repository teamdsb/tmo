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

export class PaymentCancelledError extends Error {
  raw?: unknown

  constructor(message = 'payment cancelled', raw?: unknown) {
    super(message)
    this.name = 'PaymentCancelledError'
    this.raw = raw
  }
}

export const isPaymentCancelled = (error: unknown): error is PaymentCancelledError => {
  return error instanceof PaymentCancelledError
}
