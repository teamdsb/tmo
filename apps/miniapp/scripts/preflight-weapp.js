const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const smokeScript = path.resolve(rootDir, 'tools/scripts/miniapp-http-smoke.sh')
const diagnoseScript = path.resolve(rootDir, 'tools/scripts/dev-diagnose-db.sh')

const parsePositiveInt = (raw, fallback) => {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.floor(value)
}

const timeoutMs = parsePositiveInt(process.env.WEAPP_PREFLIGHT_TIMEOUT_MS, 30000)
const runDiagnoseOnFail = process.env.WEAPP_PREFLIGHT_RUN_DIAG !== 'false'

const runShell = (scriptPath, timeout) => {
  return spawnSync('bash', [scriptPath], {
    cwd: miniappDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      MINIAPP_HTTP_SMOKE_ALLOW_EMPTY_PRODUCTS: process.env.MINIAPP_HTTP_SMOKE_ALLOW_EMPTY_PRODUCTS || 'true'
    },
    timeout
  })
}

if (!fs.existsSync(smokeScript)) {
  console.error(`[preflight-weapp] smoke script not found: ${smokeScript}`)
  process.exit(1)
}

console.log(`[preflight-weapp] running miniapp HTTP smoke (timeout=${timeoutMs}ms)...`)
const smokeResult = runShell(smokeScript, timeoutMs)
const smokeExitCode = typeof smokeResult.status === 'number' ? smokeResult.status : 1

if (smokeResult.error && smokeResult.error.code === 'ETIMEDOUT') {
  console.error(`[preflight-weapp] miniapp HTTP smoke timed out after ${timeoutMs}ms.`)
} else if (smokeResult.error) {
  console.error(`[preflight-weapp] miniapp HTTP smoke failed to execute: ${smokeResult.error.message}`)
}

if (smokeExitCode !== 0 || smokeResult.error) {
  if (runDiagnoseOnFail && fs.existsSync(diagnoseScript)) {
    console.error('[preflight-weapp] smoke failed, running DB diagnosis...')
    runShell(diagnoseScript)
  }
  process.exit(smokeExitCode)
}

console.log('[preflight-weapp] passed.')
