const miniappMode = require('../../scripts/miniapp-mode')

describe('miniapp mode env loading', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('infers dev mode by default so direct Taro config loads .env.development', () => {
    delete process.env.NODE_ENV
    delete process.env.TMO_WEAPP_BUILD_MODE
    delete process.env.TARO_APP_MOCK_MODE

    expect(miniappMode.inferModeFromEnv(process.env)).toBe('dev')
  })

  it('loads TARO_APP_ID from the mode env file into process.env', () => {
    delete process.env.TARO_APP_ID

    const env = miniappMode.loadModeEnv('dev')

    expect(env.TARO_APP_ID).toBe('wx8e8831fc456f019b')
    expect(process.env.TARO_APP_ID).toBe('wx8e8831fc456f019b')
  })
})
