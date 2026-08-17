const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')
const { describeWeappPaths } = require('./weapp-paths')
const { createDiagnosticSanitizer } = require('./e2e-output-safety')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const weappPaths = describeWeappPaths(miniappDir)
const apiBaseUrl = String(process.env.WEAPP_SALES_E2E_API_BASE_URL || 'http://localhost:8080').trim().replace(/\/+$/, '')
const username = String(process.env.WEAPP_SALES_E2E_USERNAME || '').trim()
const password = String(process.env.WEAPP_SALES_E2E_PASSWORD || '').trim()
const suppliedToken = String(process.env.WEAPP_SALES_E2E_ACCESS_TOKEN || '').trim()
const expectedNames = String(process.env.WEAPP_SALES_E2E_EXPECTED_NAMES || '用户5622,用户4556,用户4435,用户1446')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const excludedNames = String(process.env.WEAPP_SALES_E2E_EXCLUDED_NAMES || '用户3059')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const expectedOrderIds = String(process.env.WEAPP_SALES_E2E_EXPECTED_ORDER_IDS || '91919191-9191-9191-9191-919191919191')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const excludedOrderIds = String(process.env.WEAPP_SALES_E2E_EXCLUDED_ORDER_IDS || '92929292-9292-9292-9292-929292929292')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const timeoutMs = Number(process.env.WEAPP_SALES_E2E_TIMEOUT_MS || 120000)
const keepOpen = String(process.env.WEAPP_SALES_E2E_KEEP_OPEN || '').trim().toLowerCase() === 'true'
const traceEnabled = String(process.env.WEAPP_SALES_E2E_TRACE || '').trim().toLowerCase() === 'true'
const automatorWsEndpoint = String(process.env.WEAPP_AUTOMATOR_WS_ENDPOINT || '').trim()
const requestedPort = process.env.WEAPP_AUTOMATOR_PORT
const port = requestedPort ? Number(requestedPort) : null
const artifactDir = path.resolve(rootDir, process.env.WEAPP_SALES_E2E_ARTIFACT_DIR || 'tmp/e2e/sales-customers')

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const diagnosticSanitizer = createDiagnosticSanitizer()
const rememberAccessToken = diagnosticSanitizer.rememberToken
const sanitizeDiagnosticValue = diagnosticSanitizer.sanitize
const lastRunDiagnosticState = {
  stage: 'initialized',
  consoleCount: 0,
  consoleTail: [],
  exceptionCount: 0
}
const tracePhase = (stage) => {
  lastRunDiagnosticState.stage = stage
  if (traceEnabled) console.error(`[weapp-sales-e2e] stage=${stage}`)
}

const waitFor = async (predicate, waitMs = 20000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= waitMs) {
    const value = await predicate()
    if (value) return value
    await sleep(500)
  }
  return null
}

const requestJson = async (pathname, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${pathname}`, options)
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${pathname} failed: status=${response.status} body=${text.trim() ? 'present' : 'missing'}`)
  }
  return data
}

const parseStoredObject = (value) => {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const createSession = async (miniProgram) => {
  let token = rememberAccessToken(suppliedToken)
  if (!token) {
    if (username && password) {
      const login = await requestJson('/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'SALES' })
      })
      token = rememberAccessToken(login?.accessToken)
    } else {
      token = rememberAccessToken(await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token'))
    }
  }
  if (!token) {
    throw new Error('no existing miniapp session; set WEAPP_SALES_E2E_ACCESS_TOKEN or sales username/password')
  }

  const headers = { Authorization: `Bearer ${token}` }
  let bootstrap = parseStoredObject(await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap'))
  bootstrap = await requestJson('/bff/bootstrap', { headers }).catch(() => bootstrap)
  if (String(bootstrap?.me?.currentRole || '').toUpperCase() !== 'SALES') {
    const switched = await requestJson('/auth/switch-role', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SALES' })
    })
    token = rememberAccessToken(switched?.accessToken || token)
    bootstrap = await requestJson('/bff/bootstrap', { headers: { Authorization: `Bearer ${token}` } })
  }

  if (String(bootstrap?.me?.currentRole || '').toUpperCase() !== 'SALES') {
    throw new Error(`expected SALES role, got ${bootstrap?.me?.currentRole || 'empty'}`)
  }
  return { token, bootstrap }
}

const collectTexts = async (page, selector) => {
  const nodes = await page.$$(selector)
  return Promise.all(nodes.map(async (node) => String(await node.text()).trim()))
}

const run = async () => {
  const cliPath = cliCandidates.find((candidate) => fs.existsSync(candidate))
  if (!cliPath) throw new Error('wechat devtools cli not found; set WEAPP_DEVTOOLS_CLI_PATH')
  if (!fs.existsSync(weappPaths.outputRoot)) throw new Error('weapp build not found; run build:weapp:dev first')

  fs.mkdirSync(artifactDir, { recursive: true })
  let miniProgram
  try {
    tracePhase('connecting')
    const launchOptions = {
      cliPath,
      projectPath: weappPaths.projectDir,
      timeout: timeoutMs,
      trustProject: true,
      cwd: rootDir
    }
    if (port) launchOptions.port = port
    miniProgram = automatorWsEndpoint
      ? await automator.launcher.connectTool({ wsEndpoint: automatorWsEndpoint })
      : await automator.launch(launchOptions)
    tracePhase('connected')
    miniProgram.on('console', (payload) => {
      const level = String(payload?.level || payload?.type || 'info').toLowerCase()
      const text = String(payload?.text || payload?.message || payload?.description || '')
      lastRunDiagnosticState.consoleCount += 1
      lastRunDiagnosticState.consoleTail.push({
        level,
        message: text.trim() ? 'present' : 'missing'
      })
      lastRunDiagnosticState.consoleTail = lastRunDiagnosticState.consoleTail.slice(-10)
    })
    miniProgram.on('exception', () => {
      lastRunDiagnosticState.exceptionCount += 1
    })
    const { token, bootstrap } = await createSession(miniProgram)
    tracePhase('session-ready')
    const apiCustomers = await requestJson('/customers?page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const apiOrders = await requestJson('/orders?page=1&pageSize=50', {
      headers: { Authorization: `Bearer ${token}` }
    })
    tracePhase('api-data-ready')
    const apiOrderIds = Array.isArray(apiOrders?.items)
      ? apiOrders.items.map((item) => String(item?.id || '').trim()).filter(Boolean)
      : []
    if (apiOrderIds.length === 0) {
      throw new Error('API returned no sales-owned orders; refusing an empty order assertion')
    }
    for (const orderId of expectedOrderIds) {
      if (!apiOrderIds.includes(orderId)) throw new Error(`API missing expected sales-owned order: ${orderId}`)
    }
    for (const orderId of excludedOrderIds) {
      if (apiOrderIds.includes(orderId)) throw new Error(`API returned excluded order: ${orderId}`)
    }
    const apiNames = Array.isArray(apiCustomers?.items)
      ? apiCustomers.items.map((item) => String(item?.displayName || '').trim())
      : []
    for (const name of expectedNames) {
      if (!apiNames.includes(name)) throw new Error(`API missing assigned customer: ${name}`)
    }
    for (const name of excludedNames) {
      if (apiNames.includes(name)) throw new Error(`API returned excluded customer: ${name}`)
    }

    await miniProgram.callWxMethod('setStorageSync', 'tmo:auth:token', token)
    await miniProgram.callWxMethod('setStorageSync', 'tmo:bootstrap', bootstrap)
    tracePhase('storage-written')
    await miniProgram.reLaunch('/pages/sales/index')
    await sleep(1500)
    tracePhase('sales-route-ready')

    const page = await miniProgram.currentPage()
    const customerTab = await page.$('#sales-tab-customers')
    if (!customerTab) throw new Error('customer tab was not found')
    await customerTab.tap()
    tracePhase('customer-tab-open')

    const names = await waitFor(async () => {
      const values = await collectTexts(page, '.sales-customer-name')
      return expectedNames.every((name) => values.includes(name)) ? values : null
    })
    if (!names) {
      throw new Error(`customer cards did not render all expected assigned customers; consoleSummary=${JSON.stringify(lastRunDiagnosticState.consoleTail)}`)
    }
    tracePhase('customers-verified')

    const phones = await collectTexts(page, '.sales-customer-contact')
    const rawChinaPhones = apiCustomers.items
      .map((item) => String(item?.phone || '').trim())
      .filter((phone) => phone.startsWith('+86'))
    for (const phone of rawChinaPhones) {
      const expected = `+86 ${phone.slice(3).replace(/\s+/g, '')}`
      if (!phones.includes(expected)) throw new Error(`formatted phone not visible: ${expected}`)
    }
    if (lastRunDiagnosticState.exceptionCount > 0) {
      throw new Error(`runtime exceptions: count=${lastRunDiagnosticState.exceptionCount}`)
    }

    await miniProgram.screenshot({ path: path.join(artifactDir, 'sales-customers.png') })

    const ordersTab = await page.$('#sales-tab-orders')
    if (!ordersTab) throw new Error('orders tab was not found')
    await ordersTab.tap()
    tracePhase('orders-tab-open')

    const orderCodes = await waitFor(async () => {
      const values = await collectTexts(page, '.sales-order-code')
      for (const orderId of excludedOrderIds) {
        if (values.some((value) => value.includes(orderId))) {
          throw new Error(`UI rendered excluded order: ${orderId}`)
        }
      }
      return apiOrderIds.every((id) => values.some((value) => value.includes(id))) ? values : null
    })
    if (!orderCodes) throw new Error('sales order cards did not render all API-owned orders')
    tracePhase('orders-verified')
    for (const orderId of expectedOrderIds) {
      if (!orderCodes.some((value) => value.includes(orderId))) {
        throw new Error(`UI missing expected sales-owned order: ${orderId}`)
      }
    }
    const orderProductNames = await collectTexts(page, '.sales-order-item-name')
    const apiProductNames = Array.isArray(apiOrders?.items)
      ? apiOrders.items.flatMap((order) => (Array.isArray(order?.items) ? order.items : []))
        .map((item) => String(item?.sku?.name || '').trim())
        .filter(Boolean)
      : []
    for (const name of apiProductNames) {
      if (!orderProductNames.includes(name)) throw new Error(`sales order product not visible: ${name}`)
    }
    if (orderProductNames.some((name) => name.includes('Acme'))) {
      throw new Error('demo sales order data is still visible')
    }
    await miniProgram.screenshot({ path: path.join(artifactDir, 'sales-orders.png') })

    const accountingTab = await page.$('#sales-tab-accounting')
    if (!accountingTab) throw new Error('accounting tab was not found')
    await accountingTab.tap()
    tracePhase('accounting-tab-open')
    const accountingCopies = await waitFor(async () => {
      const values = await collectTexts(page, '.sales-empty-copy')
      return values.includes('财务结算暂未接入') ? values : null
    })
    if (!accountingCopies) throw new Error('accounting unavailable state was not rendered')
    tracePhase('accounting-verified')
    await miniProgram.screenshot({ path: path.join(artifactDir, 'sales-accounting.png') })

    const successSummary = {
      status: 'pass',
      salesUser: bootstrap?.me?.displayName || '',
      names,
      phones,
      orderIds: apiOrderIds,
      expectedOrderIds,
      excludedOrderIds,
      orderProductNames,
      accountingCopies,
      diagnostics: lastRunDiagnosticState
    }
    fs.writeFileSync(
      path.join(artifactDir, 'result.json'),
      `${JSON.stringify(sanitizeDiagnosticValue(successSummary), null, 2)}\n`
    )
    console.log('WEAPP_SALES_CUSTOMERS_E2E:PASS')
  } catch (error) {
    if (miniProgram && typeof miniProgram.screenshot === 'function') {
      await miniProgram.screenshot({ path: path.join(artifactDir, 'failure.png') }).catch(() => {})
    }
    throw error
  } finally {
    if (miniProgram && !keepOpen) await miniProgram.close()
  }
}

run().catch((error) => {
  const failureSummary = {
    status: 'fail',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack || '' : '',
    diagnostics: lastRunDiagnosticState
  }
  console.error(JSON.stringify(sanitizeDiagnosticValue(failureSummary), null, 2))
  console.error('WEAPP_SALES_CUSTOMERS_E2E:FAIL')
  process.exitCode = 1
})
