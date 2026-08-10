type AbortableTask = {
  abort?: () => void
}

const createAbortError = (): Error => {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

export const runAbortableTask = <T>(
  signal: AbortSignal | undefined,
  start: (resolve: (value: T) => void, reject: (reason?: unknown) => void) => AbortableTask | void
): Promise<T> => {
  if (signal?.aborted) {
    return Promise.reject(createAbortError())
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let task: AbortableTask | void

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort)
    }
    const resolveOnce = (value: T) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(value)
    }
    const rejectOnce = (reason?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      reject(reason)
    }
    const handleAbort = () => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      try {
        task?.abort?.()
      } finally {
        reject(createAbortError())
      }
    }

    signal?.addEventListener('abort', handleAbort, { once: true })
    try {
      task = start(resolveOnce, rejectOnce)
    } catch (error) {
      rejectOnce(error)
    }
  })
}
