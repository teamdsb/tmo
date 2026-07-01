const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')
const { describeWeappPaths } = require('./weapp-paths')

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
const timeoutMs = Number(process.env.WEAPP_SALES_E2E_TIMEOUT_MS || 120000)
const port = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const artifactDir = path.resolve(rootDir, process.env.WEAPP_SALES_E2E_ARTIFACT_DIR || 'tmp/e2e/sales-customers')

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    throw new Error(`${options.method || 'GET'} ${pathname} failed: ${response.status} ${text}`)
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
  let token = suppliedToken
  if (!token) {
    if (username && password) {
      const login = await requestJson('/auth/password/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'SALES' })
      })
      token = String(login?.accessToken || '').trim()
    } else {
      token = String(await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token') || '').trim()
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
    token = String(switched?.accessToken || token).trim()
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
  const exceptions = []
  try {
    miniProgram = await automator.launch({
      cliPath,
      projectPath: weappPaths.projectDir,
      port,
      timeout: timeoutMs,
      trustProject: true,
      cwd: rootDir
    })
    miniProgram.on('exception', (error) => exceptions.push(String(error?.message || error)))
    const { token, bootstrap } = await createSession(miniProgram)
    const apiCustomers = await requestJson('/customers?page=1&pageSize=20', {
      headers: { Authorization: `Bearer ${token}` }
    })
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
    await miniProgram.reLaunch('/pages/sales/index')
    await sleep(1500)

    const page = await miniProgram.currentPage()
    const customerTab = await page.$('#sales-tab-customers')
    if (!customerTab) throw new Error('customer tab was not found')
    await customerTab.tap()

    const names = await waitFor(async () => {
      const values = await collectTexts(page, '.sales-customer-name')
      return expectedNames.every((name) => values.includes(name)) ? values : null
    })
    if (!names) throw new Error('customer cards did not render all expected assigned customers')

    const phones = await collectTexts(page, '.sales-customer-contact')
    const rawChinaPhones = apiCustomers.items
      .map((item) => String(item?.phone || '').trim())
      .filter((phone) => phone.startsWith('+86'))
    for (const phone of rawChinaPhones) {
      const expected = `+86 ${phone.slice(3).replace(/\s+/g, '')}`
      if (!phones.includes(expected)) throw new Error(`formatted phone not visible: ${expected}`)
    }
    if (exceptions.length > 0) throw new Error(`runtime exceptions: ${exceptions.join(' | ')}`)

    await miniProgram.screenshot({ path: path.join(artifactDir, 'sales-customers.png') })
    fs.writeFileSync(path.join(artifactDir, 'result.json'), `${JSON.stringify({
      status: 'pass',
      salesUser: bootstrap?.me?.displayName || '',
      names,
      phones
    }, null, 2)}\n`)
    console.log('WEAPP_SALES_CUSTOMERS_E2E:PASS')
  } catch (error) {
    if (miniProgram && typeof miniProgram.screenshot === 'function') {
      await miniProgram.screenshot({ path: path.join(artifactDir, 'failure.png') }).catch(() => {})
    }
    throw error
  } finally {
    if (miniProgram) await miniProgram.close()
  }
}

run().catch((error) => {
  console.error(`WEAPP_SALES_CUSTOMERS_E2E:FAIL ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exitCode = 1
})
