import { defaultApiBaseUrl, resolveApiBaseUrl } from './api-base-url'

describe('resolveApiBaseUrl', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.TARO_APP_API_BASE_URL
    delete process.env.TARO_APP_GATEWAY_BASE_URL
    delete process.env.TARO_APP_COMMERCE_BASE_URL
    delete process.env.TARO_APP_IDENTITY_BASE_URL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('uses TARO_APP_API_BASE_URL with normalized trailing slash', () => {
    process.env.TARO_APP_API_BASE_URL = 'http://localhost:8080/'
    expect(resolveApiBaseUrl()).toBe('http://localhost:8080')
  })

  it('falls back to commerce base url when api base url is missing', () => {
    process.env.TARO_APP_COMMERCE_BASE_URL = 'http://127.0.0.1:8080'
    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8080')
  })

  it('uses default base url when all env values are missing', () => {
    expect(resolveApiBaseUrl()).toBe(defaultApiBaseUrl)
  })
})
