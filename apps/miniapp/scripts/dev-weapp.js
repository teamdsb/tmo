const path = require('node:path')
const fs = require('node:fs')
const { spawn, spawnSync } = require('node:child_process')
const { processWeappWxss } = require('./postprocess-weapp')
const { processWeappProjectConfig } = require('./postprocess-weapp-project')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const weappDistDir = path.resolve(__dirname, '../dist/weapp')
const verifyRoutesScript = path.resolve(__dirname, './verify-weapp-routes.js')
const verifyApiBaseScript = path.resolve(__dirname, './verify-weapp-api-base.js')
const preflightScript = path.resolve(__dirname, './preflight-weapp.js')
const preflightEnabled = readBool(process.env.WEAPP_PREFLIGHT_HTTP_SMOKE, true)
const preflightTimeoutMs = parsePositiveInt(process.env.WEAPP_PREFLIGHT_TIMEOUT_MS, 30000)

let lastWxssMtimeMs = -1
let lastAppJsonMtimeMs = -1

function readBool(rawValue, defaultValue) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return defaultValue
  }
  const value = rawValue.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(value)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(value)) {
    return false
  }
  return defaultValue
}

function parsePositiveInt(rawValue, fallback) {
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.floor(value)
}

function cleanWeappDist() {
  fs.rmSync(weappDistDir, { recursive: true, force: true })
  console.log(`[dev-weapp] cleaned ${weappDistDir}`)
}

function runPostprocess() {
  const wxssResult = processWeappWxss()
  if (wxssResult.status === 'updated') {
    console.log(
      `[dev-weapp] postprocessed app-origin.wxss, removed ${wxssResult.removed} rule(s)`
    )
  }
  const projectResult = processWeappProjectConfig()
  if (projectResult.status === 'updated') {
    console.log(`[dev-weapp] set appid to ${projectResult.appId}`)
  }
}

function runNodeScript(scriptPath, extraEnv) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  })

  if (result.status !== 0) {
    throw new Error(`script failed: ${path.basename(scriptPath)}`)
  }
}

function runBuildVerifications() {
  runNodeScript(verifyRoutesScript)
  runNodeScript(verifyApiBaseScript, { NODE_ENV: 'development' })
}

function runPreflightChecks() {
  if (!preflightEnabled) {
    console.log('[dev-weapp] WEAPP_PREFLIGHT_HTTP_SMOKE=false, skip preflight gate.')
    return
  }
  if (!fs.existsSync(preflightScript)) {
    throw new Error(`preflight script not found: ${path.relative(rootDir, preflightScript)}`)
  }

  console.log(`[dev-weapp] running preflight gate (timeout=${preflightTimeoutMs}ms)...`)
  const result = spawnSync(process.execPath, [preflightScript], {
    cwd: miniappDir,
    stdio: 'inherit',
    env: process.env,
    timeout: preflightTimeoutMs
  })

  if (result.error && result.error.code === 'ETIMEDOUT') {
    throw new Error(`preflight timed out after ${preflightTimeoutMs}ms`)
  }
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`preflight failed with status ${result.status}`)
  }
}

let child
const shutdown = (signal) => {
  if (child && !child.killed) {
    child.kill(signal)
  }
}

function exitWithFailure(message, error) {
  console.error(`[dev-weapp] ${message}`)
  if (error instanceof Error) {
    console.error(error.message)
  }
  shutdown('SIGTERM')
  process.exit(1)
}

function watchBuildArtifacts() {
  setInterval(() => {
    const appWxssPath = path.join(weappDistDir, 'app-origin.wxss')
    const appJsonPath = path.join(weappDistDir, 'app.json')

    try {
      const stats = fs.statSync(appWxssPath)
      if (stats.mtimeMs !== lastWxssMtimeMs) {
        lastWxssMtimeMs = stats.mtimeMs
        runPostprocess()
      }
    } catch {
      // build not ready yet
    }

    try {
      const stats = fs.statSync(appJsonPath)
      if (stats.mtimeMs !== lastAppJsonMtimeMs) {
        lastAppJsonMtimeMs = stats.mtimeMs
        runBuildVerifications()
      }
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return
      }
      exitWithFailure('verify build artifacts failed', error)
    }
  }, 700)
}

try {
  runPreflightChecks()
} catch (error) {
  exitWithFailure('preflight check failed', error)
}

cleanWeappDist()
watchBuildArtifacts()
runPostprocess()

child = spawn(
  'taro',
  ['build', '--type', 'weapp', '--no-check', '--watch'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development'
    }
  }
)

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
