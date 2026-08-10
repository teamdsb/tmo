import { getPlatform, request as platformRequest } from '@tmo/platform-adapter'
import { Platform } from '@tmo/shared/enums'

import { createRequester } from '../../../../packages/commerce-services/src/requester'

const asMock = <T extends (...args: any[]) => any>(value: T) => value as jest.MockedFunction<T>

describe('browser service request deadlines', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    jest.useFakeTimers()
    asMock(getPlatform).mockReturnValue(Platform.Unknown)
    asMock(platformRequest).mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    asMock(getPlatform).mockReturnValue(Platform.Weapp)
    asMock(platformRequest).mockResolvedValue({ statusCode: 200, data: {}, headers: {} })
    jest.useRealTimers()
  })

  const installNeverResolvingFetch = () => {
    let requestSignal: AbortSignal | undefined
    let markStarted: (() => void) | undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })

    globalThis.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined
      markStarted?.()
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'))
        }, { once: true })
      })
    }) as typeof fetch

    return {
      started,
      signal: () => requestSignal
    }
  }

  it('aborts a fetch that never resolves when its deadline expires', async () => {
    const pendingFetch = installNeverResolvingFetch()
    const requester = createRequester({
      getToken: async () => null,
      timeoutMs: 25
    })

    const request = requester({ url: 'https://example.test/cart', method: 'GET' })
    await pendingFetch.started
    jest.advanceTimersByTime(25)

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(pendingFetch.signal()?.aborted).toBe(true)
  })

  it('forwards a caller abort before the configured deadline', async () => {
    const pendingFetch = installNeverResolvingFetch()
    const requester = createRequester({
      getToken: async () => null,
      timeoutMs: 60_000
    })
    const caller = new AbortController()

    const request = requester({
      url: 'https://example.test/cart',
      method: 'GET',
      signal: caller.signal
    })
    await pendingFetch.started
    caller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(pendingFetch.signal()?.aborted).toBe(true)
  })

  it('keeps the deadline active while the response body is stalled', async () => {
    let requestSignal: AbortSignal | undefined
    let markBodyStarted: (() => void) | undefined
    const bodyStarted = new Promise<void>((resolve) => {
      markBodyStarted = resolve
    })
    globalThis.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () => {
          markBodyStarted?.()
          return new Promise<string>((_resolve, reject) => {
            requestSignal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'))
            }, { once: true })
          })
        }
      } as Response)
    }) as typeof fetch
    const requester = createRequester({
      getToken: async () => null,
      timeoutMs: 25
    })

    const request = requester({ url: 'https://example.test/cart', method: 'GET' })
    await bodyStarted
    jest.advanceTimersByTime(25)

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(requestSignal?.aborted).toBe(true)
  })

  it('aborts while token storage is stalled before transport starts', async () => {
    globalThis.fetch = jest.fn() as typeof fetch
    const requester = createRequester({
      getToken: () => new Promise<string | null>(() => {}),
      timeoutMs: 25
    })

    const request = requester({ url: 'https://example.test/cart', method: 'GET' })
    jest.advanceTimersByTime(25)

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('honors caller abort while token storage is stalled', async () => {
    globalThis.fetch = jest.fn() as typeof fetch
    const caller = new AbortController()
    const requester = createRequester({
      getToken: () => new Promise<string | null>(() => {}),
      timeoutMs: 60_000
    })

    const request = requester({
      url: 'https://example.test/cart',
      method: 'GET',
      signal: caller.signal
    })
    caller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('runs centralized recovery for a browser 401 response', async () => {
    const recoverUnauthorized = jest.fn(async () => {})
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => JSON.stringify({ code: 'unauthorized', message: 'expired' })
    } as Response)) as typeof fetch
    const requester = createRequester({
      getToken: async () => 'expired-token',
      onUnauthorized: recoverUnauthorized
    })

    await expect(requester({ url: 'https://example.test/cart', method: 'GET' }))
      .rejects.toMatchObject({ statusCode: 401 })
    expect(recoverUnauthorized).toHaveBeenCalledTimes(1)
  })

  it('does not wait forever for 401 recovery after the deadline', async () => {
    let recoveryStarted: (() => void) | undefined
    const recoveryBegan = new Promise<void>((resolve) => {
      recoveryStarted = resolve
    })
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => JSON.stringify({ code: 'unauthorized', message: 'expired' })
    } as Response)) as typeof fetch
    const requester = createRequester({
      getToken: async () => 'expired-token',
      timeoutMs: 25,
      onUnauthorized: () => {
        recoveryStarted?.()
        return new Promise<void>(() => {})
      }
    })

    const request = requester({ url: 'https://example.test/cart', method: 'GET' })
    await recoveryBegan
    jest.advanceTimersByTime(25)

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('forwards caller abort and centralized recovery on the native path', async () => {
    asMock(getPlatform).mockReturnValue(Platform.Weapp)
    asMock(platformRequest).mockResolvedValue({
      statusCode: 401,
      data: { code: 'unauthorized', message: 'expired' },
      headers: {}
    })
    const recoverUnauthorized = jest.fn(async () => {})
    const caller = new AbortController()
    const requester = createRequester({
      getToken: async () => 'expired-token',
      onUnauthorized: recoverUnauthorized
    })

    await expect(requester({
      url: 'https://example.test/cart',
      method: 'GET',
      signal: caller.signal
    })).rejects.toMatchObject({ statusCode: 401 })
    expect(platformRequest).toHaveBeenCalledWith(expect.objectContaining({ signal: caller.signal }))
    expect(recoverUnauthorized).toHaveBeenCalledTimes(1)
  })
})
