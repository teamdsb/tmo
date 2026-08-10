import { request as requestAlipay } from '../../../../packages/platform-adapter/src/alipay'
import { request as requestWeapp } from '../../../../packages/platform-adapter/src/weapp'

type NativeRequestOptions = {
  fail: (error: unknown) => void
}

describe('native platform request cancellation', () => {
  afterEach(() => {
    delete (globalThis as { wx?: unknown }).wx
    delete (globalThis as { my?: unknown }).my
  })

  it('aborts the WeChat request task when the caller signal is aborted', async () => {
    const abort = jest.fn()
    ;(globalThis as { wx?: unknown }).wx = {
      request: jest.fn((_options: NativeRequestOptions) => ({ abort }))
    }
    const caller = new AbortController()

    const request = requestWeapp({
      url: 'https://example.test/wechat',
      method: 'GET',
      signal: caller.signal
    })
    caller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('aborts the Alipay request task when the caller signal is aborted', async () => {
    const abort = jest.fn()
    ;(globalThis as { my?: unknown }).my = {
      request: jest.fn((_options: NativeRequestOptions) => ({ abort }))
    }
    const caller = new AbortController()

    const request = requestAlipay({
      url: 'https://example.test/alipay',
      method: 'GET',
      signal: caller.signal
    })
    caller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(abort).toHaveBeenCalledTimes(1)
  })

  it('does not start a native task for an already-aborted signal', async () => {
    const nativeRequest = jest.fn()
    ;(globalThis as { wx?: unknown }).wx = { request: nativeRequest }
    const caller = new AbortController()
    caller.abort()

    await expect(requestWeapp({
      url: 'https://example.test/wechat',
      method: 'GET',
      signal: caller.signal
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(nativeRequest).not.toHaveBeenCalled()
  })
})
