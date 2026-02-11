const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const smokeScript = path.resolve(rootDir, 'tools/scripts/miniapp-http-smoke.sh')
const diagnoseScript = path.resolve(rootDir, 'tools/scripts/dev-diagnose-db.sh')
const preflightResultPath = path.resolve(miniappDir, '.logs', 'preflight', 'result.json')
const preflightSchemaVersion = 'miniapp-preflight/v1'
const preflightRunId = `${Date.now()}-${process.pid}`

const parsePositiveInt = (raw, fallback) => {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.floor(value)
}

const timeoutMs = parsePositiveInt(process.env.WEAPP_PREFLIGHT_TIMEOUT_MS, 30000)
const runDiagnoseOnFail = process.env.WEAPP_PREFLIGHT_RUN_DIAG !== 'false'

const ensureResultDir = () => {
  fs.mkdirSync(path.dirname(preflightResultPath), { recursive: true })
}

const writeResult = (payload) => {
  ensureResultDir()
  const normalized = {
    schemaVersion: preflightSchemaVersion,
    runId: preflightRunId,
    ...payload
  }
  fs.writeFileSync(preflightResultPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

const toEndpointFromLabel = (label) => {
  const value = String(label || '').trim().toLowerCase()
  if (value.includes('bootstrap')) return '/bff/bootstrap'
  if (value.includes('categories')) return '/catalog/categories'
  if (value.includes('products')) return '/catalog/products'
  if (value.includes('assets')) return '/product-requests/assets'
  return null
}

const parseSmokeFailure = (output) => {
  const content = String(output || '')
  const failedLine = content.match(/\[miniapp-http-smoke\]\s+(.+?)\s+failed:\s*(\d{3})/i)
  const requestIdMatch = content.match(/"requestId"\s*:\s*"([^"]+)"/i)

  if (!failedLine) {
    return {
      endpoint: null,
      statusCode: null,
      requestId: requestIdMatch ? requestIdMatch[1] : null
    }
  }

  const label = failedLine[1]
  const statusCode = Number(failedLine[2])

  return {
    endpoint: toEndpointFromLabel(label),
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    requestId: requestIdMatch ? requestIdMatch[1] : null
  }
}

const parseDiagnoseSummary = (output) => {
  const content = String(output || '')
  const matches = content.match(/\[dev-diagnose-db\]\s+diagnosis:\s*(.+)/g) || []
  if (matches.length === 0) {
    return []
  }

  const unique = new Set()
  for (const line of matches) {
    const match = line.match(/\[dev-diagnose-db\]\s+diagnosis:\s*(.+)/)
    if (!match) {
      continue
    }
    unique.add(match[1].trim())
  }
  return [...unique]
}

const runShell = (scriptPath, timeout, extraEnv = {}) => {
  const result = spawnSync('bash', [scriptPath], {
    cwd: miniappDir,
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      ...extraEnv,
      MINIAPP_HTTP_SMOKE_ALLOW_EMPTY_PRODUCTS: process.env.MINIAPP_HTTP_SMOKE_ALLOW_EMPTY_PRODUCTS || 'true'
    },
    timeout
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim()
  return { result, output }
}

if (!fs.existsSync(smokeScript)) {
  console.error(`[preflight-weapp] smoke script not found: ${smokeScript}`)
  writeResult({
    status: 'fail',
    timestamp: new Date().toISOString(),
    failedEndpoint: null,
    statusCode: null,
    requestId: null,
    diagnoseRan: false,
    diagnoseSummary: ['smoke script not found'],
    exitCode: 1,
    timedOut: false
  })
  process.exit(1)
}

console.log(`[preflight-weapp] running miniapp HTTP smoke (timeout=${timeoutMs}ms)...`)
const smokeRun = runShell(smokeScript, timeoutMs)
const smokeResult = smokeRun.result
const smokeExitCode = typeof smokeResult.status === 'number' ? smokeResult.status : 1
const smokeFailure = parseSmokeFailure(smokeRun.output)
let diagnoseRan = false
let diagnoseSummary = []

if (smokeResult.error && smokeResult.error.code === 'ETIMEDOUT') {
  console.error(`[preflight-weapp] miniapp HTTP smoke timed out after ${timeoutMs}ms.`)
} else if (smokeResult.error) {
  console.error(`[preflight-weapp] miniapp HTTP smoke failed to execute: ${smokeResult.error.message}`)
}

if (smokeExitCode !== 0 || smokeResult.error) {
  if (runDiagnoseOnFail && fs.existsSync(diagnoseScript)) {
    console.error('[preflight-weapp] smoke failed, running DB diagnosis...')
    diagnoseRan = true
    const diagnoseRun = runShell(diagnoseScript)
    diagnoseSummary = parseDiagnoseSummary(diagnoseRun.output)
  }
  writeResult({
    status: 'fail',
    timestamp: new Date().toISOString(),
    failedEndpoint: smokeFailure.endpoint,
    statusCode: smokeFailure.statusCode,
    requestId: smokeFailure.requestId,
    diagnoseRan,
    diagnoseSummary,
    exitCode: smokeExitCode,
    timedOut: smokeResult.error?.code === 'ETIMEDOUT'
  })
  console.error(`[preflight-weapp] result written to ${preflightResultPath}`)
  process.exit(smokeExitCode)
}

writeResult({
  status: 'pass',
  timestamp: new Date().toISOString(),
  failedEndpoint: null,
  statusCode: null,
  requestId: null,
  diagnoseRan,
  diagnoseSummary,
  exitCode: 0,
  timedOut: false
})
console.log(`[preflight-weapp] result written to ${preflightResultPath}`)
console.log('[preflight-weapp] passed.')
