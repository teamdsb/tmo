const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist', 'alipay')
const appJsonPath = path.join(distDir, 'app.json')

function exists(filePath) {
  return fs.existsSync(filePath)
}

function getPages(appJson) {
  if (!Array.isArray(appJson.pages)) {
    return []
  }
  return appJson.pages.filter((page) => typeof page === 'string' && page.length > 0)
}

function verify() {
  const missing = []

  if (!exists(distDir)) {
    console.error(`[verify-alipay-dist] missing dist directory: ${distDir}`)
    process.exit(1)
  }

  if (!exists(appJsonPath)) {
    console.error(`[verify-alipay-dist] missing app.json: ${appJsonPath}`)
    process.exit(1)
  }

  let appJson
  try {
    appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[verify-alipay-dist] failed to parse app.json: ${message}`)
    process.exit(1)
  }

  const pages = getPages(appJson)
  for (const page of pages) {
    for (const ext of ['.axml', '.js', '.json']) {
      const pageFile = path.join(distDir, `${page}${ext}`)
      if (!exists(pageFile)) {
        missing.push(path.relative(distDir, pageFile))
      }
    }
  }

  for (const baseFile of ['app.js', 'taro.js', 'vendors.js', 'common.js', 'base.axml']) {
    const filePath = path.join(distDir, baseFile)
    if (!exists(filePath)) {
      missing.push(baseFile)
    }
  }

  if (missing.length > 0) {
    console.error('[verify-alipay-dist] missing files:')
    for (const file of missing) {
      console.error(`- ${file}`)
    }
    process.exit(1)
  }

  console.log(`[verify-alipay-dist] ok (${pages.length} pages checked)`)
}

verify()
