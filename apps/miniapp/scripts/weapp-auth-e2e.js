const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const projectPath = path.join(miniappDir, 'dist', 'weapp')
const port = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const timeoutMs = Number(process.env.WEAPP_AUTH_E2E_TIMEOUT_MS || 90000)

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    await sleep(6500)

    page = await miniProgram.currentPage()
    const routeAfterLogin = normalizePath(page?.path)
    const tokenAfterLogin = await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
    const bootstrapAfterLogin = await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')

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

    await miniProgram.reLaunch('/pages/mine/index')
    await sleep(2200)

    page = await miniProgram.currentPage()
    const logoutButton = await page.$('#mine-logout-btn')
    assertPass(checks, 'logout.button.visible', Boolean(logoutButton), 'logout button should be found by #mine-logout-btn')
    await logoutButton.tap()
    await sleep(2500)

    const tokenAfterLogout = await miniProgram.callWxMethod('getStorageSync', 'tmo:auth:token')
    const bootstrapAfterLogout = await miniProgram.callWxMethod('getStorageSync', 'tmo:bootstrap')

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
