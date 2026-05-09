const fs = require('node:fs')
const path = require('node:path')

const platform = process.argv[2] || process.env.TARO_ENV || 'weapp'
const distDir = path.resolve(__dirname, '..', 'dist', platform)
const targetFiles = ['common.js', 'app.js', 'vendors.js']
const placeholderHost = 'api.example.com'
const expectedDevHost = 'localhost:8080'
const mode = process.env.TMO_WEAPP_BUILD_MODE || (process.env.NODE_ENV === 'development' ? 'development' : 'production')

const normalize = (value) => String(value || '').trim().replace(/\/+$/, '')

const configuredBaseUrls = () => {
  const names = [
    'TARO_APP_API_BASE_URL',
    'TARO_APP_GATEWAY_BASE_URL',
    'TARO_APP_COMMERCE_BASE_URL',
    'TARO_APP_IDENTITY_BASE_URL',
    'TARO_APP_PAYMENT_BASE_URL'
  ]
  return [...new Set(names.map((name) => normalize(process.env[name])).filter(Boolean))]
}

const readBundledSources = () => {
  return targetFiles
    .map((name) => path.join(distDir, name))
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n')
}

const fail = (message) => {
  console.error(`[verify-miniapp-api-base] ${message}`)
  process.exit(1)
}

const main = () => {
  const bundledSource = readBundledSources()
  if (!bundledSource) {
    fail(`${platform} bundle files are missing under ${distDir}. run build before verify`)
  }

  const hasPlaceholder = bundledSource.includes(placeholderHost)
  const hasLocalhost = bundledSource.includes(expectedDevHost)

  if (mode === 'development' || mode === 'dev') {
    if (hasPlaceholder) {
      fail(
        `${platform} development build contains placeholder host "${placeholderHost}". ` +
        'check .env.development and TARO_APP_* env overrides'
      )
    }
    if (!hasLocalhost) {
      fail(
        `${platform} development build does not contain "${expectedDevHost}". ` +
        'check .env.development TARO_APP_API_BASE_URL/TARO_APP_COMMERCE_BASE_URL'
      )
    }
  }

  if (mode === 'mock') {
    if (hasPlaceholder) {
      fail(
        `${platform} mock build should not bundle "${placeholderHost}". ` +
        'check .env.mock and TARO_APP_* env overrides'
      )
    }

    console.log(`[verify-miniapp-api-base] ok (${platform}/${mode}): isolated mock build is using local-only runtime data`)
    return
  }

  if (mode === 'production' || mode === 'prod') {
    const expectedUrls = configuredBaseUrls()
    if (hasPlaceholder) {
      fail(
        `${platform} production build contains placeholder host "${placeholderHost}". ` +
        'configure .env.production before release'
      )
    }
    if (expectedUrls.length > 0) {
      const missingUrls = expectedUrls.filter((url) => !bundledSource.includes(url))
      if (missingUrls.length > 0) {
        fail(
          `${platform} production build does not contain configured api base ${missingUrls.join(', ')}. ` +
          'check .env.production and Taro defineConstants'
        )
      }
      console.log(`[verify-miniapp-api-base] ok (${platform}/${mode}): api base references ${expectedUrls.join(', ')}`)
      return
    }
  }

  const summary = hasPlaceholder ? placeholderHost : hasLocalhost ? expectedDevHost : 'custom host'
  console.log(`[verify-miniapp-api-base] ok (${platform}/${mode}): api base references "${summary}"`)
}

main()
