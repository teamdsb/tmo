export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export const resolveRequestTimeoutMs = (timeoutMs?: number): number => {
  if (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs
  }
  return DEFAULT_REQUEST_TIMEOUT_MS
}

export type RequestAbortScope = {
  signal: AbortSignal
  dispose: () => void
}

const createAbortError = (): Error => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted', 'AbortError')
  }
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

export const waitForRequestTask = <T>(task: PromiseLike<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(task).then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

export const createRequestAbortScope = (
  callerSignal?: AbortSignal | null,
  timeoutMs?: number
): RequestAbortScope => {
  const controller = new AbortController()
  const forwardCallerAbort = () => controller.abort()

  if (callerSignal?.aborted) {
    forwardCallerAbort()
  } else {
    callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true })
  }

  const timeout = globalThis.setTimeout(() => controller.abort(), resolveRequestTimeoutMs(timeoutMs))
  return {
    signal: controller.signal,
    dispose: () => {
      globalThis.clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', forwardCallerAbort)
    }
  }
}
