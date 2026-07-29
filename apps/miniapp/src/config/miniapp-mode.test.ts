/* eslint-disable import/no-commonjs */
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
    Reflect.deleteProperty(process.env, 'NODE_ENV')
    Reflect.deleteProperty(process.env, 'TMO_WEAPP_BUILD_MODE')
    Reflect.deleteProperty(process.env, 'TARO_APP_MOCK_MODE')

    expect(miniappMode.inferModeFromEnv(process.env)).toBe('dev')
  })

  it('loads TARO_APP_ID from the production env file into process.env', () => {
    Reflect.deleteProperty(process.env, 'TARO_APP_ID')

    const env = miniappMode.loadModeEnv('prod')

    expect(env.TARO_APP_ID).toBe('wx8e8831fc456f019b')
    expect(process.env.TARO_APP_ID).toBe('wx8e8831fc456f019b')
  })

  it('loads the ECS gateway for development builds', () => {
    Reflect.deleteProperty(process.env, 'TARO_APP_API_BASE_URL')

    const env = miniappMode.buildModeEnv('dev')

    expect(env.TARO_APP_API_BASE_URL).toBe('https://yunhuhui.com.cn')
  })

  it('lets explicit process env override the mode env file for e2e runs', () => {
    process.env.TARO_APP_WEAPP_PHONE_PROOF_SIMULATION = 'true'

    const env = miniappMode.buildModeEnv('dev')

    expect(env.TARO_APP_WEAPP_PHONE_PROOF_SIMULATION).toBe('true')
  })
})
