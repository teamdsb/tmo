const fs = require('node:fs')
const path = require('node:path')

const projectConfigPath = path.resolve(__dirname, '../dist/weapp/project.config.json')
const envMode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const envFileCandidates = [
  path.resolve(__dirname, `../.env.${envMode}`),
  path.resolve(__dirname, '../.env.development'),
  path.resolve(__dirname, '../.env')
]

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const values = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separator = trimmed.indexOf('=')
    if (separator < 0) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    if (!key) {
      continue
    }

    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }

  return values
}

const envFileValues = (() => {
  for (const candidate of envFileCandidates) {
    const parsed = parseEnvFile(candidate)
    if (Object.keys(parsed).length > 0) {
      return parsed
    }
  }
  return {}
})()

function readBool(raw, defaultValue) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return defaultValue
  }

  const value = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false
  }
  return defaultValue
}

function resolveUrlCheck() {
  if (typeof process.env.TARO_APP_WEAPP_URL_CHECK === 'string' && process.env.TARO_APP_WEAPP_URL_CHECK.trim() !== '') {
    return readBool(process.env.TARO_APP_WEAPP_URL_CHECK, true)
  }

  return false
}

function readConfigValue(name) {
  if (typeof process.env[name] === 'string' && process.env[name].trim() !== '') {
    return process.env[name].trim()
  }

  if (typeof envFileValues[name] === 'string' && envFileValues[name].trim() !== '') {
    return envFileValues[name].trim()
  }

  return ''
}

function processWeappProjectConfig() {
  if (!fs.existsSync(projectConfigPath)) {
    return { status: 'missing' }
  }

  const appId = readConfigValue('TARO_APP_ID')
  const hasAppId = Boolean(appId)

  const raw = fs.readFileSync(projectConfigPath, 'utf8')
  const config = JSON.parse(raw)

  const expectedUrlCheck = resolveUrlCheck()
  if (!config.setting || typeof config.setting !== 'object') {
    config.setting = {}
  }

  let changed = false

  if (hasAppId && config.appid !== appId) {
    config.appid = appId
    changed = true
  }

  let urlCheck = config.setting.urlCheck
  if (expectedUrlCheck !== null && config.setting.urlCheck !== expectedUrlCheck) {
    config.setting.urlCheck = expectedUrlCheck
    urlCheck = expectedUrlCheck
    changed = true
  }

  if (!changed) {
    return {
      status: hasAppId ? 'unchanged' : 'unchanged-no-appid',
      appId: hasAppId ? appId : config.appid,
      urlCheck
    }
  }

  fs.writeFileSync(projectConfigPath, `${JSON.stringify(config, null, 2)}\n`)
  return {
    status: hasAppId ? 'updated' : 'updated-no-appid',
    appId: hasAppId ? appId : config.appid,
    urlCheck
  }
}

if (require.main === module) {
  const result = processWeappProjectConfig()
  if (result.status === 'missing') {
    console.warn('[postprocess-weapp-project] skip: project.config.json not found')
  } else if (result.status === 'updated-no-appid') {
    console.warn('[postprocess-weapp-project] TARO_APP_ID is empty, keep touristappid (guest mode)')
    console.log(`[postprocess-weapp-project] set urlCheck=${String(result.urlCheck)}`)
  } else if (result.status === 'unchanged-no-appid') {
    console.warn(
      '[postprocess-weapp-project] TARO_APP_ID is empty, keep touristappid (guest mode)'
    )
    console.log(`[postprocess-weapp-project] appid already ${result.appId}, urlCheck=${String(result.urlCheck)}`)
  } else if (result.status === 'updated') {
    console.log(`[postprocess-weapp-project] set appid to ${result.appId}, urlCheck=${String(result.urlCheck)}`)
  } else {
    console.log(`[postprocess-weapp-project] appid already ${result.appId}, urlCheck=${String(result.urlCheck)}`)
  }
}

module.exports = { processWeappProjectConfig }
