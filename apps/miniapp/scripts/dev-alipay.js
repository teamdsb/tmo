const path = require('node:path')
const fs = require('node:fs')
const { spawn, spawnSync } = require('node:child_process')
const { buildModeEnv } = require('./miniapp-mode')

const miniappDir = path.resolve(__dirname, '..')
const requestedMode = process.argv[2] || 'dev'
const modeEnv = buildModeEnv(requestedMode, { TARO_ENV: 'alipay' })
const alipayDistDir = path.join(miniappDir, 'dist', 'alipay')
const postprocessScript = path.resolve(__dirname, './postprocess-alipay.js')
const verifyDistScript = path.resolve(__dirname, './verify-alipay-dist.js')
const verifyApiBaseScript = path.resolve(__dirname, './verify-miniapp-api-base.js')

let child
let lastAppAcssMtimeMs = -1
let lastAppJsonMtimeMs = -1
let lastVerifyKey = ''

function cleanAlipayDist() {
  fs.rmSync(alipayDistDir, { recursive: true, force: true })
  console.log(`[dev-alipay] cleaned ${alipayDistDir}`)
}

function runNodeScript(scriptPath, extraEnv = {}, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: miniappDir,
    stdio: 'inherit',
    env: {
      ...modeEnv,
      ...extraEnv
    }
  })

  if (result.status !== 0) {
    throw new Error(`script failed: ${path.basename(scriptPath)}`)
  }
}

function runPostprocess() {
  runNodeScript(postprocessScript)
}

function runBuildVerifications() {
  runNodeScript(verifyDistScript)
  runNodeScript(verifyApiBaseScript, { TARO_ENV: 'alipay' }, ['alipay'])
}

function exitWithFailure(message, error) {
  console.error(`[dev-alipay] ${message}`)
  if (error instanceof Error) {
    console.error(error.message)
  }
  if (child && !child.killed) {
    child.kill('SIGTERM')
  }
  process.exit(1)
}

function watchBuildArtifacts() {
  setInterval(() => {
    const appAcssPath = path.join(alipayDistDir, 'app.acss')
    const appJsonPath = path.join(alipayDistDir, 'app.json')

    try {
      const appAcssStats = fs.statSync(appAcssPath)
      if (appAcssStats.mtimeMs !== lastAppAcssMtimeMs) {
        lastAppAcssMtimeMs = appAcssStats.mtimeMs
        runPostprocess()
      }
    } catch {
      return
    }

    try {
      const appJsonStats = fs.statSync(appJsonPath)
      const verifyKey = `${lastAppAcssMtimeMs}:${appJsonStats.mtimeMs}`
      if (verifyKey !== lastVerifyKey) {
        lastAppJsonMtimeMs = appJsonStats.mtimeMs
        lastVerifyKey = verifyKey
        runBuildVerifications()
      }
    } catch (error) {
      exitWithFailure('verify build artifacts failed', error)
    }
  }, 700)
}

function shutdown(signal) {
  if (child && !child.killed) {
    child.kill(signal)
  }
}

try {
  Object.assign(process.env, modeEnv)
  console.log(`[dev-alipay] mode=${requestedMode} output=${alipayDistDir}`)
  cleanAlipayDist()
  watchBuildArtifacts()
  child = spawn(
    'pnpm',
    ['exec', 'taro', 'build', '--type', 'alipay', '--no-check', '--watch'],
    {
      cwd: miniappDir,
      stdio: 'inherit',
      env: modeEnv
    }
  )
} catch (error) {
  exitWithFailure('failed to start alipay watch', error)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('error', (error) => {
  exitWithFailure('watch process failed', error)
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
