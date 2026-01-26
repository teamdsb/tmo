const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer-core')

const projectDir = path.resolve(
  process.env.ALIPAY_PROJECT_DIR || path.join(__dirname, '..', 'dist')
)
const timeoutMs = Number(process.env.ALIPAY_CONSOLE_TIMEOUT_MS || 60000)
const exitOnError = process.env.ALIPAY_CONSOLE_EXIT_ON_ERROR !== 'false'
const minidevBin = process.env.MINIDEV_BIN || 'minidev'
const webUrlOverride = process.env.ALIPAY_WEB_URL
const chromeExecutable = process.env.CHROME_EXECUTABLE_PATH || findChrome()

const logDir = path.join(__dirname, '..', '.logs')
const logFile = path.join(logDir, 'alipay-console.jsonl')
const devLogFile = path.join(logDir, 'alipay-devserver.log')

if (!fs.existsSync(projectDir)) {
  console.error(
    `[alipay-console] project dir not found: ${projectDir}. ` +
      'Run build:alipay or set ALIPAY_PROJECT_DIR.'
  )
  process.exit(1)
}

if (!chromeExecutable) {
  console.error(
    '[alipay-console] Chrome executable not found. ' +
      'Set CHROME_EXECUTABLE_PATH.'
  )
  process.exit(1)
}

fs.mkdirSync(logDir, { recursive: true })
const logStream = fs.createWriteStream(logFile)
const devLogStream = fs.createWriteStream(devLogFile)

function writeLog(entry) {
  logStream.write(`${JSON.stringify(entry)}\n`)
}

function writeDevLog(line, source) {
  devLogStream.write(`[${source}] ${line}\n`)
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ]
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function extractUrls(line) {
  const matches = line.match(/https?:\/\/[^\s"']+/g)
  if (!matches) {
    return []
  }
  return matches.filter((url) => url.startsWith('http'))
}

async function run() {
  const devArgs = ['dev', '-p', projectDir]
  if (process.env.MINIDEV_HOST) {
    devArgs.push('--host', process.env.MINIDEV_HOST)
  }
  if (process.env.MINIDEV_PORT) {
    devArgs.push('--port', process.env.MINIDEV_PORT)
  }
  if (process.env.MINIDEV_OUTPUT) {
    devArgs.push('-o', process.env.MINIDEV_OUTPUT)
  }

  const devProc = spawn(minidevBin, devArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let webUrl = webUrlOverride || null
  let sentWeb = false
  let hasError = false
  let resolveEarly
  const earlyExit = new Promise((resolve) => {
    resolveEarly = resolve
  })

  const onLine = (line, source) => {
    writeDevLog(line, source)
    writeLog({
      type: 'devserver',
      source,
      message: line,
      time: new Date().toISOString(),
    })

    const urls = extractUrls(line)
    if (!webUrl && urls.length) {
      const preferred = urls.find((url) =>
        url.includes('127.0.0.1') || url.includes('localhost')
      )
      webUrl = preferred || urls[0]
    }

    if (!sentWeb && /devserver|编译完成|启动/.test(line)) {
      sentWeb = true
      devProc.stdin.write('web\n')
    }
  }

  devProc.stdout.setEncoding('utf8')
  devProc.stderr.setEncoding('utf8')

  devProc.stdout.on('data', (chunk) => {
    chunk
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => onLine(line, 'stdout'))
  })

  devProc.stderr.on('data', (chunk) => {
    chunk
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((line) => onLine(line, 'stderr'))
  })

  devProc.on('exit', (code) => {
    if (code && code !== 0) {
      hasError = true
    }
    resolveEarly()
  })

  if (!sentWeb) {
    setTimeout(() => {
      if (!sentWeb) {
        sentWeb = true
        devProc.stdin.write('web\n')
      }
    }, 2500)
  }

  const waitForWebUrl = async () => {
    const start = Date.now()
    while (!webUrl && Date.now() - start < 20000) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    return webUrl
  }

  const targetUrl = await waitForWebUrl()
  if (!targetUrl) {
    console.error(
      '[alipay-console] Failed to detect web simulator URL. ' +
        'Set ALIPAY_WEB_URL manually.'
    )
    devProc.kill('SIGTERM')
    process.exit(1)
  }

  const browser = await puppeteer.launch({
    headless: process.env.ALIPAY_PUPPETEER_HEADLESS !== 'false',
    executablePath: chromeExecutable,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  page.on('console', (msg) => {
    const level = msg.type()
    const text = msg.text()
    writeLog({
      type: 'console',
      level,
      text,
      time: new Date().toISOString(),
    })
    if (level === 'error') {
      hasError = true
      if (exitOnError) {
        resolveEarly()
      }
    }
  })

  page.on('pageerror', (error) => {
    hasError = true
    writeLog({
      type: 'pageerror',
      message: error.message || String(error),
      time: new Date().toISOString(),
    })
    if (exitOnError) {
      resolveEarly()
    }
  })

  page.on('error', (error) => {
    hasError = true
    writeLog({
      type: 'error',
      message: error.message || String(error),
      time: new Date().toISOString(),
    })
    if (exitOnError) {
      resolveEarly()
    }
  })

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

  await Promise.race([
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    earlyExit,
  ])

  await browser.close()
  devProc.kill('SIGTERM')
  logStream.end()
  devLogStream.end()

  if (hasError) {
    console.error(`[alipay-console] errors detected. log: ${logFile}`)
    process.exit(1)
  }

  console.log(`[alipay-console] completed. log: ${logFile}`)
}

run().catch((error) => {
  console.error('[alipay-console] failed:', error)
  process.exit(1)
})
