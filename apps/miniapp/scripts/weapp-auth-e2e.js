const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const projectPath = path.join(miniappDir, 'dist', 'weapp')
const port = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const timeoutMs = Number(process.env.WEAPP_AUTH_E2E_TIMEOUT_MS || 90000)
const verifyDb = process.env.WEAPP_AUTH_VERIFY_DB !== 'false'
const expectedPhone = String(process.env.WEAPP_AUTH_EXPECT_PHONE || '').trim()
const identityDbDsn = process.env.IDENTITY_DB_DSN || 'postgres://commerce:commerce@localhost:5432/identity?sslmode=disable'

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (predicate, options = {}) => {
  const timeoutMs = Number(options.timeoutMs || 12000)
  const intervalMs = Number(options.intervalMs || 400)
  const startAt = Date.now()
  let lastValue

  while (Date.now() - startAt <= timeoutMs) {
    lastValue = await predicate()
    if (lastValue) {
      return lastValue
    }
    await sleep(intervalMs)
  }

  return lastValue
}

const normalizePath = (value) => String(value || '').replace(/^\/+/, '')

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

const parseBootstrap = (value) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    try {
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (typeof value === 'object') {
    return value
  }
  return null
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

const includesRole = (roles, target) => {
  if (!Array.isArray(roles)) {
    return false
  }
  return roles.some((role) => String(role || '').trim().toUpperCase() === target)
}

const runSql = async (sql) => {
  const { execFile } = require('child_process')
  const run = (command, args) =>
    new Promise((resolve, reject) => {
      execFile(command, args, { cwd: rootDir }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
          return
        }
        resolve(String(stdout || '').trim())
      })
    })

  try {
    return await run('psql', [identityDbDsn, '-At', '-c', sql])
  } catch (psqlError) {
    try {
      return await run('docker', ['exec', '-i', 'tmo-postgres', 'psql', '-U', 'commerce', '-d', 'identity', '-At', '-c', sql])
    } catch (dockerError) {
      throw new Error(`DB verification requires psql or docker. psql=${readErrorText(psqlError)} docker=${readErrorText(dockerError)}`)
    }
  }
}

const verifyCustomerInDb = async (phone, provider) => {
  const escapedPhone = phone.replace(/'/g, "''")
  const escapedProvider = provider.replace(/'/g, "''")
  const sql = `
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN user_identities ui ON ui.user_id = u.id
    WHERE u.phone = '${escapedPhone}'
      AND lower(u.user_type) = 'customer'
      AND ur.role = 'CUSTOMER'
      AND ui.provider = '${escapedProvider}'
  ) THEN 'ok'
  ELSE 'missing'
END;
`
  return runSql(sql)
}

const assertPass = (checks, name, condition, detail) => {
  checks.push({ name, pass: Boolean(condition), detail })
  if (!condition) {
    throw new Error(`${name} failed: ${detail}`)
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
    })

    miniProgram.on('exception', (payload) => {
      exceptions.push(payload)
    })

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
    assertPass(checks, 'login.agreement.toggle', Boolean(agreementToggle), 'agreement toggle should be found')
    await agreementToggle.tap()
    await sleep(700)

    const loginButton = await page.$('.login-native-button')
    assertPass(checks, 'login.primary.button', Boolean(loginButton), 'login button should be found')
    await loginButton.tap()
    const loginState = await waitFor(async () => {
      const currentPage = await miniProgram.currentPage()
      const currentRoute = normalizePath(currentPage?.path)
      const token = await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
      const bootstrap = await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')
      if (
        currentRoute !== 'pages/auth/login/index'
        && typeof token === 'string'
        && token.trim().length > 0
        && hasBootstrapMe(bootstrap)
      ) {
        return {
          page: currentPage,
          routeAfterLogin: currentRoute,
          tokenAfterLogin: token,
          bootstrapAfterLogin: bootstrap
        }
      }
      return null
    }, { timeoutMs: 15000, intervalMs: 500 })

    page = loginState?.page ?? await miniProgram.currentPage()
    const routeAfterLogin = loginState?.routeAfterLogin ?? normalizePath(page?.path)
    const tokenAfterLogin = loginState?.tokenAfterLogin ?? await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
    const bootstrapAfterLogin = loginState?.bootstrapAfterLogin ?? await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')
    const parsedBootstrap = parseBootstrap(bootstrapAfterLogin)
    const me = parsedBootstrap?.me || null
    const resolvedPhone = expectedPhone || String(me?.phone || '').trim()

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
    assertPass(
      checks,
      'login.bootstrap.userType.customer',
      String(me?.userType || '').trim().toLowerCase() === 'customer',
      `userType=${String(me?.userType || '')}`
    )
    assertPass(
      checks,
      'login.bootstrap.roles.customer',
      includesRole(me?.roles, 'CUSTOMER'),
      `roles=${JSON.stringify(me?.roles || [])}`
    )
    assertPass(
      checks,
      'login.bootstrap.phone.exists',
      Boolean(resolvedPhone),
      `phone=${resolvedPhone}`
    )

    if (expectedPhone) {
      assertPass(
        checks,
        'login.bootstrap.phone.matches.expected',
        resolvedPhone === expectedPhone,
        `expected=${expectedPhone} actual=${resolvedPhone}`
      )
    }

    let dbEvidence = null
    if (verifyDb && resolvedPhone) {
      const dbResult = await verifyCustomerInDb(resolvedPhone, 'weapp')
      dbEvidence = { phone: resolvedPhone, provider: 'weapp', result: dbResult }
      assertPass(
        checks,
        'db.customer.weapp.identity.exists',
        dbResult === 'ok',
        `dbResult=${dbResult} phone=${resolvedPhone}`
      )
    }

    await miniProgram.reLaunch('/pages/mine/index')
    await sleep(2200)

    page = await miniProgram.currentPage()
    const logoutButton = await page.$('#mine-logout-btn')
    assertPass(checks, 'logout.button.visible', Boolean(logoutButton), 'logout button should be found by #mine-logout-btn')
    await logoutButton.tap()
    const logoutState = await waitFor(async () => {
      const token = await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
      const bootstrap = await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')
      if (
        (token === '' || token === null || token === undefined)
        && (bootstrap === '' || bootstrap === null || bootstrap === undefined)
      ) {
        return { tokenAfterLogout: token, bootstrapAfterLogout: bootstrap }
      }
      return null
    }, { timeoutMs: 10000, intervalMs: 400 })

    const tokenAfterLogout = logoutState?.tokenAfterLogout ?? await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
    const bootstrapAfterLogout = logoutState?.bootstrapAfterLogout ?? await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')

    assertPass(
      checks,
      'logout.token.cleared',
      tokenAfterLogout === '' || tokenAfterLogout === null || tokenAfterLogout === undefined,
      `token=${String(tokenAfterLogout)}`
    )
    assertPass(
      checks,
      'logout.bootstrap.cleared',
      bootstrapAfterLogout === '' || bootstrapAfterLogout === null || bootstrapAfterLogout === undefined,
      `bootstrap=${String(bootstrapAfterLogout)}`
    )

    const headersRuntimeError = consoleLogs.find((item) => /Headers is not defined/i.test(item.text))
    const loginFailedWarn = consoleLogs.find((item) => /identity login failed/i.test(item.text))
    const logoutFailedWarn = consoleLogs.find((item) => /logout failed/i.test(item.text))

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
      'console.no.logout.failed.warn',
      !logoutFailedWarn,
      logoutFailedWarn ? logoutFailedWarn.text : 'ok'
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
      routeAfterLogin,
      me: me
        ? {
          id: me.id,
          phone: me.phone,
          userType: me.userType,
          roles: me.roles
        }
        : null,
      dbEvidence,
      consoleCount: consoleLogs.length,
      exceptionCount: exceptions.length
    }
    console.log(JSON.stringify(summary, null, 2))
    console.log('WEAPP_AUTH_E2E:PASS')
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
    stack: error?.stack || ''
  }
  console.error(JSON.stringify(summary, null, 2))
  console.error('WEAPP_AUTH_E2E:FAIL')
  process.exitCode = 1
})
