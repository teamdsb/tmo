const normalize = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const firstNonEmpty = (...values: string[]): string => {
  for (const value of values) {
    if (value) {
      return value
    }
  }
  return ''
}

const readProcessEnv = (name: string): string => {
  if (typeof process === 'undefined' || !process?.env) {
    return ''
  }
  return normalize(process.env[name])
}

const readConst = (value: unknown): string => normalize(value)

const readBoolean = (raw: string): boolean => {
  const value = raw.toLowerCase()
  return value === 'true' || value === '1' || value === 'on' || value === 'yes'
}

const isTestEnv = readProcessEnv('NODE_ENV') === 'test'

const testFallbackBaseUrl = isTestEnv ? 'http://localhost:8080' : ''

const apiBaseUrlConst = typeof __TMO_API_BASE_URL__ !== 'undefined'
  ? __TMO_API_BASE_URL__
  : ''
const gatewayBaseUrlConst = typeof __TMO_GATEWAY_BASE_URL__ !== 'undefined'
  ? __TMO_GATEWAY_BASE_URL__
  : ''
const commerceBaseUrlConst = typeof __TMO_COMMERCE_BASE_URL__ !== 'undefined'
  ? __TMO_COMMERCE_BASE_URL__
  : ''
const identityBaseUrlConst = typeof __TMO_IDENTITY_BASE_URL__ !== 'undefined'
  ? __TMO_IDENTITY_BASE_URL__
  : ''

const gatewayDevTokenConst = typeof __TMO_GATEWAY_DEV_TOKEN__ !== 'undefined'
  ? __TMO_GATEWAY_DEV_TOKEN__
  : ''
const commerceDevTokenConst = typeof __TMO_COMMERCE_DEV_TOKEN__ !== 'undefined'
  ? __TMO_COMMERCE_DEV_TOKEN__
  : ''
const identityDevTokenConst = typeof __TMO_IDENTITY_DEV_TOKEN__ !== 'undefined'
  ? __TMO_IDENTITY_DEV_TOKEN__
  : ''

const commerceMockFallbackConst = typeof __TMO_COMMERCE_MOCK_FALLBACK__ !== 'undefined'
  ? __TMO_COMMERCE_MOCK_FALLBACK__
  : ''
const mockLoginEnabledConst = typeof __TMO_ENABLE_MOCK_LOGIN__ !== 'undefined'
  ? __TMO_ENABLE_MOCK_LOGIN__
  : ''
const weappPhoneProofSimulationConst = typeof __TMO_WEAPP_PHONE_PROOF_SIMULATION__ !== 'undefined'
  ? __TMO_WEAPP_PHONE_PROOF_SIMULATION__
  : ''

const optional = (value: string): string | undefined => value || undefined

export const runtimeEnv = Object.freeze({
  gatewayBaseUrl: firstNonEmpty(
    readConst(apiBaseUrlConst),
    readConst(gatewayBaseUrlConst),
    readProcessEnv('TARO_APP_API_BASE_URL'),
    readProcessEnv('TARO_APP_GATEWAY_BASE_URL'),
    testFallbackBaseUrl
  ),
  commerceBaseUrl: firstNonEmpty(
    readConst(apiBaseUrlConst),
    readConst(commerceBaseUrlConst),
    readProcessEnv('TARO_APP_API_BASE_URL'),
    readProcessEnv('TARO_APP_COMMERCE_BASE_URL'),
    testFallbackBaseUrl
  ),
  identityBaseUrl: firstNonEmpty(
    readConst(apiBaseUrlConst),
    readConst(identityBaseUrlConst),
    readProcessEnv('TARO_APP_API_BASE_URL'),
    readProcessEnv('TARO_APP_IDENTITY_BASE_URL'),
    testFallbackBaseUrl
  ),
  gatewayDevToken: optional(firstNonEmpty(
    readConst(gatewayDevTokenConst),
    readProcessEnv('TARO_APP_GATEWAY_DEV_TOKEN'),
    readProcessEnv('TARO_APP_IDENTITY_DEV_TOKEN')
  )),
  commerceDevToken: optional(firstNonEmpty(
    readConst(commerceDevTokenConst),
    readProcessEnv('TARO_APP_COMMERCE_DEV_TOKEN')
  )),
  identityDevToken: optional(firstNonEmpty(
    readConst(identityDevTokenConst),
    readProcessEnv('TARO_APP_IDENTITY_DEV_TOKEN')
  )),
  commerceMockFallback: readBoolean(firstNonEmpty(
    readConst(commerceMockFallbackConst),
    readProcessEnv('TARO_APP_COMMERCE_MOCK_FALLBACK')
  )),
  enableMockLogin: readBoolean(firstNonEmpty(
    readConst(mockLoginEnabledConst),
    readProcessEnv('TARO_APP_ENABLE_MOCK_LOGIN')
  )),
  weappPhoneProofSimulation: readBoolean(firstNonEmpty(
    readConst(weappPhoneProofSimulationConst),
    readProcessEnv('TARO_APP_WEAPP_PHONE_PROOF_SIMULATION')
  ))
})

const requireBaseUrl = (
  serviceName: string,
  value: string,
  envKeys: string[]
): string => {
  const baseUrl = value.trim()
  if (baseUrl) {
    return baseUrl
  }
  throw new Error(
    `[runtime-env] ${serviceName} baseUrl is missing. Configure one of: ${envKeys.join(', ')}.`
  )
}

export const requireGatewayBaseUrl = (): string => {
  return requireBaseUrl(
    'gateway',
    runtimeEnv.gatewayBaseUrl,
    ['TARO_APP_API_BASE_URL', 'TARO_APP_GATEWAY_BASE_URL']
  )
}

export const requireCommerceBaseUrl = (): string => {
  return requireBaseUrl(
    'commerce',
    runtimeEnv.commerceBaseUrl,
    ['TARO_APP_API_BASE_URL', 'TARO_APP_COMMERCE_BASE_URL']
  )
}

export const requireIdentityBaseUrl = (): string => {
  return requireBaseUrl(
    'identity',
    runtimeEnv.identityBaseUrl,
    ['TARO_APP_API_BASE_URL', 'TARO_APP_IDENTITY_BASE_URL']
  )
}

export const assertRuntimeApiConfig = (): void => {
  requireGatewayBaseUrl()
  requireCommerceBaseUrl()
  requireIdentityBaseUrl()
}
