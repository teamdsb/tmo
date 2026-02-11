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
const runJsonPath = path.join(logsDir, 'run.json')
const screenshotDir = path.join(logsDir, 'failures')
const runSchemaVersion = 'weapp-automator-run/v1'
const eventSchemaVersion = 'weapp-automator-event/v1'
const runId = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2, 8)}`
const routeRunId = runId
let eventSeq = 0

const projectDir = path.resolve(process.env.WEAPP_PROJECT_DIR || path.join(miniappDir, 'dist', 'weapp'))
const automatorPort = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const automatorConnectTimeoutMs = Number(
  process.env.WEAPP_AUTOMATOR_CONNECT_TIMEOUT_MS
  || process.env.WEAPP_CDP_CONNECT_TIMEOUT_MS
  || 45000
)
const captureTimeoutMs = Number(process.env.WEAPP_DEBUG_TIMEOUT_MS || 90000)
const failOnError = readBool(process.env.WEAPP_FAIL_ON_ERROR, true)
const strictP1 = readBool(process.env.WEAPP_STRICT_P1, true)
const expectedBaseUrl = (process.env.WEAPP_BASE_URL_EXPECTED || 'http://localhost:8080').trim()
const skipBuild = readBool(process.env.WEAPP_SKIP_BUILD, false)
const skipLaunch = readBool(process.env.WEAPP_SKIP_LAUNCH, false)
const gatewayContainer = (process.env.WEAPP_GATEWAY_CONTAINER || 'dev-gateway-bff-1').trim()
const forceRelaunch = readBool(process.env.WEAPP_AUTOMATOR_FORCE_RELAUNCH, true)
const automatorRoute = ensureRoute(process.env.WEAPP_AUTOMATOR_ROUTE || '/pages/index/index')
const automatorAccount = (process.env.WEAPP_AUTOMATOR_ACCOUNT || '').trim()
const automatorTrustProject = readBool(process.env.WEAPP_AUTOMATOR_TRUST_PROJECT, true)
const smokeSpuId = (process.env.WEAPP_SMOKE_SPU_ID || '22222222-2222-2222-2222-222222222222').trim()
const smokeAssertMinProducts = Number(process.env.WEAPP_SMOKE_ASSERT_MIN_PRODUCTS || 0)
const smokeAssertCategoryMin = Number(process.env.WEAPP_SMOKE_ASSERT_CATEGORY_MIN || 0)
const smokeAssertImageSuccessMin = Number(process.env.WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN || 0)
const smokeAssertNoConsoleError = readBool(process.env.WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR, true)
const smokeRouteWaitMs = Number(process.env.WEAPP_SMOKE_ROUTE_WAIT_MS || 8000)
const warningAllowlistRaw = String(process.env.WEAPP_WARNING_ALLOWLIST || '')
const defaultWarningAllowlistPatterns = [
  '\\[deprecation\\]',
  'sharedarraybuffer will require cross-origin isolation',
  'getsysteminfo\\s*api\\s*提示',
  '正在使用灰度中的基础库',
  '文章推荐',
  '工具未校验合法域名'
]
const warningAllowlist = compileWarningAllowlist(warningAllowlistRaw, defaultWarningAllowlistPatterns)
const assertionConfig = {
  minProducts: toNonNegativeInt(smokeAssertMinProducts, 1),
  minCategories: toNonNegativeInt(smokeAssertCategoryMin, 1),
  minImageSuccess: toNonNegativeInt(smokeAssertImageSuccessMin, 1),
  assertNoConsoleError: smokeAssertNoConsoleError,
  routeWaitMs: toNonNegativeInt(smokeRouteWaitMs, 8000)
}
const defaultSmokeRoutes = [
  '/pages/index/index',
  '/pages/category/index',
  '/pages/goods/search/index',
  `/pages/goods/detail/index?id=${encodeURIComponent(smokeSpuId)}`
]
const multiRouteChild = readBool(process.env.WEAPP_MULTI_CHILD, false)
const automatorRoutes = parseRoutes(process.env.WEAPP_AUTOMATOR_ROUTES || '')

const keyEndpoints = ['/bff/bootstrap', '/catalog/categories', '/catalog/products']
const imageEndpoint = '/assets/img'
const mediaEndpoint = '/assets/media/'
const endpointState = new Map(
  keyEndpoints.map((endpoint) => [endpoint, {
    seen: false,
    ok: false,
    statuses: [],
    errors: [],
    successCount: 0,
    lastRequestId: '',
    lastFailureRequestId: '',
    lastFailureStatus: 0
  }])
)
const imageProxyState = {
  seen: false,
  ok: false,
  statuses: [],
  errors: [],
  successCount: 0,
  endpointCounts: {
    [imageEndpoint]: { total: 0, success: 0 },
    [mediaEndpoint]: { total: 0, success: 0 }
  }
}

const envFilePath = path.join(miniappDir, '.env.development')
const envFileValues = parseEnvFile(envFilePath)

const warnings = []
const suppressedWarnings = []
const suppressedWarningPatternCounts = new Map()
const failures = []
const screenshotPaths = []
const severityIssues = {
  p0: [],
  p1: [],
  p2: []
}
const assertionState = {
  routeAssertions: [],
  networkAssertions: [],
  renderAssertions: []
}
const routeSnapshot = {
  route: automatorRoute,
  pagePath: '',
  pageQuery: {},
  data: null,
  dataKeys: []
}
const runtimeDiagnostics = {
  systemInfo: null,
  systemInfoCaptureError: '',
  pageDataPoll: {
    attempts: 0,
    ready: false,
    elapsedMs: 0,
    lastKeys: []
  }
}

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
  imageProxyRequests: 0,
  imageSuccessRequests: 0,
  parseErrors: 0,
  rawLogLines: 0,
  parsedGatewayLines: 0,
  skippedGatewayLines: 0,
  captureSince: '',
  captureUntil: '',
  firstRequestAt: '',
  lastRequestAt: ''
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

function toNonNegativeInt(raw, defaultValue) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) {
    return defaultValue
  }
  return Math.floor(value)
}

function ensureRoute(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return '/pages/index/index'
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function parseRoutes(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) {
    return []
  }

  const seen = new Set()
  const routes = []
  for (const token of raw.split(/[\n,]/)) {
    const route = ensureRoute(token)
    if (!route || seen.has(route)) {
      continue
    }
    seen.add(route)
    routes.push(route)
  }
  return routes
}

function parseAllowlistTokens(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) {
    return []
  }

  const values = []
  for (const token of raw.split(/[\n,]/)) {
    const value = token.trim()
    if (!value) {
      continue
    }
    values.push(value)
  }
  return values
}

function compileWarningAllowlist(rawValue, defaults = []) {
  const tokens = [...defaults, ...parseAllowlistTokens(rawValue)]
  if (tokens.length === 0) {
    return []
  }

  const seen = new Set()
  const list = []

  for (const token of tokens) {
    if (seen.has(token)) {
      continue
    }
    seen.add(token)
    try {
      list.push({
        pattern: token,
        regex: new RegExp(token, 'i')
      })
    } catch {
      // ignore invalid regex tokens
    }
  }

  return list
}

function routeToSlug(route) {
  return String(route || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/[/?&=:#]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'route'
}

function normalizeRoutePath(value) {
  return String(value || '').replace(/^\/+/, '').split('?')[0]
}

function routeKind(routePath) {
  const normalized = normalizeRoutePath(routePath)
  if (normalized === 'pages/index/index') {
    return 'home'
  }
  if (normalized === 'pages/category/index') {
    return 'category'
  }
  if (normalized === 'pages/goods/detail/index') {
    return 'detail'
  }
  return 'other'
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function walkNodes(root, visitor, maxDepth = 5) {
  const queue = [{ value: root, depth: 0 }]
  const seen = new Set()
  while (queue.length > 0) {
    const node = queue.shift()
    const value = node.value
    const depth = node.depth
    if (!value || depth > maxDepth) {
      continue
    }
    if (typeof value === 'object') {
      if (seen.has(value)) {
        continue
      }
      seen.add(value)
    }

    visitor(value, depth)

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, depth: depth + 1 })
      }
      continue
    }

    if (isPlainObject(value)) {
      for (const child of Object.values(value)) {
        queue.push({ value: child, depth: depth + 1 })
      }
    }
  }
}

function inferProductsCount(data) {
  if (!isPlainObject(data)) {
    return 0
  }
  const candidates = ['products', 'productList', 'items', 'list', 'hotProducts']
  for (const key of candidates) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value.length
    }
  }

  let best = 0
  walkNodes(data, (node) => {
    if (!Array.isArray(node) || node.length === 0) {
      return
    }
    const first = node[0]
    if (!isPlainObject(first)) {
      return
    }
    if (!('id' in first) || !('name' in first)) {
      return
    }
    if (!('coverImageUrl' in first) && !('tags' in first)) {
      return
    }
    best = Math.max(best, node.length)
  })
  return best
}

function inferCategoriesCount(data) {
  if (!isPlainObject(data)) {
    return 0
  }
  const candidates = ['categories', 'categoryList', 'tabs', 'categoryTabs']
  for (const key of candidates) {
    const value = data[key]
    if (Array.isArray(value)) {
      return value.length
    }
  }

  let best = 0
  walkNodes(data, (node) => {
    if (!Array.isArray(node) || node.length === 0) {
      return
    }
    const first = node[0]
    if (!isPlainObject(first)) {
      return
    }
    if (!('id' in first) || !('name' in first)) {
      return
    }
    best = Math.max(best, node.length)
  })
  return best
}

function inferDetailProduct(data) {
  const empty = { id: '', imageUrl: '' }
  if (!isPlainObject(data)) {
    return empty
  }

  const directCandidates = ['product', 'detail', 'item', 'goods']
  for (const key of directCandidates) {
    const value = data[key]
    if (!isPlainObject(value)) {
      continue
    }
    const id = String(value.id || '').trim()
    const imageUrl = firstImageURL(value)
    if (id || imageUrl) {
      return { id, imageUrl }
    }
  }

  let fallback = empty
  walkNodes(data, (node) => {
    if (!isPlainObject(node)) {
      return
    }
    const id = String(node.id || '').trim()
    const imageUrl = firstImageURL(node)
    if (!id && !imageUrl) {
      return
    }
    if (!fallback.id && id) {
      fallback.id = id
    }
    if (!fallback.imageUrl && imageUrl) {
      fallback.imageUrl = imageUrl
    }
  })
  return fallback
}

function firstImageURL(payload) {
  if (!isPlainObject(payload)) {
    return ''
  }
  const cover = String(payload.coverImageUrl || '').trim()
  if (cover) {
    return cover
  }
  if (Array.isArray(payload.images)) {
    for (const value of payload.images) {
      const image = String(value || '').trim()
      if (image) {
        return image
      }
    }
  }
  return ''
}

function isRouteDataInspectable(data, dataKeys) {
  if (!isPlainObject(data)) {
    return false
  }

  const keys = Array.isArray(dataKeys)
    ? dataKeys
      .filter((key) => typeof key === 'string')
      .map((key) => key.trim())
      .filter(Boolean)
    : []

  if (keys.length === 0) {
    return false
  }

  if (keys.length === 1 && keys[0] === 'root') {
    return false
  }

  return true
}

function isGatewayImageURL(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return false
  }
  return raw.includes('/assets/img?url=') || raw.includes('/assets/media/')
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
  appendSeverityIssue('p0', message)
  if (!failures.includes(message)) {
    failures.push(message)
  }
}

function appendP1Issue(message) {
  appendSeverityIssue('p1', message)
  if (strictP1) {
    if (!failures.includes(message)) {
      failures.push(message)
    }
    return
  }

  if (!warnings.includes(`[P1] ${message}`)) {
    warnings.push(`[P1] ${message}`)
  }
}

function appendWarning(message) {
  appendSeverityIssue('p2', message)
  if (!warnings.includes(message)) {
    warnings.push(message)
  }
}

function matchWarningAllowlist(message) {
  const text = String(message || '')
  if (!text) {
    return null
  }

  for (const item of warningAllowlist) {
    if (item.regex.test(text)) {
      return item
    }
  }
  return null
}

function recordSuppressedWarning(message, item, level = 'warn') {
  if (!item || !item.pattern) {
    return
  }

  const text = clipText(message, 320)
  const pattern = item.pattern
  suppressedWarnings.push({ pattern, level, text })
  suppressedWarningPatternCounts.set(pattern, (suppressedWarningPatternCounts.get(pattern) || 0) + 1)
  writeJsonLine(consoleStream, {
    type: 'suppressed-warning',
    pattern,
    level,
    text,
    time: nowIso()
  }, 'console')
}

function appendSeverityIssue(level, message) {
  const bucket = severityIssues[level]
  if (!bucket) {
    return
  }
  if (!bucket.includes(message)) {
    bucket.push(message)
  }
}

function assertionBucket(scope) {
  switch (scope) {
    case 'network':
      return assertionState.networkAssertions
    case 'render':
      return assertionState.renderAssertions
    default:
      return assertionState.routeAssertions
  }
}

function addAssertion(scope, key, passed, severity, evidence) {
  const bucket = assertionBucket(scope)
  bucket.push({
    key,
    passed,
    severity,
    evidence: clipText(evidence || '-', 400)
  })
}

function assertCheck(scope, key, condition, options = {}) {
  const passed = Boolean(condition)
  const severity = options.severity || 'p1'
  const evidence = options.evidence || ''
  const failMessage = options.failMessage || `${scope} assertion failed: ${key}`

  addAssertion(scope, key, passed, severity, evidence)
  if (passed) {
    return true
  }

  const withEvidence = evidence ? `${failMessage} (evidence: ${clipText(evidence, 300)})` : failMessage
  if (severity === 'p0') {
    appendFailure(withEvidence)
  } else if (severity === 'p2') {
    appendWarning(withEvidence)
  } else {
    appendP1Issue(withEvidence)
  }
  return false
}

function writeJsonLine(stream, payload, channel = 'general') {
  if (!stream || stream.destroyed || stream.writableEnded) {
    return
  }
  const emittedAt = nowIso()
  const base = {
    schemaVersion: eventSchemaVersion,
    runId,
    routeRunId,
    seq: ++eventSeq,
    channel,
    route: routeSnapshot.route || automatorRoute,
    emittedAt
  }

  const merged = {
    ...base,
    ...payload
  }

  if (!merged.time) {
    merged.time = emittedAt
  }

  stream.write(`${JSON.stringify(merged)}\n`)
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

function clipText(value, maxLength = 320) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}...`
}

function topSuppressedPatterns(limit = 5) {
  if (suppressedWarningPatternCounts.size === 0) {
    return []
  }

  return [...suppressedWarningPatternCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1]
      }
      return a[0].localeCompare(b[0])
    })
    .slice(0, Math.max(0, limit))
    .map(([pattern, count]) => ({ pattern, count }))
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

function copyArtifactIfExists(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return false
  }
  fs.copyFileSync(sourcePath, targetPath)
  return true
}

function extractSummaryMetrics(content) {
  const parseCount = (pattern) => {
    const match = content.match(pattern)
    if (!match) {
      return 0
    }
    return Number(match[1] || 0)
  }

  const parseText = (pattern) => {
    const match = content.match(pattern)
    if (!match) {
      return ''
    }
    return String(match[1] || '').trim()
  }

  return {
    p0: parseCount(/- P0 blocking issues:\s*(\d+)/),
    p1: parseCount(/- P1 blocking issues:\s*(\d+)/),
    p2: parseCount(/- P2 warning issues:\s*(\d+)/),
    assertionFailedCount: parseCount(/- assertion failed count:\s*(\d+)/),
    assertionFailedKeys: parseText(/- assertion failed keys:\s*(.+)/),
    firstFailingEndpoint: parseText(/- first failing endpoint:\s*(.+)/),
    firstFailingEndpointStatus: parseText(/- first failing endpoint status:\s*(.+)/),
    firstFailingEndpointRequestId: parseText(/- first failing endpoint requestId:\s*(.+)/)
  }
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function runMultiRouteDriver(routeList) {
  const routes = routeList.length > 0 ? routeList : defaultSmokeRoutes
  const routeLogsRoot = path.join(logsDir, 'routes')
  ensureDir(logsDir)
  ensureDir(routeLogsRoot)

  const startedAt = nowIso()
  const results = []
  let hasFailure = false

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index]
    const routeSlug = `${String(index + 1).padStart(2, '0')}-${routeToSlug(route)}`
    const routeDir = path.join(routeLogsRoot, routeSlug)
    ensureDir(routeDir)

    const childEnv = {
      ...process.env,
      WEAPP_MULTI_CHILD: 'true',
      WEAPP_AUTOMATOR_ROUTE: route,
      WEAPP_AUTOMATOR_ROUTES: ''
    }
    if (index > 0) {
      childEnv.WEAPP_SKIP_BUILD = 'true'
    }

    console.log(`[weapp-cdp-debug] route[${index + 1}/${routes.length}] ${route}`)
    const result = spawnSync(process.execPath, [__filename], {
      cwd: miniappDir,
      env: childEnv,
      stdio: 'inherit',
      encoding: 'utf8'
    })
    const statusCode = typeof result.status === 'number' ? result.status : 1

    copyArtifactIfExists(consoleLogPath, path.join(routeDir, 'console.jsonl'))
    copyArtifactIfExists(networkLogPath, path.join(routeDir, 'network.jsonl'))
    copyArtifactIfExists(runJsonPath, path.join(routeDir, 'run.json'))

    let summaryContent = ''
    if (fs.existsSync(summaryPath)) {
      summaryContent = fs.readFileSync(summaryPath, 'utf8')
      fs.writeFileSync(path.join(routeDir, 'summary.md'), summaryContent, 'utf8')
    }
    const metrics = extractSummaryMetrics(summaryContent)
    const childRun = readJsonIfExists(path.join(routeDir, 'run.json'))
    const childFirstFail = childRun?.firstFail || {}
    const childFirstEndpoint = childFirstFail.endpoint || {}
    const runStatus = childRun?.status || (statusCode === 0 ? 'pass' : 'fail')
    if (runStatus !== 'pass') {
      hasFailure = true
    }

    results.push({
      route,
      statusCode,
      artifactsDir: path.relative(rootDir, routeDir),
      routeRunId: childRun?.routeRunId || '',
      runStatus,
      ...metrics,
      firstFailMessage: childFirstFail.message || '',
      firstFailHint: childFirstFail.hint || '',
      firstFailEndpointPath: childFirstEndpoint.path || '',
      firstFailEndpointStatus: childFirstEndpoint.status || 0,
      firstFailEndpointRequestId: childFirstEndpoint.requestId || ''
    })
  }

  const finishedAt = nowIso()
  const failedRoutesCount = results.filter((item) => item.runStatus !== 'pass').length
  const lines = [
    '# Weapp CDP Multi-route Summary',
    '',
    `- runId: ${runId}`,
    `- startedAt: ${startedAt}`,
    `- finishedAt: ${finishedAt}`,
    `- durationMs: ${durationMsBetween(startedAt, finishedAt)}`,
    `- routes total: ${routes.length}`,
    `- routes failed: ${failedRoutesCount}`,
    '',
    '| route | status | p0 | p1 | p2 | assertFails | failedKeys | firstFailingEndpoint | firstFailingRequestId | firstFailMessage | artifacts |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ]

  for (const item of results) {
    const failedKeys = item.assertionFailedKeys || '-'
    const firstEndpoint = item.firstFailEndpointPath || item.firstFailingEndpoint || '-'
    const firstRequestId = item.firstFailEndpointRequestId || item.firstFailingEndpointRequestId || '-'
    const firstFailMessage = item.firstFailMessage || '-'
    lines.push(
      `| ${item.route} | ${item.runStatus === 'pass' ? 'ok' : `fail(${item.statusCode})`} | `
      + `${item.p0} | ${item.p1} | ${item.p2} | ${item.assertionFailedCount} | `
      + `${failedKeys} | ${firstEndpoint} | ${firstRequestId} | ${clipText(firstFailMessage, 64) || '-'} | ${item.artifactsDir} |`
    )
  }

  const firstFailed = results.find((item) => item.runStatus !== 'pass')
  lines.push('', '## Failure Highlight', '')
  if (!firstFailed) {
    lines.push('- first failed route: none')
    lines.push('- first failed assertion keys: none')
  } else {
    lines.push(`- first failed route: ${firstFailed.route}`)
    lines.push(`- first failed assertion keys: ${firstFailed.assertionFailedKeys || 'unknown'}`)
    lines.push(`- first failed endpoint: ${firstFailed.firstFailEndpointPath || firstFailed.firstFailingEndpoint || 'unknown'}`)
    lines.push(`- first failed endpoint status: ${firstFailed.firstFailEndpointStatus || firstFailed.firstFailingEndpointStatus || 'unknown'}`)
    lines.push(`- first failed endpoint requestId: ${firstFailed.firstFailEndpointRequestId || firstFailed.firstFailingEndpointRequestId || 'unknown'}`)
    lines.push(`- first failed message: ${firstFailed.firstFailMessage || 'unknown'}`)
    lines.push(`- first failed hint: ${firstFailed.firstFailHint || 'unknown'}`)
  }

  lines.push('', '## Notes', '')
  lines.push('- Each route has its own `summary.md`, `console.jsonl`, `network.jsonl`, and `run.json` under `apps/miniapp/.logs/weapp/routes/`.')
  lines.push('- This aggregate file is written to `apps/miniapp/.logs/weapp/summary.md`.', '')

  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8')

  const runtimeInfo = {
    apiBaseUrl: readConfigValue('TARO_APP_API_BASE_URL'),
    commerceMockFallback: readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false'),
    enableMockLogin: readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')
  }
  const firstFailedRoute = results.find((item) => item.runStatus !== 'pass')
  writeRunReport({
    schemaVersion: runSchemaVersion,
    runId,
    routeRunId,
    mode: 'multi-route',
    status: hasFailure ? 'fail' : 'pass',
    exitCode: hasFailure && failOnError ? 1 : 0,
    startedAt,
    finishedAt,
    durationMs: durationMsBetween(startedAt, finishedAt),
    envSnapshot: buildEnvSnapshot(runtimeInfo),
    routesTotal: routes.length,
    routesFailed: failedRoutesCount,
    firstFail: firstFailedRoute
      ? {
          route: firstFailedRoute.route,
          assertionKeys: firstFailedRoute.assertionFailedKeys || '',
          endpoint: {
            path: firstFailedRoute.firstFailEndpointPath || firstFailedRoute.firstFailingEndpoint || '',
            status: firstFailedRoute.firstFailEndpointStatus || firstFailedRoute.firstFailingEndpointStatus || 0,
            requestId: firstFailedRoute.firstFailEndpointRequestId || firstFailedRoute.firstFailingEndpointRequestId || ''
          },
          message: firstFailedRoute.firstFailMessage || '',
          hint: firstFailedRoute.firstFailHint || ''
        }
      : {
          route: '',
          assertionKeys: '',
          endpoint: null,
          message: '',
          hint: ''
        },
    routes: results.map((item) => ({
      route: item.route,
      routeRunId: item.routeRunId || '',
      status: item.runStatus,
      statusCode: item.statusCode,
      p0: item.p0,
      p1: item.p1,
      p2: item.p2,
      assertionFailedCount: item.assertionFailedCount,
      assertionFailedKeys: item.assertionFailedKeys,
      firstFailingEndpoint: item.firstFailEndpointPath || item.firstFailingEndpoint || '',
      firstFailingEndpointRequestId: item.firstFailEndpointRequestId || item.firstFailingEndpointRequestId || '',
      firstFailMessage: item.firstFailMessage || '',
      artifactsDir: item.artifactsDir
    })),
    artifacts: {
      summary: path.relative(rootDir, summaryPath),
      run: path.relative(rootDir, runJsonPath),
      routesDir: path.relative(rootDir, routeLogsRoot)
    }
  })

  if (hasFailure && failOnError) {
    throw new Error(`multi-route smoke has failures. summary: ${summaryPath}`)
  }
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

  console.log('[weapp-cdp-debug] building weapp development bundle...')
  runCommand('pnpm', ['run', 'build:weapp:dev'], {
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
    }, 'console')
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
  }, 'console')

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

function analyzeConsoleText(text, level = 'info') {
  const normalized = String(text || '')
  if (!normalized) {
    return
  }

  const clipped = clipText(normalized)

  if (/request:fail\s+invalid\s+url/i.test(normalized)) {
    appendFailure(`invalid request url detected in miniapp console: ${clipped}`)
    return
  }

  if (/url not in domain list/i.test(normalized)) {
    appendFailure(`request blocked by domain whitelist (urlCheck). message: ${clipped}`)
    return
  }

  if (/api\.example\.com/i.test(normalized)) {
    appendFailure(`production placeholder host leaked into runtime request: ${clipped}`)
    return
  }

  if (/load\s+(bootstrap|categories|products)\s+failed/i.test(normalized)) {
    appendP1Issue(`core homepage request failed: ${clipped}`)
    return
  }

  if (level === 'warn' || /deprecated|deprecate/i.test(normalized)) {
    const allowlistMatch = matchWarningAllowlist(normalized)
    if (allowlistMatch) {
      recordSuppressedWarning(normalized, allowlistMatch, level)
      return
    }
  }

  if (/deprecated|deprecate/i.test(normalized)) {
    appendWarning(`platform deprecation warning: ${clipped}`)
    return
  }

  if (level === 'error') {
    appendP1Issue(`miniapp console error: ${clipped}`)
    return
  }

  if (level === 'warn') {
    appendWarning(`miniapp console warning: ${clipped}`)
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
    }, 'console')

    analyzeConsoleText(text, level)
  })

  miniProgram.on('exception', (payload) => {
    automatorStats.exceptionCount += 1
    writeJsonLine(consoleStream, {
      type: 'miniapp-exception',
      payload,
      time: nowIso()
    }, 'console')

    const text = extractConsoleText(payload)
    appendFailure(`miniapp runtime exception: ${text}`)
  })
}

async function captureSystemInfo() {
  if (!miniProgram) {
    return
  }

  if (typeof miniProgram.systemInfo !== 'function') {
    runtimeDiagnostics.systemInfoCaptureError = 'miniProgram.systemInfo is unavailable'
    writeJsonLine(consoleStream, {
      type: 'miniapp-system-info',
      supported: false,
      reason: runtimeDiagnostics.systemInfoCaptureError
    }, 'console')
    return
  }

  try {
    const info = await miniProgram.systemInfo()
    runtimeDiagnostics.systemInfo = info
    writeJsonLine(consoleStream, {
      type: 'miniapp-system-info',
      supported: true,
      info
    }, 'console')
  } catch (error) {
    runtimeDiagnostics.systemInfoCaptureError = error?.message || String(error)
    appendWarning(`failed to collect miniProgram.systemInfo: ${runtimeDiagnostics.systemInfoCaptureError}`)
    writeJsonLine(consoleStream, {
      type: 'miniapp-system-info',
      supported: true,
      error: runtimeDiagnostics.systemInfoCaptureError
    }, 'console')
  }
}

function extractDataKeys(value) {
  if (!value || typeof value !== 'object') {
    return []
  }
  return Object.keys(value)
}

async function pollCurrentPageData(currentPage, timeoutMs) {
  const startedMs = Date.now()
  const safeTimeout = Math.max(500, timeoutMs)
  const intervalMs = 350
  let attempts = 0
  let lastData = null
  let lastKeys = []

  while ((Date.now() - startedMs) <= safeTimeout) {
    attempts += 1
    try {
      const data = await currentPage.data()
      const keys = extractDataKeys(data)
      lastData = data
      lastKeys = keys

      if (isRouteDataInspectable(data, keys)) {
        return {
          ready: true,
          attempts,
          elapsedMs: Date.now() - startedMs,
          data,
          keys
        }
      }
    } catch {
      // ignore temporary polling failures
    }

    await sleep(intervalMs)
  }

  return {
    ready: false,
    attempts,
    elapsedMs: Date.now() - startedMs,
    data: lastData,
    keys: lastKeys
  }
}

async function warmupAndNavigate() {
  if (!miniProgram) {
    return
  }

  routeSnapshot.route = automatorRoute
  routeSnapshot.pagePath = ''
  routeSnapshot.pageQuery = {}
  routeSnapshot.data = null
  routeSnapshot.dataKeys = []
  runtimeDiagnostics.pageDataPoll = {
    attempts: 0,
    ready: false,
    elapsedMs: 0,
    lastKeys: []
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
    }, 'console')
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
      }, 'console')
    } catch (error) {
      appendWarning(`failed to reLaunch ${routeTarget}: ${error?.message || String(error)}`)
    }
  }

  await sleep(1000)

  try {
    currentPage = await miniProgram.currentPage()
    automatorStats.currentPage = currentPage?.path || ''
    routeSnapshot.pagePath = currentPage?.path || ''
    routeSnapshot.pageQuery = currentPage?.query || {}
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
    }, 'console')
  } catch (error) {
    appendWarning(`failed to read currentPage after reLaunch: ${error?.message || String(error)}`)
  }

  if (currentPage) {
    try {
      const pollResult = await pollCurrentPageData(currentPage, assertionConfig.routeWaitMs)
      routeSnapshot.data = pollResult.data
      routeSnapshot.dataKeys = Array.isArray(pollResult.keys) ? pollResult.keys : []
      runtimeDiagnostics.pageDataPoll = {
        attempts: pollResult.attempts,
        ready: pollResult.ready,
        elapsedMs: pollResult.elapsedMs,
        lastKeys: routeSnapshot.dataKeys
      }

      const preview = stringifyValue(pollResult.data).slice(0, 2000)
      writeJsonLine(consoleStream, {
        type: 'current-page-data',
        path: currentPage.path,
        keys: routeSnapshot.dataKeys,
        ready: pollResult.ready,
        attempts: pollResult.attempts,
        elapsedMs: pollResult.elapsedMs,
        preview,
        time: nowIso()
      }, 'console')
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

function updateEndpointState(pathValue, status, requestId) {
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
    state.lastRequestId = requestId || state.lastRequestId
    state.statuses.push(status)
    if (status >= 200 && status < 400) {
      state.ok = true
      state.successCount += 1
    } else {
      state.errors.push(`status ${status}`)
      state.lastFailureStatus = status
      state.lastFailureRequestId = requestId || state.lastFailureRequestId
    }
  }

  const imageHit = []
  if (pathValue.includes(imageEndpoint)) {
    imageHit.push(imageEndpoint)
  }
  if (pathValue.includes(mediaEndpoint)) {
    imageHit.push(mediaEndpoint)
  }
  if (imageHit.length === 0) {
    return
  }

  for (const endpoint of imageHit) {
    const count = imageProxyState.endpointCounts[endpoint]
    if (!count) {
      continue
    }
    count.total += 1
  }

  networkStats.imageProxyRequests += 1
  imageProxyState.seen = true
  imageProxyState.statuses.push(status)

  if (status >= 200 && status < 400) {
    imageProxyState.ok = true
    imageProxyState.successCount += 1
    networkStats.imageSuccessRequests += 1
    for (const endpoint of imageHit) {
      const count = imageProxyState.endpointCounts[endpoint]
      if (!count) {
        continue
      }
      count.success += 1
    }
    return
  }

  if (status === 499) {
    return
  }

  imageProxyState.errors.push(`status ${status}`)
}

function normalizeIsoTime(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) {
    return ''
  }
  return new Date(ms).toISOString()
}

function trackGatewayRequestTime(requestTime) {
  const normalized = normalizeIsoTime(requestTime)
  if (!normalized) {
    return
  }
  if (!networkStats.firstRequestAt || normalized < networkStats.firstRequestAt) {
    networkStats.firstRequestAt = normalized
  }
  if (!networkStats.lastRequestAt || normalized > networkStats.lastRequestAt) {
    networkStats.lastRequestAt = normalized
  }
}

function collectGatewayLogs(startedAtIso) {
  const hasDocker = spawnSync('docker', ['ps'], { stdio: 'ignore' }).status === 0
  if (!hasDocker) {
    appendWarning('docker command unavailable, skip gateway request capture')
    return
  }

  networkStats.captureSince = startedAtIso
  networkStats.captureUntil = nowIso()

  const logsResult = spawnSync(
    'docker',
    ['logs', '--since', networkStats.captureSince, gatewayContainer],
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
  networkStats.rawLogLines = lines.length
  writeJsonLine(networkStream, {
    type: 'gateway-capture-window',
    container: gatewayContainer,
    since: networkStats.captureSince,
    until: networkStats.captureUntil,
    rawLines: networkStats.rawLogLines
  }, 'network')

  for (const line of lines) {
    const parsed = parseGatewayLine(line)
    if (!parsed) {
      networkStats.skippedGatewayLines += 1
      continue
    }

    networkStats.parsedGatewayLines += 1
    networkStats.totalGatewayRequests += 1
    updateEndpointState(parsed.path, parsed.status, parsed.requestId)
    trackGatewayRequestTime(parsed.time)

    writeJsonLine(networkStream, {
      type: 'gateway-request',
      method: parsed.method,
      path: parsed.path,
      status: parsed.status,
      durationMs: parsed.durationMs,
      requestId: parsed.requestId,
      time: parsed.time
    }, 'network')
  }
}

function runNetworkAssertions() {
  for (const [endpoint, state] of endpointState.entries()) {
    assertCheck('network', `endpoint:${endpoint}:seen`, state.seen, {
      severity: 'p0',
      evidence: `statuses=${state.statuses.join(', ') || '-'}`,
      failMessage: `${endpoint} was not observed in gateway logs during capture window`
    })
    assertCheck('network', `endpoint:${endpoint}:success`, state.ok, {
      severity: 'p0',
      evidence: `statuses=${state.statuses.join(', ') || '-'}`,
      failMessage: `${endpoint} has no successful response`
    })
  }

  assertCheck('network', 'image.success.min', imageProxyState.successCount >= assertionConfig.minImageSuccess, {
    severity: 'p1',
    evidence: `success=${imageProxyState.successCount}, required=${assertionConfig.minImageSuccess}, imageRequests=${networkStats.imageProxyRequests}`,
    failMessage: 'image successful request count below minimum threshold'
  })
}

function runRouteAssertions() {
  assertCheck('route', 'route.path.available', Boolean(routeSnapshot.pagePath), {
    severity: 'p0',
    evidence: `targetRoute=${routeSnapshot.route}, currentPage=${routeSnapshot.pagePath || '-'}`,
    failMessage: 'current miniapp route is unavailable'
  })

  const noConsoleError = automatorStats.consoleErrorCount === 0
  const noConsoleErrorCondition = assertionConfig.assertNoConsoleError ? noConsoleError : true
  assertCheck('route', 'console.error.none', noConsoleErrorCondition, {
    severity: 'p1',
    evidence: `consoleErrorCount=${automatorStats.consoleErrorCount}, assertNoConsoleError=${assertionConfig.assertNoConsoleError}`,
    failMessage: 'miniapp console error count is above zero'
  })
}

function runRenderAssertions() {
  const kind = routeKind(routeSnapshot.route)
  const data = routeSnapshot.data
  const dataInspectable = isRouteDataInspectable(data, routeSnapshot.dataKeys)

  if (!dataInspectable) {
    assertCheck('render', 'route.data.uninspectable', true, {
      severity: 'p2',
      evidence: `route=${routeSnapshot.route}, keys=${routeSnapshot.dataKeys.join(',') || '-'}`,
      failMessage: 'route data cannot be inspected in current runtime'
    })
    return
  }

  if (kind === 'home') {
    const productsCount = inferProductsCount(data)
    const categoriesCount = inferCategoriesCount(data)
    assertCheck('render', 'home.products.min', productsCount >= assertionConfig.minProducts, {
      severity: 'p1',
      evidence: `productsCount=${productsCount}, required=${assertionConfig.minProducts}, keys=${routeSnapshot.dataKeys.join(',')}`,
      failMessage: 'home products count is below minimum threshold'
    })
    assertCheck('render', 'home.categories.min', categoriesCount >= assertionConfig.minCategories, {
      severity: 'p1',
      evidence: `categoriesCount=${categoriesCount}, required=${assertionConfig.minCategories}, keys=${routeSnapshot.dataKeys.join(',')}`,
      failMessage: 'home categories count is below minimum threshold'
    })
    return
  }

  if (kind === 'category') {
    const categoriesCount = inferCategoriesCount(data)
    assertCheck('render', 'category.categories.min', categoriesCount >= assertionConfig.minCategories, {
      severity: 'p1',
      evidence: `categoriesCount=${categoriesCount}, required=${assertionConfig.minCategories}, keys=${routeSnapshot.dataKeys.join(',')}`,
      failMessage: 'category page categories count is below minimum threshold'
    })
    return
  }

  if (kind === 'detail') {
    const detail = inferDetailProduct(data)
    assertCheck('render', 'detail.product.id', Boolean(detail.id), {
      severity: 'p1',
      evidence: `detailId=${detail.id || '-'}, keys=${routeSnapshot.dataKeys.join(',')}`,
      failMessage: 'detail page product id is missing'
    })
    assertCheck('render', 'detail.product.image', isGatewayImageURL(detail.imageUrl), {
      severity: 'p1',
      evidence: `imageUrl=${detail.imageUrl || '-'}`,
      failMessage: 'detail page image url is invalid'
    })
    return
  }

  assertCheck('render', 'route.no-specific-assertion', true, {
    severity: 'p2',
    evidence: `route=${routeSnapshot.route}, kind=${kind}`
  })
}

function runAssertionSuite() {
  runRouteAssertions()
  runNetworkAssertions()
  runRenderAssertions()
}

function failedAssertions() {
  return [
    ...assertionState.routeAssertions,
    ...assertionState.networkAssertions,
    ...assertionState.renderAssertions
  ].filter((item) => !item.passed)
}

function failedAssertionKeys() {
  const keys = failedAssertions().map((item) => item.key)
  if (keys.length === 0) {
    return []
  }
  return [...new Set(keys)]
}

function collectRootCauseHints() {
  const hints = []

  if (networkStats.matchedEndpointRequests === 0) {
    hints.push('gateway log capture did not observe key endpoints; verify gateway container logs and capture window.')
  }

  for (const [endpoint, state] of endpointState.entries()) {
    const first5xx = state.statuses.find((status) => status >= 500)
    if (!first5xx) {
      continue
    }
    const requestId = state.lastFailureRequestId || state.lastRequestId || '-'
    hints.push(`${endpoint} returned ${first5xx}; requestId=${requestId}; check gateway/commerce logs by requestId.`)
  }

  const hasAnyEndpointFailure = hints.some((item) => item.includes('/catalog/') || item.includes('/bff/'))
  if (!hasAnyEndpointFailure && failures.length > 0) {
    hints.push(`runtime failure: ${failures[0]}`)
  }

  return [...new Set(hints)]
}

function firstFailingEndpoint() {
  for (const endpoint of keyEndpoints) {
    const state = endpointState.get(endpoint)
    if (!state) {
      continue
    }
    const first5xx = state.statuses.find((status) => status >= 500)
    if (!first5xx) {
      continue
    }
    return {
      endpoint,
      status: first5xx,
      requestId: state.lastFailureRequestId || state.lastRequestId || '-'
    }
  }
  return null
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

function appendAssertionSection(lines, title, assertions) {
  lines.push('', `## ${title}`, '')
  lines.push('| key | status | severity | evidence |')
  lines.push('| --- | --- | --- | --- |')

  if (!Array.isArray(assertions) || assertions.length === 0) {
    lines.push('| - | - | - | no assertions |')
    return
  }

  for (const item of assertions) {
    lines.push(
      `| ${item.key} | ${item.passed ? 'PASS' : 'FAIL'} | ${item.severity} | ${item.evidence || '-'} |`
    )
  }
}

function durationMsBetween(startedAt, finishedAt) {
  const started = Date.parse(String(startedAt || ''))
  const finished = Date.parse(String(finishedAt || ''))
  if (!Number.isFinite(started) || !Number.isFinite(finished)) {
    return 0
  }
  return Math.max(0, finished - started)
}

function buildEnvSnapshot(runtimeInfo) {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    expectedBaseUrl,
    taroAppApiBaseUrl: runtimeInfo.apiBaseUrl || '',
    taroAppCommerceMockFallback: runtimeInfo.commerceMockFallback || '',
    taroAppEnableMockLogin: runtimeInfo.enableMockLogin || '',
    strictP1,
    assertionConfig: {
      minProducts: assertionConfig.minProducts,
      minCategories: assertionConfig.minCategories,
      minImageSuccess: assertionConfig.minImageSuccess,
      assertNoConsoleError: assertionConfig.assertNoConsoleError,
      routeWaitMs: assertionConfig.routeWaitMs
    },
    warningAllowlistPatterns: warningAllowlist.map((item) => item.pattern)
  }
}

function buildSummary(runtimeInfo, startedAt, finishedAt) {
  const failedKeys = failedAssertionKeys()
  const failedCount = failedAssertions().length
  const rootCauseHints = collectRootCauseHints()
  const firstEndpointFailure = firstFailingEndpoint()
  const suppressedTop = topSuppressedPatterns(10)
  const endpointLines = [
    '| endpoint | seen | ok | statuses | errors | lastFailureRequestId |',
    '| --- | --- | --- | --- | --- | --- |'
  ]

  for (const [endpoint, state] of endpointState.entries()) {
    endpointLines.push(
      `| ${endpoint} | ${state.seen ? 'yes' : 'no'} | ${state.ok ? 'yes' : 'no'} | `
        + `${state.statuses.length > 0 ? state.statuses.join(', ') : '-'} | `
        + `${state.errors.length > 0 ? state.errors.join('; ') : '-'} | `
        + `${state.lastFailureRequestId || '-'} |`
    )
  }

  endpointLines.push(
    `| ${imageEndpoint} | ${imageProxyState.seen ? 'yes' : 'no'} | ${imageProxyState.ok ? 'yes' : 'no'} | `
      + `${imageProxyState.statuses.length > 0 ? imageProxyState.statuses.join(', ') : '-'} | `
      + `${imageProxyState.errors.length > 0 ? imageProxyState.errors.join('; ') : '-'} | - |`
  )

  const summary = [
    '# Weapp CDP Debug Summary',
    '',
    '- mode: miniprogram-automator + gateway-log-capture',
    `- runId: ${runId}`,
    `- routeRunId: ${routeRunId}`,
    `- startedAt: ${startedAt}`,
    `- finishedAt: ${finishedAt}`,
    `- durationMs: ${durationMsBetween(startedAt, finishedAt)}`,
    `- automatorPort: ${automatorPort}`,
    `- automatorConnectTimeoutMs: ${automatorConnectTimeoutMs}`,
    `- timeoutMs: ${captureTimeoutMs}`,
    `- projectDir: ${projectDir}`,
    `- expectedBaseUrl: ${expectedBaseUrl}`,
    `- taroAppApiBaseUrl: ${runtimeInfo.apiBaseUrl}`,
    `- taroAppCommerceMockFallback: ${runtimeInfo.commerceMockFallback}`,
    `- taroAppEnableMockLogin: ${runtimeInfo.enableMockLogin}`,
    `- strictP1: ${strictP1}`,
    `- assertMinProducts: ${assertionConfig.minProducts}`,
    `- assertMinCategories: ${assertionConfig.minCategories}`,
    `- assertMinImageSuccess: ${assertionConfig.minImageSuccess}`,
    `- assertNoConsoleError: ${assertionConfig.assertNoConsoleError}`,
    `- routeWaitMs: ${assertionConfig.routeWaitMs}`,
    `- warning allowlist patterns: ${warningAllowlist.length > 0 ? warningAllowlist.map((item) => item.pattern).join(', ') : 'none'}`,
    `- suppressed warnings count: ${suppressedWarnings.length}`,
    `- suppressed warning top patterns: ${suppressedTop.length > 0 ? suppressedTop.map((item) => `${item.pattern} (${item.count})`).join(', ') : 'none'}`,
    `- assertion failed count: ${failedCount}`,
    `- assertion failed keys: ${failedKeys.length > 0 ? failedKeys.join(', ') : 'none'}`,
    `- first failing endpoint: ${firstEndpointFailure ? firstEndpointFailure.endpoint : 'none'}`,
    `- first failing endpoint status: ${firstEndpointFailure ? firstEndpointFailure.status : '-'}`,
    `- first failing endpoint requestId: ${firstEndpointFailure ? firstEndpointFailure.requestId : '-'}`,
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
    `- page data poll attempts: ${runtimeDiagnostics.pageDataPoll.attempts}`,
    `- page data poll ready: ${runtimeDiagnostics.pageDataPoll.ready}`,
    `- page data poll elapsedMs: ${runtimeDiagnostics.pageDataPoll.elapsedMs}`,
    `- page data poll keys: ${runtimeDiagnostics.pageDataPoll.lastKeys.join(',') || '-'}`,
    '',
    '## Network Stats',
    '',
    `- gateway container: ${gatewayContainer}`,
    `- gateway requests captured: ${networkStats.totalGatewayRequests}`,
    `- key endpoint requests: ${networkStats.matchedEndpointRequests}`,
    `- image proxy requests: ${networkStats.imageProxyRequests}`,
    `- image success requests: ${networkStats.imageSuccessRequests}`,
    `- parse errors: ${networkStats.parseErrors}`,
    `- capture since: ${networkStats.captureSince || '-'}`,
    `- capture until: ${networkStats.captureUntil || '-'}`,
    `- raw log lines: ${networkStats.rawLogLines}`,
    `- parsed gateway lines: ${networkStats.parsedGatewayLines}`,
    `- skipped gateway lines: ${networkStats.skippedGatewayLines}`,
    `- first request at: ${networkStats.firstRequestAt || '-'}`,
    `- last request at: ${networkStats.lastRequestAt || '-'}`,
    '',
    '## Severity Stats',
    '',
    `- P0 blocking issues: ${severityIssues.p0.length}`,
    `- P1 blocking issues: ${severityIssues.p1.length}${strictP1 ? ' (enforced)' : ' (non-blocking mode)'}`,
    `- P2 warning issues: ${severityIssues.p2.length}`,
    '',
    '## Root Cause Hint',
    '',
    ...(rootCauseHints.length === 0 ? ['- none'] : rootCauseHints.map((item) => `- ${item}`)),
    '',
    '## Endpoint Status',
    '',
    ...endpointLines,
    '',
    '## P0 Issues',
    ''
  ]

  if (severityIssues.p0.length === 0) {
    summary.push('- none')
  } else {
    for (const item of severityIssues.p0) {
      summary.push(`- ${item}`)
    }
  }

  summary.push('', '## P1 Issues', '')
  if (severityIssues.p1.length === 0) {
    summary.push('- none')
  } else {
    for (const item of severityIssues.p1) {
      summary.push(`- ${item}`)
    }
  }

  summary.push('', '## P2 Issues', '')
  if (severityIssues.p2.length === 0) {
    summary.push('- none')
  } else {
    for (const item of severityIssues.p2) {
      summary.push(`- ${item}`)
    }
  }

  summary.push('', '## Failures', '')
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

  summary.push('', '## Suppressed Warnings', '')
  if (suppressedTop.length === 0) {
    summary.push('- none')
  } else {
    for (const item of suppressedTop) {
      summary.push(`- ${item.pattern} (${item.count})`)
    }
  }

  summary.push('', '## Suppressed Warning Samples', '')
  if (suppressedWarnings.length === 0) {
    summary.push('- none')
  } else {
    for (const item of suppressedWarnings.slice(0, 10)) {
      summary.push(`- [${item.level}] ${item.pattern} => ${item.text}`)
    }
  }

  summary.push('', '## Artifacts', '')
  summary.push(`- console: ${path.relative(rootDir, consoleLogPath)}`)
  summary.push(`- network: ${path.relative(rootDir, networkLogPath)}`)
  summary.push(`- summary: ${path.relative(rootDir, summaryPath)}`)
  summary.push(`- run: ${path.relative(rootDir, runJsonPath)}`)

  for (const screenshotPath of screenshotPaths) {
    summary.push(`- screenshot: ${screenshotPath}`)
  }

  appendAssertionSection(summary, 'Route Assertions', assertionState.routeAssertions)
  appendAssertionSection(summary, 'Network Assertions', assertionState.networkAssertions)
  appendAssertionSection(summary, 'Render Assertions', assertionState.renderAssertions)

  summary.push('')
  fs.writeFileSync(summaryPath, summary.join('\n'), 'utf8')

  return {
    failedCount,
    failedKeys,
    rootCauseHints,
    firstEndpointFailure,
    suppressedTop
  }
}

function writeRunReport(payload) {
  fs.writeFileSync(runJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function buildSingleRunReport(runtimeInfo, startedAt, finishedAt, summaryMeta, exitCode) {
  const status = failures.length > 0 ? 'fail' : 'pass'
  const firstFailureMessage = failures.length > 0 ? failures[0] : ''
  const hints = Array.isArray(summaryMeta?.rootCauseHints) ? summaryMeta.rootCauseHints : []
  const firstEndpointFailure = summaryMeta?.firstEndpointFailure || null
  const failedKeys = Array.isArray(summaryMeta?.failedKeys) ? summaryMeta.failedKeys : []
  const failedCount = Number(summaryMeta?.failedCount || 0)
  const suppressedTop = Array.isArray(summaryMeta?.suppressedTop) ? summaryMeta.suppressedTop : topSuppressedPatterns(10)

  const report = {
    schemaVersion: runSchemaVersion,
    runId,
    routeRunId,
    mode: 'single-route',
    status,
    exitCode,
    startedAt,
    finishedAt,
    durationMs: durationMsBetween(startedAt, finishedAt),
    route: {
      target: automatorRoute,
      current: routeSnapshot.pagePath || '',
      query: routeSnapshot.pageQuery || {}
    },
    envSnapshot: buildEnvSnapshot(runtimeInfo),
    automatorStats,
    networkStats,
    diagnostics: runtimeDiagnostics,
    severity: {
      p0: severityIssues.p0.length,
      p1: severityIssues.p1.length,
      p2: severityIssues.p2.length
    },
    assertions: {
      failedCount,
      failedKeys,
      route: assertionState.routeAssertions,
      network: assertionState.networkAssertions,
      render: assertionState.renderAssertions
    },
    firstFail: {
      route: status === 'fail' ? routeSnapshot.route : '',
      assertionKeys: failedKeys,
      endpoint: firstEndpointFailure
        ? {
            path: firstEndpointFailure.endpoint,
            status: firstEndpointFailure.status,
            requestId: firstEndpointFailure.requestId
          }
        : null,
      message: firstFailureMessage,
      hint: hints.length > 0 ? hints[0] : ''
    },
    rootCauseHints: hints,
    warnings: {
      total: warnings.length,
      items: warnings,
      suppressedTotal: suppressedWarnings.length,
      suppressedTopPatterns: suppressedTop,
      suppressedSamples: suppressedWarnings.slice(0, 20)
    },
    failures,
    artifacts: {
      console: path.relative(rootDir, consoleLogPath),
      network: path.relative(rootDir, networkLogPath),
      summary: path.relative(rootDir, summaryPath),
      run: path.relative(rootDir, runJsonPath),
      screenshots: screenshotPaths
    }
  }

  writeRunReport(report)
  return report
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
  if (!multiRouteChild && automatorRoutes.length > 0) {
    try {
      runMultiRouteDriver(automatorRoutes)
      console.log(`[weapp-cdp-debug] multi-route completed. summary: ${summaryPath}`)
    } catch (error) {
      console.error(`[weapp-cdp-debug] multi-route failed: ${error?.message || String(error)}`)
      if (failOnError) {
        process.exit(1)
      }
    }
    return
  }

  ensureDir(logsDir)
  ensureDir(screenshotDir)

  consoleStream = fs.createWriteStream(consoleLogPath)
  networkStream = fs.createWriteStream(networkLogPath)

  const startedAt = nowIso()
  let finishedAt = startedAt
  let runtimeInfo = null
  let summaryMeta = null

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
    await captureSystemInfo()
    await warmupAndNavigate()

    const waitMs = Math.max(assertionConfig.routeWaitMs, captureTimeoutMs)
    automatorStats.requestWaitMs = waitMs
    await sleep(waitMs)

    collectGatewayLogs(startedAt)
    runAssertionSuite()

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
    if (!runtimeInfo) {
      runtimeInfo = {
        apiBaseUrl: readConfigValue('TARO_APP_API_BASE_URL'),
        commerceMockFallback: readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false'),
        enableMockLogin: readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')
      }
    }
    summaryMeta = buildSummary(runtimeInfo, startedAt, finishedAt)
    const exitCode = failures.length > 0 && failOnError ? 1 : 0
    buildSingleRunReport(runtimeInfo, startedAt, finishedAt, summaryMeta, exitCode)
    await cleanup()
  }

  if (failures.length > 0) {
    console.error(`[weapp-cdp-debug] failed. summary: ${summaryPath}, run: ${runJsonPath}`)
    if (failOnError) {
      process.exit(1)
    }
  }

  if (summaryMeta && summaryMeta.failedCount > 0) {
    console.warn(`[weapp-cdp-debug] completed with assertion failures: ${summaryMeta.failedCount}`)
  }
  console.log(`[weapp-cdp-debug] completed. summary: ${summaryPath}, run: ${runJsonPath}`)
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
    const fallbackRuntimeInfo = {
      apiBaseUrl: readConfigValue('TARO_APP_API_BASE_URL'),
      commerceMockFallback: readConfigValue('TARO_APP_COMMERCE_MOCK_FALLBACK', 'false'),
      enableMockLogin: readConfigValue('TARO_APP_ENABLE_MOCK_LOGIN', 'false')
    }
    const startedAt = nowIso()
    const finishedAt = nowIso()
    const summaryMeta = buildSummary(fallbackRuntimeInfo, startedAt, finishedAt)
    buildSingleRunReport(fallbackRuntimeInfo, startedAt, finishedAt, summaryMeta, 1)
  } catch {
    // ignore secondary errors
  }
  await cleanup()
  console.error(`[weapp-cdp-debug] fatal: ${error?.message || String(error)}`)
  process.exit(1)
})
