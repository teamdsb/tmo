const fs = require('node:fs')
const path = require('node:path')
const { describeWeappPaths } = require('./weapp-paths')

const { outputRoot: weappDistDir } = describeWeappPaths()
const targetFiles = ['common.js', 'app.js', 'vendors.js']
const placeholderHost = 'api.example.com'
const expectedDevHost = 'localhost:8080'
const mode = process.env.TMO_WEAPP_BUILD_MODE || (process.env.NODE_ENV === 'development' ? 'development' : 'production')

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
    fail(`weapp bundle files are missing under ${weappDistDir}. run build before verify`)
  }

  const hasPlaceholder = bundledSource.includes(placeholderHost)
  const hasLocalhost = bundledSource.includes(expectedDevHost)

  if (mode === 'development' || mode === 'dev') {
    if (hasPlaceholder) {
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

  if (mode === 'mock') {
    if (hasPlaceholder) {
      fail(
        `mock build should not bundle "${placeholderHost}". ` +
        'check .env.mock and TARO_APP_* env overrides'
      )
    }

    console.log('[verify-weapp-api-base] ok (mock): isolated mock build is using local-only runtime data')
    return
  }

  if (mode === 'production' || mode === 'prod') {
    if (hasPlaceholder) {
      console.log(
        `[verify-weapp-api-base] ok (${mode}): api base references "${placeholderHost}" (production placeholder retained)`
      )
      return
    }
  }

  const summary = hasPlaceholder ? placeholderHost : hasLocalhost ? expectedDevHost : 'custom host'
  console.log(`[verify-weapp-api-base] ok (${mode}): api base references "${summary}"`)
}

main()
