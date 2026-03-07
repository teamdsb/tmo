const fs = require('node:fs')
const path = require('node:path')

const miniappDir = path.resolve(__dirname, '..')

const modeMap = Object.freeze({
  mock: {
    envFile: '.env.mock',
    nodeEnv: 'development',
    verifyMode: 'mock',
    preflight: 'false'
  },
  dev: {
    envFile: '.env.development',
    nodeEnv: 'development',
    verifyMode: 'development',
    preflight: 'true'
  },
  prod: {
    envFile: '.env.production',
    nodeEnv: 'production',
    verifyMode: 'production',
    preflight: 'false'
  }
})

function normalizeQuoted(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[weapp-mode] env file not found: ${path.relative(miniappDir, filePath)}`)
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  const result = {}

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) {
      continue
    }

    const key = line.slice(0, eqIndex).trim()
    const value = line.slice(eqIndex + 1)
    result[key] = normalizeQuoted(value)
  }

  return result
}

function resolveModeConfig(mode) {
  const config = modeMap[mode]
  if (!config) {
    throw new Error(`[weapp-mode] unsupported mode "${mode}". expected one of: ${Object.keys(modeMap).join(', ')}`)
  }
  return config
}

function buildModeEnv(mode, extraEnv = {}) {
  const config = resolveModeConfig(mode)
  const fileEnv = parseEnvFile(path.join(miniappDir, config.envFile))

  return {
    ...process.env,
    ...fileEnv,
    ...extraEnv,
    NODE_ENV: config.nodeEnv,
    TMO_WEAPP_BUILD_MODE: config.verifyMode,
    WEAPP_PREFLIGHT_HTTP_SMOKE: config.preflight
  }
}

module.exports = {
  buildModeEnv,
  resolveModeConfig
}
