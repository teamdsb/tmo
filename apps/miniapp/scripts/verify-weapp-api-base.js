const fs = require('node:fs')
const path = require('node:path')

const weappDistDir = path.resolve(__dirname, '../dist/weapp')
const targetFiles = ['common.js', 'app.js', 'vendors.js']
const placeholderHost = 'api.example.com'
const expectedDevHost = 'localhost:8080'

const isTrue = (raw) => {
  if (typeof raw !== 'string') {
    return false
  }
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase())
}

const mode = process.env.NODE_ENV === 'development' ? 'development' : 'production'
const allowPlaceholder = isTrue(process.env.MINIAPP_ALLOW_PLACEHOLDER_API)

const readBundledSources = () => {
  return targetFiles
    .map((name) => path.join(weappDistDir, name))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n')
}

const fail = (message) => {
  console.error(`[verify-weapp-api-base] ${message}`)
  process.exit(1)
}

const main = () => {
  const bundledSource = readBundledSources()
  if (!bundledSource) {
    fail('dist/weapp bundle files are missing. run build before verify')
  }

  const hasPlaceholder = bundledSource.includes(placeholderHost)
  const hasLocalhost = bundledSource.includes(expectedDevHost)

  if (mode === 'development') {
    if (hasPlaceholder && !allowPlaceholder) {
      fail(
        `development build contains placeholder host "${placeholderHost}". ` +
        'check .env.development and TARO_APP_* env overrides'
      )
    }
    if (!hasLocalhost) {
      fail(
        `development build does not contain "${expectedDevHost}". ` +
        'check .env.development TARO_APP_API_BASE_URL/TARO_APP_COMMERCE_BASE_URL'
      )
    }
  }

  if (mode === 'production' && hasPlaceholder && !allowPlaceholder) {
    fail(
      `production build still uses placeholder host "${placeholderHost}". ` +
      'set real TARO_APP_API_BASE_URL or export MINIAPP_ALLOW_PLACEHOLDER_API=true to bypass'
    )
  }

  const summary = hasPlaceholder
    ? placeholderHost
    : hasLocalhost
      ? expectedDevHost
      : 'custom host'
  console.log(
    `[verify-weapp-api-base] ok (${mode}): api base references "${summary}"` +
    (allowPlaceholder ? ' (placeholder allowed)' : '')
  )
}

main()
