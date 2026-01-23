import { isApiError } from './errors'

export interface RetryOptions {
  retries?: number
  delayMs?: number
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const withRetry = async <T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const retries = options.retries ?? 2
  const delayMs = options.delayMs ?? 200

  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn()
    } catch (error) {
      attempt += 1
      if (attempt > retries) {
        throw error
      }
      if (isApiError(error) && error.statusCode >= 400 && error.statusCode < 500) {
        throw error
      }
      await sleep(delayMs * attempt)
    }
  }
}
