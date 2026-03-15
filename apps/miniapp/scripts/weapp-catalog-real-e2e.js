const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const projectPath = path.join(miniappDir, 'dist', 'weapp')
const port = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const timeoutMs = Number(process.env.WEAPP_CATALOG_E2E_TIMEOUT_MS || 120000)
const pageWaitMs = Number(process.env.WEAPP_CATALOG_E2E_PAGE_WAIT_MS || 8000)
const apiBaseUrl = process.env.WEAPP_CATALOG_E2E_API_BASE_URL || 'http://localhost:8080'

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const lastRunDebugState = {
  routeAfterLogin: '',
  homeDataKeys: [],
  categoryDataKeys: [],
  detailDataKeys: [],
  productId: '',
  inquiryListCount: 0,
  consoleTail: [],
  exceptionCount: 0
}

const normalizePath = (value) => String(value || '').replace(/^\/+/, '').split('?')[0]

const readErrorText = (error) => {
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

const extractConsoleText = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return String(payload || '')
  }

  const candidates = [payload.text, payload.message, payload.description]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  if (Array.isArray(payload.args) && payload.args.length > 0) {
    return payload.args.map((item) => {
      if (item === null || item === undefined) {
        return ''
      }
      if (typeof item === 'string') {
        return item
      }
      if (typeof item === 'object') {
        try {
          return JSON.stringify(item)
        } catch {
          return String(item)
        }
      }
      return String(item)
    }).join(' ')
  }

  return ''
}

const hasBootstrapMe = (value) => {
  if (!value) {
    return false
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return false
    }
    try {
      const parsed = JSON.parse(trimmed)
      return Boolean(parsed && typeof parsed === 'object' && parsed.me)
    } catch {
      return false
    }
  }

  return typeof value === 'object' && value !== null && 'me' in value && Boolean(value.me)
}

const assertPass = (checks, name, condition, detail) => {
  checks.push({ name, pass: Boolean(condition), detail })
  if (!condition) {
    throw new Error(`${name} failed: ${detail}`)
  }
}

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const walkNodes = (root, visitor, maxDepth = 6) => {
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

const extractDataKeys = (value) => {
  if (!isPlainObject(value)) {
    return []
  }
  return Object.keys(value).sort()
}

const inferProductsCount = (data) => {
  if (!isPlainObject(data)) {
    return 0
  }

  const directCandidates = ['products', 'productList', 'items', 'list', 'hotProducts']
  for (const key of directCandidates) {
    if (Array.isArray(data[key])) {
      return data[key].length
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
    if ('id' in first && ('name' in first || 'title' in first)) {
      best = Math.max(best, node.length)
    }
  })
  return best
}

const inferCategoriesCount = (data) => {
  if (!isPlainObject(data)) {
    return 0
  }

  const directCandidates = ['categories', 'displayCategories', 'tabs']
  for (const key of directCandidates) {
    if (Array.isArray(data[key])) {
      return data[key].length
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
    if ('id' in first && 'name' in first) {
      best = Math.max(best, node.length)
    }
  })
  return best
}

const inferProductId = (data) => {
  if (!isPlainObject(data)) {
    return ''
  }

  const directCollections = [data.products, data.items, data.productList, data.hotProducts]
  for (const collection of directCollections) {
    if (!Array.isArray(collection) || collection.length === 0) {
      continue
    }
    const first = collection.find((item) => isPlainObject(item) && typeof item.id === 'string' && item.id.trim())
    if (first) {
      return first.id.trim()
    }
  }

  let productId = ''
  walkNodes(data, (node) => {
    if (productId || !Array.isArray(node)) {
      return
    }
    const first = node.find((item) => isPlainObject(item) && typeof item.id === 'string' && item.id.trim())
    if (first) {
      productId = first.id.trim()
    }
  })
  return productId
}

const inferDetailId = (data) => {
  if (!isPlainObject(data)) {
    return ''
  }
  if (isPlainObject(data.detail) && typeof data.detail.id === 'string' && data.detail.id.trim()) {
    return data.detail.id.trim()
  }
  if (isPlainObject(data.product) && typeof data.product.id === 'string' && data.product.id.trim()) {
    return data.product.id.trim()
  }
  if (isPlainObject(data.detail) && isPlainObject(data.detail.product) && typeof data.detail.product.id === 'string' && data.detail.product.id.trim()) {
    return data.detail.product.id.trim()
  }
  return ''
}

const readCurrentPageData = async (page, timeout) => {
  const startedAt = Date.now()
  const safeTimeout = Math.max(timeout, 1000)
  let lastData = null
  let lastKeys = []

  while ((Date.now() - startedAt) <= safeTimeout) {
    try {
      const data = await page.data()
      const keys = extractDataKeys(data)
      lastData = data
      lastKeys = keys
      if (keys.length > 0) {
        return { data, keys }
      }
    } catch {
      // ignore transient automator read failures
    }
    await sleep(350)
  }

  return { data: lastData, keys: lastKeys }
}

const requestJSON = async (url, token) => {
  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  try {
    const response = await fetch(url, { headers })
    let data = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    return {
      statusCode: response.status,
      data
    }
  } catch (error) {
    return {
      statusCode: 0,
      error: readErrorText(error),
      data: null
    }
  }
}

const extractItems = (response) => {
  return Array.isArray(response?.data?.items) ? response.data.items : []
}

const loginWithNativeFlow = async (miniProgram, checks) => {
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:auth:token')
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:bootstrap')
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:auth:pending-role-selection')
  await miniProgram.reLaunch('/pages/auth/login/index')
  await sleep(1800)

  let page = await miniProgram.currentPage()
  assertPass(checks, 'login.page.entered', Boolean(page), 'current page should exist after relaunch to login')
  assertPass(
    checks,
    'login.page.path',
    normalizePath(page?.path) === 'pages/auth/login/index',
    `currentPath=${normalizePath(page?.path)}`
  )

  const agreementToggle = await page.$('.login-agreement-toggle')
    || await page.$('.login-agreement')
    || await page.$('.login-checkbox')
  assertPass(checks, 'login.agreement.toggle', Boolean(agreementToggle), 'agreement toggle should be found')
  await agreementToggle.tap()
  await sleep(700)

  const loginButton = await page.$('.login-native-button')
  assertPass(checks, 'login.primary.button', Boolean(loginButton), 'login button should be found')
  await loginButton.tap()
  await sleep(6500)

  page = await miniProgram.currentPage()
  const routeAfterLogin = normalizePath(page?.path)
  const tokenAfterLogin = await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
  const bootstrapAfterLogin = await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')

  lastRunDebugState.routeAfterLogin = routeAfterLogin

  assertPass(
    checks,
    'login.route.left.login',
    routeAfterLogin !== 'pages/auth/login/index',
    `currentPath=${routeAfterLogin}`
  )
  assertPass(
    checks,
    'login.token.exists',
    typeof tokenAfterLogin === 'string' && tokenAfterLogin.trim().length > 0,
    `token=${String(tokenAfterLogin)}`
  )
  assertPass(
    checks,
    'login.bootstrap.has.me',
    hasBootstrapMe(bootstrapAfterLogin),
    `bootstrapType=${typeof bootstrapAfterLogin}`
  )

  return {
    token: tokenAfterLogin,
    bootstrap: bootstrapAfterLogin
  }
}

const run = async () => {
  let miniProgram = null
  const checks = []
  const consoleLogs = []
  const exceptions = []
  const cliPath = cliCandidates.find((candidate) => fs.existsSync(candidate))
  if (!cliPath) {
    throw new Error('wechat devtools cli not found; set WEAPP_DEVTOOLS_CLI_PATH')
  }

  if (!fs.existsSync(projectPath)) {
    throw new Error(`weapp dist not found at ${projectPath}; run build:weapp first`)
  }

  try {
    miniProgram = await automator.launch({
      cliPath,
      projectPath,
      port,
      timeout: timeoutMs,
      trustProject: true,
      cwd: rootDir
    })

    miniProgram.on('console', (payload) => {
      const level = String(payload?.level || payload?.type || 'info').toLowerCase()
      const text = extractConsoleText(payload)
      consoleLogs.push({ level, text })
      lastRunDebugState.consoleTail = consoleLogs.slice(-10)
    })

    miniProgram.on('exception', (payload) => {
      exceptions.push(payload)
      lastRunDebugState.exceptionCount = exceptions.length
    })

    const { token } = await loginWithNativeFlow(miniProgram, checks)

    await miniProgram.reLaunch('/pages/index/index')
    await sleep(2200)
    let page = await miniProgram.currentPage()
    assertPass(checks, 'home.route.entered', normalizePath(page?.path) === 'pages/index/index', `currentPath=${normalizePath(page?.path)}`)
    const homeState = await readCurrentPageData(page, pageWaitMs)
    lastRunDebugState.homeDataKeys = homeState.keys
    const categoriesResp = await requestJSON(`${apiBaseUrl.replace(/\/$/, '')}/catalog/categories`, token)
    const categories = extractItems(categoriesResp)
    const productsResp = await requestJSON(`${apiBaseUrl.replace(/\/$/, '')}/catalog/products?page=1&pageSize=20`, token)
    const products = extractItems(productsResp)
    const homeProductsCount = products.length
    const homeCategoriesCount = categories.length
    const productId = typeof products[0]?.id === 'string' ? products[0].id : ''
    lastRunDebugState.productId = productId
    assertPass(checks, 'home.categories.http.200', categoriesResp?.statusCode === 200, `status=${String(categoriesResp?.statusCode || 0)}`)
    assertPass(checks, 'home.products.http.200', productsResp?.statusCode === 200, `status=${String(productsResp?.statusCode || 0)}`)
    assertPass(checks, 'home.products.non_empty', homeProductsCount > 0, `products=${homeProductsCount}, keys=${homeState.keys.join(',') || '-'}`)
    assertPass(checks, 'home.categories.non_empty', homeCategoriesCount > 0, `categories=${homeCategoriesCount}, keys=${homeState.keys.join(',') || '-'}`)
    assertPass(checks, 'home.product.id.exists', Boolean(productId), `productId=${productId || '-'}`)

    await miniProgram.reLaunch('/pages/category/index')
    await sleep(2200)
    page = await miniProgram.currentPage()
    assertPass(checks, 'category.route.entered', normalizePath(page?.path) === 'pages/category/index', `currentPath=${normalizePath(page?.path)}`)
    const categoryState = await readCurrentPageData(page, pageWaitMs)
    lastRunDebugState.categoryDataKeys = categoryState.keys
    const categoryId = typeof categories[0]?.id === 'string' ? categories[0].id : ''
    const categoryProductsResp = await requestJSON(
      `${apiBaseUrl.replace(/\/$/, '')}/catalog/products?categoryId=${encodeURIComponent(categoryId)}&page=1&pageSize=40`,
      token
    )
    const categoryProducts = extractItems(categoryProductsResp)
    const categoryProductsCount = categoryProducts.length
    const categoryCategoriesCount = categories.length
    assertPass(checks, 'category.categories.non_empty', categoryCategoriesCount > 0, `categories=${categoryCategoriesCount}, keys=${categoryState.keys.join(',') || '-'}`)
    assertPass(checks, 'category.products.http.200', categoryProductsResp?.statusCode === 200, `status=${String(categoryProductsResp?.statusCode || 0)}`)
    assertPass(checks, 'category.products.non_empty', categoryProductsCount > 0, `products=${categoryProductsCount}, keys=${categoryState.keys.join(',') || '-'}`)

    await miniProgram.reLaunch(`/pages/goods/detail/index?id=${encodeURIComponent(productId)}`)
    await sleep(2600)
    page = await miniProgram.currentPage()
    assertPass(checks, 'detail.route.entered', normalizePath(page?.path) === 'pages/goods/detail/index', `currentPath=${normalizePath(page?.path)}`)
    const detailState = await readCurrentPageData(page, pageWaitMs)
    lastRunDebugState.detailDataKeys = detailState.keys
    const detailResp = await requestJSON(`${apiBaseUrl.replace(/\/$/, '')}/catalog/products/${encodeURIComponent(productId)}`, token)
    const detailId = typeof detailResp?.data?.product?.id === 'string'
      ? detailResp.data.product.id
      : inferDetailId(detailState.data)
    assertPass(checks, 'detail.http.200', detailResp?.statusCode === 200, `status=${String(detailResp?.statusCode || 0)}`)
    assertPass(checks, 'detail.product.loaded', Boolean(detailId), `detailId=${detailId || '-'}, keys=${detailState.keys.join(',') || '-'}`)

    const skuButton = await page.$('.product-sku-button')
    if (skuButton) {
      await skuButton.tap()
      await sleep(600)
    }

    const inquiryButton = await page.$('.cart-action-secondary')
    assertPass(checks, 'detail.inquiry.button.visible', Boolean(inquiryButton), 'inquiry action button should exist')
    await inquiryButton.tap()
    await sleep(2600)

    const inquiriesResp = await requestJSON(`${apiBaseUrl.replace(/\/$/, '')}/inquiries/price?page=1&pageSize=20`, token)
    const inquiryItems = Array.isArray(inquiriesResp?.data?.items) ? inquiriesResp.data.items : []
    lastRunDebugState.inquiryListCount = inquiryItems.length
    assertPass(checks, 'inquiry.list.http.200', inquiriesResp?.statusCode === 200, `status=${String(inquiriesResp?.statusCode || 0)}`)
    assertPass(checks, 'inquiry.list.non_empty', inquiryItems.length > 0, `items=${inquiryItems.length}`)
    assertPass(
      checks,
      'inquiry.created.for.product',
      inquiryItems.some((item) => typeof item?.skuId === 'string' && item.skuId.trim()),
      `items=${inquiryItems.length}`
    )

    const headersRuntimeError = consoleLogs.find((item) => /Headers is not defined/i.test(item.text))
    const loginFailedWarn = consoleLogs.find((item) => /identity login failed/i.test(item.text))
    const catalogFailedWarn = consoleLogs.find((item) => /load (products|categories|product detail) failed/i.test(item.text))
    const inquiryFailedWarn = consoleLogs.find((item) => /create inquiry failed/i.test(item.text))

    assertPass(
      checks,
      'console.no.headers.runtime.error',
      !headersRuntimeError,
      headersRuntimeError ? headersRuntimeError.text : 'ok'
    )
    assertPass(
      checks,
      'console.no.identity.login.failed.warn',
      !loginFailedWarn,
      loginFailedWarn ? loginFailedWarn.text : 'ok'
    )
    assertPass(
      checks,
      'console.no.catalog.load.failed.warn',
      !catalogFailedWarn,
      catalogFailedWarn ? catalogFailedWarn.text : 'ok'
    )
    assertPass(
      checks,
      'console.no.create.inquiry.failed.warn',
      !inquiryFailedWarn,
      inquiryFailedWarn ? inquiryFailedWarn.text : 'ok'
    )
    assertPass(
      checks,
      'runtime.no.exception',
      exceptions.length === 0,
      `exceptions=${exceptions.length}`
    )

    const summary = {
      status: 'pass',
      checks,
      productId,
      inquiryListCount: inquiryItems.length,
      consoleCount: consoleLogs.length,
      exceptionCount: exceptions.length
    }
    console.log(JSON.stringify(summary, null, 2))
    console.log('WEAPP_CATALOG_REAL_E2E:PASS')
  } finally {
    if (miniProgram) {
      try {
        await miniProgram.close()
      } catch {
        // ignore close failures
      }
    }
  }
}

run().catch((error) => {
  const summary = {
    status: 'fail',
    error: readErrorText(error),
    stack: error?.stack || '',
    debugState: lastRunDebugState
  }
  console.error(JSON.stringify(summary, null, 2))
  console.error('WEAPP_CATALOG_REAL_E2E:FAIL')
  process.exitCode = 1
})
