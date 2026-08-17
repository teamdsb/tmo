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

type AbortListener = EventListenerOrEventListenerObject

class CompatibleAbortSignal {
  aborted = false
  onabort: ((this: AbortSignal, ev: Event) => unknown) | null = null
  reason: unknown = undefined
  private readonly listeners = new Set<AbortListener>()

  addEventListener(type: string, listener: AbortListener | null): void {
    if (type === 'abort' && listener) {
      this.listeners.add(listener)
    }
  }

  removeEventListener(type: string, listener: AbortListener | null): void {
    if (type === 'abort' && listener) {
      this.listeners.delete(listener)
    }
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of [...this.listeners]) {
      if (typeof listener === 'function') {
        listener.call(this, event)
      } else {
        listener.handleEvent(event)
      }
    }
    return true
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw this.reason
    }
  }

  abort(): void {
    if (this.aborted) {
      return
    }
    this.aborted = true
    this.reason = createAbortError()
    const event = { type: 'abort', target: this } as unknown as Event
    this.onabort?.call(this as unknown as AbortSignal, event)
    this.dispatchEvent(event)
    this.listeners.clear()
  }
}

const createCompatibleAbortController = (): Pick<AbortController, 'abort' | 'signal'> => {
  if (typeof globalThis.AbortController === 'function') {
    return new globalThis.AbortController()
  }
  const signal = new CompatibleAbortSignal()
  return {
    abort: () => signal.abort(),
    signal: signal as unknown as AbortSignal
  }
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
  const controller = createCompatibleAbortController()
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
