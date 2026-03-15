const fs = require('node:fs')
const path = require('node:path')
const automator = require('miniprogram-automator')

const { describeWeappPaths } = require('./weapp-paths')

const miniappDir = path.resolve(__dirname, '..')
const rootDir = path.resolve(miniappDir, '..', '..')
const weappPaths = describeWeappPaths(miniappDir)
const projectPath = weappPaths.projectDir
const artifactPath = weappPaths.outputRoot
const port = Number(process.env.WEAPP_AUTOMATOR_PORT || 9527)
const timeoutMs = Number(process.env.WEAPP_SUPPORT_E2E_TIMEOUT_MS || 120000)
const mode = String(process.env.WEAPP_SUPPORT_REAL_E2E_MODE || 'send').trim().toLowerCase()
const gatewayBaseUrl = String(process.env.WEAPP_SUPPORT_REAL_E2E_API_BASE_URL || 'http://localhost:8080').trim().replace(/\/+$/, '')
const customerMessage = String(process.env.SUPPORT_REAL_E2E_CUSTOMER_MESSAGE || '').trim()
const replyText = String(process.env.SUPPORT_REAL_E2E_REPLY_TEXT || '').trim()
const evidenceFile = String(process.env.SUPPORT_REAL_E2E_ARTIFACT || '').trim()

const cliCandidates = [
  process.env.WEAPP_DEVTOOLS_CLI_PATH,
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  '/Applications/小程序开发者工具.app/Contents/MacOS/cli',
  '/Applications/微信开发者工具.app/Contents/MacOS/cli'
].filter(Boolean)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (predicate, options = {}) => {
  const timeout = Number(options.timeoutMs || 12000)
  const intervalMs = Number(options.intervalMs || 400)
  const startedAt = Date.now()
  let lastValue = null

  while (Date.now() - startedAt <= timeout) {
    lastValue = await predicate()
    if (lastValue) {
      return lastValue
    }
    await sleep(intervalMs)
  }

  return lastValue
}

const assertPass = (checks, name, condition, detail) => {
  checks.push({ name, pass: Boolean(condition), detail })
  if (!condition) {
    throw new Error(`${name} failed: ${detail}`)
  }
}

const normalizePath = (value) => String(value || '').replace(/^\/+/, '').split('?')[0]

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

  if (Array.isArray(payload.args)) {
    return payload.args.map((item) => {
      if (typeof item === 'string') {
        return item
      }
      if (item === null || item === undefined) {
        return ''
      }
      try {
        return JSON.stringify(item)
      } catch {
        return String(item)
      }
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
      return Boolean(parsed && parsed.me)
    } catch {
      return false
    }
  }
  return typeof value === 'object' && value !== null && Boolean(value.me)
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
  return typeof value === 'object' ? value : null
}

const requestJson = async (pathname, token) => {
  const response = await fetch(`${gatewayBaseUrl}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return {
    status: response.status,
    data
  }
}

const readArtifact = () => {
  if (!evidenceFile || !fs.existsSync(evidenceFile)) {
    return null
  }
  return JSON.parse(fs.readFileSync(evidenceFile, 'utf8'))
}

const writeArtifact = (payload) => {
  if (!evidenceFile) {
    return
  }
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true })
  fs.writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

const findFirstElement = async (page, selectors) => {
  for (const selector of selectors) {
    const element = await page.$(selector)
    if (element) {
      return element
    }
  }
  return null
}

const collectTexts = async (page, selector) => {
  const nodes = await page.$$(selector)
  const texts = []
  for (const node of nodes) {
    const value = String(await node.text()).trim()
    if (value) {
      texts.push(value)
    }
  }
  return texts
}

const createCustomerSession = async (miniProgram, checks) => {
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:auth:token')
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:bootstrap')
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:auth:pending-role-selection')

  const loginResponse = await fetch(`${gatewayBaseUrl}/auth/mini/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      platform: 'weapp',
      code: 'mock_customer_001',
      phoneProof: {
        code: 'simulated_weapp_phone_proof'
      }
    })
  })
  const loginPayload = await loginResponse.json()
  assertPass(checks, 'login.http.status', loginResponse.status === 200, `status=${loginResponse.status} body=${JSON.stringify(loginPayload)}`)

  const token = String(loginPayload?.accessToken || '').trim()
  assertPass(checks, 'login.token.exists', Boolean(token), `token=${token}`)

  const bootstrapResponse = await requestJson('/bff/bootstrap', token)
  assertPass(checks, 'login.bootstrap.status', bootstrapResponse.status === 200, `status=${bootstrapResponse.status}`)
  const bootstrap = parseBootstrap(bootstrapResponse.data)
  assertPass(checks, 'login.token.exists', Boolean(token), `token=${token}`)
  assertPass(checks, 'login.bootstrap.me.exists', Boolean(bootstrap?.me), `bootstrap=${JSON.stringify(bootstrap)}`)

  await miniProgram.callWxMethod('setStorageSync', 'tmo:auth:token', token)
  await miniProgram.callWxMethod('setStorageSync', 'tmo:bootstrap', JSON.stringify(bootstrap))
  await miniProgram.callWxMethod('removeStorageSync', 'tmo:auth:pending-role-selection')

  return {
    token,
    bootstrap
  }
}

const openSupportChat = async (miniProgram, checks) => {
  await miniProgram.reLaunch('/pages/support/index')
  await sleep(2200)

  const page = await waitFor(async () => {
    const currentPage = await miniProgram.currentPage()
    const route = normalizePath(currentPage?.path)
    if (route === 'pages/support/chat/index' || route === 'pages/support/index') {
      return currentPage
    }
    return null
  }, { timeoutMs: 12000, intervalMs: 400 })

  assertPass(checks, 'support.page.entered', Boolean(page), `currentPath=${normalizePath(page?.path)}`)
  return page
}

const waitForSupportText = async (page, text, checks, checkName) => {
  const matched = await waitFor(async () => {
    const texts = await collectTexts(page, '.support-chat__text')
    if (texts.some((item) => item.includes(text))) {
      return texts
    }
    return null
  }, { timeoutMs: 30000, intervalMs: 800 })
  assertPass(checks, checkName, Boolean(matched), `text=${text}`)
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
    throw new Error(`weapp project not found at ${projectPath}; run build:weapp first`)
  }
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`weapp artifacts not found at ${artifactPath}; run build:weapp first`)
  }

  if (mode === 'send' && !customerMessage) {
    throw new Error('SUPPORT_REAL_E2E_CUSTOMER_MESSAGE is required in send mode')
  }
  if (mode === 'verify-reply' && !replyText) {
    throw new Error('SUPPORT_REAL_E2E_REPLY_TEXT is required in verify-reply mode')
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
      consoleLogs.push({
        level: String(payload?.level || payload?.type || 'info').toLowerCase(),
        text: extractConsoleText(payload)
      })
    })
    miniProgram.on('exception', (payload) => {
      exceptions.push(payload)
    })

    const { token } = await createCustomerSession(miniProgram, checks)
    const page = await openSupportChat(miniProgram, checks)

    const currentConversationResp = await waitFor(async () => {
      const response = await requestJson('/support/conversations/current', token)
      if (response.status === 200 && response.data?.id) {
        return response
      }
      return null
    }, { timeoutMs: 30000, intervalMs: 1000 })
    assertPass(checks, 'support.current.conversation.exists', Boolean(currentConversationResp?.data?.id), `response=${JSON.stringify(currentConversationResp?.data || null)}`)

    const conversationId = String(currentConversationResp.data.id)

    if (mode === 'send') {
      const input = await findFirstElement(page, ['input.support-chat__input', '.support-chat__input'])
      assertPass(checks, 'support.input.visible', Boolean(input), 'support text input should be found')
      await input.input(customerMessage)
      await sleep(500)

      const sendButton = await findFirstElement(page, ['.support-chat__send'])
      assertPass(checks, 'support.send.button.visible', Boolean(sendButton), 'support send button should be found')
      await sendButton.tap()

      await waitForSupportText(page, customerMessage, checks, 'support.customer.message.visible')

      const messagesResp = await waitFor(async () => {
        const response = await requestJson(`/support/conversations/${conversationId}/messages?page=1&pageSize=100`, token)
        const items = Array.isArray(response.data?.items) ? response.data.items : []
        if (response.status === 200 && items.some((item) => String(item?.textContent || '').includes(customerMessage))) {
          return response
        }
        return null
      }, { timeoutMs: 30000, intervalMs: 1000 })
      assertPass(checks, 'support.customer.message.persisted', Boolean(messagesResp), `message=${customerMessage}`)

      const evidence = {
        conversationId,
        customerMessage
      }
      writeArtifact(evidence)
    } else if (mode === 'verify-reply') {
      const artifact = readArtifact()
      if (artifact?.conversationId) {
        assertPass(checks, 'support.current.conversation.matches.artifact', artifact.conversationId === conversationId, `artifact=${artifact.conversationId} actual=${conversationId}`)
      }

      await waitForSupportText(page, replyText, checks, 'support.staff.reply.visible')

      const messagesResp = await waitFor(async () => {
        const response = await requestJson(`/support/conversations/${conversationId}/messages?page=1&pageSize=100`, token)
        const items = Array.isArray(response.data?.items) ? response.data.items : []
        if (response.status === 200 && items.some((item) => String(item?.textContent || '').includes(replyText))) {
          return response
        }
        return null
      }, { timeoutMs: 30000, intervalMs: 1000 })
      assertPass(checks, 'support.staff.reply.persisted', Boolean(messagesResp), `message=${replyText}`)
    } else {
      throw new Error(`unsupported WEAPP_SUPPORT_REAL_E2E_MODE: ${mode}`)
    }

    const runtimeError = consoleLogs.find((item) => /加载客服会话失败|客服连接初始化失败|send support/i.test(item.text))
    assertPass(checks, 'runtime.no.support.error.log', !runtimeError, runtimeError ? runtimeError.text : 'ok')
    assertPass(checks, 'runtime.no.exception', exceptions.length === 0, `exceptions=${exceptions.length}`)

    if (mode === 'send') {
      process.stdout.write(`${JSON.stringify({ status: 'pass', conversationId, customerMessage, checks })}\n`)
    } else {
      process.stdout.write(`${JSON.stringify({ status: 'pass', conversationId, replyText, checks })}\n`)
    }
  } finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}

run().catch((error) => {
  console.error(`[weapp-support-real-e2e] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
