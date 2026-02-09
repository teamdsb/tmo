const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const automator = require('miniprogram-automator')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')

const logsDir = path.join(miniappDir, '.logs', 'weapp')
const consoleLogPath = path.join(logsDir, 'console.jsonl')
const networkLogPath = path.join(logsDir, 'network.jsonl')
const summaryPath = path.join(logsDir, 'summary.md')
const screenshotDir = path.join(logsDir, 'failures')

const projectDir = path.resolve(process.env.WEAPP_PROJECT_DIR || path.join(miniappDir, 'dist', 'weapp'))
const automatorPort = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const automatorConnectTimeoutMs = Number(
  process.env.WEAPP_AUTOMATOR_CONNECT_TIMEOUT_MS
  || process.env.WEAPP_CDP_CONNECT_TIMEOUT_MS
  || 45000
)
const captureTimeoutMs = Number(process.env.WEAPP_DEBUG_TIMEOUT_MS || 90000)
const failOnError = readBool(process.env.WEAPP_FAIL_ON_ERROR, true)
const expectedBaseUrl = (process.env.WEAPP_BASE_URL_EXPECTED || 'http://localhost:8080').trim()
const skipBuild = readBool(process.env.WEAPP_SKIP_BUILD, false)
const skipLaunch = readBool(process.env.WEAPP_SKIP_LAUNCH, false)
const gatewayContainer = (process.env.WEAPP_GATEWAY_CONTAINER || 'dev-gateway-bff-1').trim()
const forceRelaunch = readBool(process.env.WEAPP_AUTOMATOR_FORCE_RELAUNCH, true)
const automatorRoute = ensureRoute(process.env.WEAPP_AUTOMATOR_ROUTE || '/pages/index/index')
const automatorAccount = (process.env.WEAPP_AUTOMATOR_ACCOUNT || '').trim()
const automatorTrustProject = readBool(process.env.WEAPP_AUTOMATOR_TRUST_PROJECT, true)

const keyEndpoints = ['/bff/bootstrap', '/catalog/categories', '/catalog/products']
const endpointState = new Map(
  keyEndpoints.map((endpoint) => [endpoint, { seen: false, ok: false, statuses: [], errors: [] }])
)

const envFilePath = path.join(miniappDir, '.env.development')
const envFileValues = parseEnvFile(envFilePath)

const warnings = []
const failures = []
const screenshotPaths = []

let consoleStream = null
let networkStream = null
let miniProgram = null

const automatorStats = {
  connected: false,
  launchMode: '',
  currentPage: '',
  pageStackSize: 0,
  routeSwitched: false,
  consoleCount: 0,
  consoleWarnCount: 0,
  consoleErrorCount: 0,
  exceptionCount: 0,
  requestWaitMs: captureTimeoutMs
}

const networkStats = {
  totalGatewayRequests: 0,
  matchedEndpointRequests: 0,
  parseErrors: 0
}

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

function ensureRoute(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return '/pages/index/index'
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizeRoutePath(value) {
  return String(value || '').replace(/^\/+/, '').split('?')[0]
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function appendFailure(message) {
  if (!failures.includes(message)) {
    failures.push(message)
  }
}

function appendWarning(message) {
  if (!warnings.includes(message)) {
    warnings.push(message)
  }
}

function writeJsonLine(stream, payload) {
  if (!stream || stream.destroyed || stream.writableEnded) {
    return
  }
  stream.write(`${JSON.stringify(payload)}\n`)
}

function stringifyValue(value) {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

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

    const idx = trimmed.indexOf('=')
    if (idx < 0) {
      continue
    }

    const key = trimmed.slice(0, idx).trim()
    if (!key) {
      continue
    }

    let value = trimmed.slice(idx + 1).trim()
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

function readConfigValue(name, fallback = '') {
  if (typeof process.env[name] === 'string' && process.env[name].trim() !== '') {
    return process.env[name].trim()
  }

  if (typeof envFileValues[name] === 'string' && envFileValues[name].trim() !== '') {
    return envFileValues[name].trim()
  }

  return fallback
}

function normalizeUrl(value) {
  return value.replace(/\/+$/, '')
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio || 'inherit',
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: 'utf8'
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`command failed: ${command} ${args.join(' ')}`)
  }

  return result
}

function assertRuntimeInputs() {
  const apiBaseUrl = readConfigValue('TARO_APP_API_BASE_URL')
  const commerceMockFallback = readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false')
  const enableMockLogin = readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')

  if (!apiBaseUrl) {
    throw new Error('TARO_APP_API_BASE_URL is empty. configure apps/miniapp/.env.development before debugging.')
  }

  if (expectedBaseUrl && normalizeUrl(apiBaseUrl) !== normalizeUrl(expectedBaseUrl)) {
    throw new Error(`TARO_APP_API_BASE_URL mismatch: expected ${expectedBaseUrl}, got ${apiBaseUrl}`)
  }

  if (readBool(commerceMockFallback, false)) {
    throw new Error('TARO_APP_COMMERCE_MOCK_FALLBACK=true is not allowed for full-stack debugging.')
  }

  if (readBool(enableMockLogin, false)) {
    appendWarning('TARO_APP_ENABLE_MOCK_LOGIN=true. mock login button may affect debugging flow.')
  }

  return {
    apiBaseUrl,
    commerceMockFallback,
    enableMockLogin
  }
}

function buildWeappDev() {
  if (skipBuild) {
    console.log('[weapp-cdp-debug] WEAPP_SKIP_BUILD=true, skip build step.')
    return
  }

  console.log('[weapp-cdp-debug] building weapp bundle with NODE_ENV=development...')
  runCommand('pnpm', ['run', 'build:weapp'], {
    cwd: miniappDir,
    env: { ...process.env, NODE_ENV: 'development' }
  })
}

function walkFiles(dirPath, matcher, output = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, matcher, output)
      continue
    }
    if (matcher(fullPath)) {
      output.push(fullPath)
    }
  }
  return output
}

function assertDistArtifacts() {
  if (!fs.existsSync(projectDir)) {
    throw new Error(`project dir not found: ${projectDir}`)
  }

  const jsFiles = walkFiles(projectDir, (filePath) => filePath.endsWith('.js'))
  if (jsFiles.length === 0) {
    throw new Error(`no js artifacts found under ${projectDir}`)
  }

  const blockedHostHits = []
  for (const filePath of jsFiles) {
    const content = fs.readFileSync(filePath, 'utf8')
    if (content.includes('api.example.com')) {
      blockedHostHits.push(path.relative(rootDir, filePath))
    }
  }

  if (blockedHostHits.length > 0) {
    throw new Error(
      `detected production placeholder host api.example.com in build output: ${blockedHostHits.join(', ')}`
    )
  }
}

function ensureProjectConfigForLocalDebug() {
  const projectConfigPath = path.join(projectDir, 'project.config.json')
  if (!fs.existsSync(projectConfigPath)) {
    appendWarning(`project.config.json missing under ${projectDir}`)
    return
  }

  let config = null
  try {
    config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
  } catch (error) {
    throw new Error(`failed to parse ${projectConfigPath}: ${error?.message || String(error)}`)
  }

  const setting = config.setting && typeof config.setting === 'object'
    ? config.setting
    : {}

  if (setting.urlCheck !== false) {
    setting.urlCheck = false
    config.setting = setting
    fs.writeFileSync(projectConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    appendWarning(`forced project.config.json setting.urlCheck=false for local debugging (${path.relative(rootDir, projectConfigPath)})`)
  }
}

function findCliPath() {
  const candidates = [
    process.env.WEAPP_DEVTOOLS_CLI_PATH,
    '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    '/Applications/微信开发者工具.app/Contents/MacOS/cli'
  ]

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  return ''
}

async function connectMiniProgram(cliPath) {
  if (skipLaunch) {
    automatorStats.launchMode = 'connect-existing'
    const wsEndpoint = `ws://127.0.0.1:${automatorPort}`
    writeJsonLine(consoleStream, {
      type: 'automator-connect',
      mode: automatorStats.launchMode,
      wsEndpoint,
      time: nowIso()
    })
    return automator.connect({ wsEndpoint })
  }

  if (!cliPath) {
    throw new Error('wechat devtools cli not found. set WEAPP_DEVTOOLS_CLI_PATH')
  }

  automatorStats.launchMode = 'launch-cli-auto'
  writeJsonLine(consoleStream, {
    type: 'automator-connect',
    mode: automatorStats.launchMode,
    cliPath,
    projectDir,
    automatorPort,
    account: automatorAccount,
    trustProject: automatorTrustProject,
    time: nowIso()
  })

  return automator.launch({
    cliPath,
    projectPath: projectDir,
    port: automatorPort,
    timeout: automatorConnectTimeoutMs,
    account: automatorAccount,
    trustProject: automatorTrustProject,
    cwd: rootDir
  })
}

function extractConsoleLevel(payload) {
  const level = String(payload?.level || payload?.type || '').trim().toLowerCase()
  if (!level) {
    return 'info'
  }
  if (level.includes('error')) {
    return 'error'
  }
  if (level.includes('warn')) {
    return 'warn'
  }
  if (level.includes('debug')) {
    return 'debug'
  }
  return level
}

function extractConsoleText(payload) {
  if (!payload || typeof payload !== 'object') {
    return stringifyValue(payload)
  }

  const textCandidates = [payload.text, payload.message, payload.description]
  for (const candidate of textCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  if (Array.isArray(payload.args) && payload.args.length > 0) {
    return payload.args.map((item) => stringifyValue(item)).join(' ')
  }

  return stringifyValue(payload)
}

function analyzeConsoleText(text) {
  const normalized = String(text || '')
  if (!normalized) {
    return
  }

  if (/request:fail\s+invalid\s+url/i.test(normalized)) {
    appendFailure(`invalid request url detected in miniapp console: ${normalized}`)
  }

  if (/url not in domain list/i.test(normalized)) {
    appendFailure(`request blocked by domain whitelist (urlCheck). message: ${normalized}`)
  }

  if (/api\.example\.com/i.test(normalized)) {
    appendFailure(`production placeholder host leaked into runtime request: ${normalized}`)
  }
}

function bindMiniProgramEvents() {
  if (!miniProgram) {
    return
  }

  miniProgram.on('console', (payload) => {
    const level = extractConsoleLevel(payload)
    const text = extractConsoleText(payload)

    automatorStats.consoleCount += 1
    if (level === 'warn') {
      automatorStats.consoleWarnCount += 1
    }
    if (level === 'error') {
      automatorStats.consoleErrorCount += 1
    }

    writeJsonLine(consoleStream, {
      type: 'miniapp-console',
      level,
      text,
      payload,
      time: nowIso()
    })

    analyzeConsoleText(text)
    if (level === 'error') {
      appendWarning(`miniapp console error: ${text}`)
    }
  })

  miniProgram.on('exception', (payload) => {
    automatorStats.exceptionCount += 1
    writeJsonLine(consoleStream, {
      type: 'miniapp-exception',
      payload,
      time: nowIso()
    })

    const text = extractConsoleText(payload)
    appendFailure(`miniapp runtime exception: ${text}`)
  })
}

async function warmupAndNavigate() {
  if (!miniProgram) {
    return
  }

  let pageStack = []
  try {
    pageStack = await miniProgram.pageStack()
    automatorStats.pageStackSize = pageStack.length
    writeJsonLine(consoleStream, {
      type: 'page-stack',
      size: pageStack.length,
      pages: pageStack.map((page) => ({
        id: page.id,
        path: page.path,
        query: page.query
      })),
      time: nowIso()
    })
  } catch (error) {
    appendWarning(`failed to read pageStack: ${error?.message || String(error)}`)
  }

  let currentPage = null
  try {
    currentPage = await miniProgram.currentPage()
  } catch (error) {
    appendWarning(`failed to read currentPage before reLaunch: ${error?.message || String(error)}`)
  }

  const routeTarget = automatorRoute
  const currentPath = normalizeRoutePath(currentPage?.path)
  const targetPath = normalizeRoutePath(routeTarget)

  if (forceRelaunch || !currentPath || currentPath !== targetPath) {
    try {
      currentPage = await miniProgram.reLaunch(routeTarget)
      automatorStats.routeSwitched = true
      writeJsonLine(consoleStream, {
        type: 'route-switch',
        route: routeTarget,
        success: true,
        time: nowIso()
      })
    } catch (error) {
      appendWarning(`failed to reLaunch ${routeTarget}: ${error?.message || String(error)}`)
    }
  }

  await sleep(1500)

  try {
    currentPage = await miniProgram.currentPage()
    automatorStats.currentPage = currentPage?.path || ''
    writeJsonLine(consoleStream, {
      type: 'current-page',
      page: currentPage
        ? {
            id: currentPage.id,
            path: currentPage.path,
            query: currentPage.query
          }
        : null,
      time: nowIso()
    })
  } catch (error) {
    appendWarning(`failed to read currentPage after reLaunch: ${error?.message || String(error)}`)
  }

  if (currentPage) {
    try {
      const data = await currentPage.data()
      const preview = stringifyValue(data).slice(0, 2000)
      writeJsonLine(consoleStream, {
        type: 'current-page-data',
        path: currentPage.path,
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        preview,
        time: nowIso()
      })
    } catch (error) {
      appendWarning(`failed to read currentPage data: ${error?.message || String(error)}`)
    }
  }
}

function parseGatewayLine(line) {
  if (!line.startsWith('{')) {
    return null
  }

  let payload = null
  try {
    payload = JSON.parse(line)
  } catch {
    networkStats.parseErrors += 1
    return null
  }

  if (payload?.msg !== 'http request') {
    return null
  }

  const method = String(payload.method || '')
  const pathValue = String(payload.path || '')
  const status = Number(payload.status || 0)
  const durationMs = Number(payload.duration_ms || 0)

  return {
    method,
    path: pathValue,
    status,
    durationMs,
    requestId: String(payload.request_id || ''),
    time: String(payload.time || nowIso())
  }
}

function updateEndpointState(pathValue, status) {
  for (const endpoint of keyEndpoints) {
    if (!pathValue.includes(endpoint)) {
      continue
    }

    networkStats.matchedEndpointRequests += 1
    const state = endpointState.get(endpoint)
    if (!state) {
      continue
    }

    state.seen = true
    state.statuses.push(status)
    if (status >= 200 && status < 400) {
      state.ok = true
    } else {
      state.errors.push(`status ${status}`)
    }
  }
}

function collectGatewayLogs(startedAtIso) {
  const hasDocker = spawnSync('docker', ['ps'], { stdio: 'ignore' }).status === 0
  if (!hasDocker) {
    appendWarning('docker command unavailable, skip gateway request capture')
    return
  }

  const logsResult = spawnSync(
    'docker',
    ['logs', '--since', startedAtIso, gatewayContainer],
    { encoding: 'utf8' }
  )

  if (logsResult.status !== 0) {
    appendWarning(
      `failed to read gateway logs from container ${gatewayContainer}: ${logsResult.stderr || logsResult.stdout || 'unknown error'}`
    )
    return
  }

  const content = `${logsResult.stdout || ''}${logsResult.stderr || ''}`
  const lines = content.split(/\r?\n/).filter(Boolean)

  for (const line of lines) {
    const parsed = parseGatewayLine(line)
    if (!parsed) {
      continue
    }

    networkStats.totalGatewayRequests += 1
    updateEndpointState(parsed.path, parsed.status)

    writeJsonLine(networkStream, {
      type: 'gateway-request',
      method: parsed.method,
      path: parsed.path,
      status: parsed.status,
      durationMs: parsed.durationMs,
      requestId: parsed.requestId,
      time: parsed.time
    })
  }
}

function finalizeEndpointValidation() {
  for (const [endpoint, state] of endpointState.entries()) {
    if (!state.seen) {
      appendFailure(`${endpoint} was not observed in gateway logs during capture window`)
      continue
    }

    if (!state.ok) {
      appendFailure(`${endpoint} has no successful response, statuses: ${state.statuses.join(', ')}`)
    }
  }
}

async function captureScreenshot(name) {
  const fileName = `${nowIso().replace(/[:.]/g, '-')}-${name}.png`
  const filePath = path.join(screenshotDir, fileName)

  if (miniProgram && typeof miniProgram.screenshot === 'function') {
    try {
      await miniProgram.screenshot({ path: filePath })
      if (fs.existsSync(filePath)) {
        screenshotPaths.push(path.relative(rootDir, filePath))
        return
      }
    } catch (error) {
      appendWarning(`automator screenshot failed (${name}): ${error?.message || String(error)}`)
    }
  }

  if (process.platform !== 'darwin') {
    return
  }

  const tool = '/usr/sbin/screencapture'
  if (!fs.existsSync(tool)) {
    return
  }

  const result = spawnSync(tool, ['-x', filePath], { encoding: 'utf8' })
  if (result.status === 0 && fs.existsSync(filePath)) {
    screenshotPaths.push(path.relative(rootDir, filePath))
  } else {
    appendWarning(`screenshot capture failed (${name})`)
  }
}

function buildSummary(runtimeInfo, startedAt, finishedAt) {
  const endpointLines = [
    '| endpoint | seen | ok | statuses | errors |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const [endpoint, state] of endpointState.entries()) {
    endpointLines.push(
      `| ${endpoint} | ${state.seen ? 'yes' : 'no'} | ${state.ok ? 'yes' : 'no'} | `
        + `${state.statuses.length > 0 ? state.statuses.join(', ') : '-'} | `
        + `${state.errors.length > 0 ? state.errors.join('; ') : '-'} |`
    )
  }

  const summary = [
    '# Weapp CDP Debug Summary',
    '',
    '- mode: miniprogram-automator + gateway-log-capture',
    `- startedAt: ${startedAt}`,
    `- finishedAt: ${finishedAt}`,
    `- automatorPort: ${automatorPort}`,
    `- automatorConnectTimeoutMs: ${automatorConnectTimeoutMs}`,
    `- timeoutMs: ${captureTimeoutMs}`,
    `- projectDir: ${projectDir}`,
    `- expectedBaseUrl: ${expectedBaseUrl}`,
    `- taroAppApiBaseUrl: ${runtimeInfo.apiBaseUrl}`,
    `- taroAppCommerceMockFallback: ${runtimeInfo.commerceMockFallback}`,
    `- taroAppEnableMockLogin: ${runtimeInfo.enableMockLogin}`,
    '',
    '## Automator Stats',
    '',
    `- connected: ${automatorStats.connected}`,
    `- launch mode: ${automatorStats.launchMode || '-'}`,
    `- current page: ${automatorStats.currentPage || '-'}`,
    `- page stack size: ${automatorStats.pageStackSize}`,
    `- route switched: ${automatorStats.routeSwitched}`,
    `- console count: ${automatorStats.consoleCount}`,
    `- console warn count: ${automatorStats.consoleWarnCount}`,
    `- console error count: ${automatorStats.consoleErrorCount}`,
    `- exception count: ${automatorStats.exceptionCount}`,
    `- request wait ms: ${automatorStats.requestWaitMs}`,
    '',
    '## Network Stats',
    '',
    `- gateway container: ${gatewayContainer}`,
    `- gateway requests captured: ${networkStats.totalGatewayRequests}`,
    `- key endpoint requests: ${networkStats.matchedEndpointRequests}`,
    `- parse errors: ${networkStats.parseErrors}`,
    '',
    '## Endpoint Status',
    '',
    ...endpointLines,
    '',
    '## Failures',
    ''
  ]

  if (failures.length === 0) {
    summary.push('- none')
  } else {
    for (const item of failures) {
      summary.push(`- ${item}`)
    }
  }

  summary.push('', '## Warnings', '')
  if (warnings.length === 0) {
    summary.push('- none')
  } else {
    for (const item of warnings) {
      summary.push(`- ${item}`)
    }
  }

  summary.push('', '## Artifacts', '')
  summary.push(`- console: ${path.relative(rootDir, consoleLogPath)}`)
  summary.push(`- network: ${path.relative(rootDir, networkLogPath)}`)
  summary.push(`- summary: ${path.relative(rootDir, summaryPath)}`)

  for (const screenshotPath of screenshotPaths) {
    summary.push(`- screenshot: ${screenshotPath}`)
  }

  summary.push('')
  fs.writeFileSync(summaryPath, summary.join('\n'), 'utf8')
}

async function cleanup() {
  if (miniProgram) {
    try {
      await miniProgram.close()
    } catch {
      try {
        miniProgram.disconnect()
      } catch {
        // ignore cleanup errors
      }
    }
    miniProgram = null
  }

  if (consoleStream) {
    consoleStream.end()
    consoleStream = null
  }

  if (networkStream) {
    networkStream.end()
    networkStream = null
  }
}

async function main() {
  ensureDir(logsDir)
  ensureDir(screenshotDir)

  consoleStream = fs.createWriteStream(consoleLogPath)
  networkStream = fs.createWriteStream(networkLogPath)

  const startedAt = nowIso()
  let finishedAt = startedAt
  let runtimeInfo = null

  try {
    runtimeInfo = assertRuntimeInputs()
    buildWeappDev()
    assertDistArtifacts()
    ensureProjectConfigForLocalDebug()

    const cliPath = findCliPath()
    if (!skipLaunch && !cliPath) {
      throw new Error('wechat devtools cli not found. set WEAPP_DEVTOOLS_CLI_PATH')
    }

    miniProgram = await connectMiniProgram(cliPath)
    automatorStats.connected = true

    bindMiniProgramEvents()
    await warmupAndNavigate()

    await sleep(Math.max(8000, captureTimeoutMs))

    collectGatewayLogs(startedAt)
    finalizeEndpointValidation()

    if (failures.length > 0) {
      await captureScreenshot('failure')
    } else {
      await captureScreenshot('success')
    }
  } catch (error) {
    appendFailure(error?.message || String(error))

    if (!runtimeInfo) {
      runtimeInfo = {
        apiBaseUrl: readConfigValue('TARO_APP_API_BASE_URL'),
        commerceMockFallback: readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false'),
        enableMockLogin: readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')
      }
    }

    await captureScreenshot('fatal')
  } finally {
    finishedAt = nowIso()
    buildSummary(runtimeInfo, startedAt, finishedAt)
    await cleanup()
  }

  if (failures.length > 0) {
    console.error(`[weapp-cdp-debug] failed. summary: ${summaryPath}`)
    if (failOnError) {
      process.exit(1)
    }
  }

  console.log(`[weapp-cdp-debug] completed. summary: ${summaryPath}`)
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(130)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(143)
})

main().catch(async (error) => {
  appendFailure(error?.message || String(error))
  try {
    buildSummary(
      {
        apiBaseUrl: readConfigValue('TARO_APP_API_BASE_URL'),
        commerceMockFallback: readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false'),
        enableMockLogin: readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')
      },
      nowIso(),
      nowIso()
    )
  } catch {
    // ignore secondary errors
  }
  await cleanup()
  console.error(`[weapp-cdp-debug] fatal: ${error?.message || String(error)}`)
  process.exit(1)
})
