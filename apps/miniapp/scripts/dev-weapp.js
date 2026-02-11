const path = require('node:path')
const fs = require('node:fs')
const { spawn, spawnSync } = require('node:child_process')
const { processWeappWxss } = require('./postprocess-weapp')
const { processWeappProjectConfig } = require('./postprocess-weapp-project')

const weappDistDir = path.resolve(__dirname, '../dist/weapp')
const verifyRoutesScript = path.resolve(__dirname, './verify-weapp-routes.js')
const verifyApiBaseScript = path.resolve(__dirname, './verify-weapp-api-base.js')

let lastWxssMtimeMs = -1
let lastAppJsonMtimeMs = -1

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
