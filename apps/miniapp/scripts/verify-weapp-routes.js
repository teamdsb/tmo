const fs = require('node:fs')
const path = require('node:path')

const weappDistDir = path.resolve(__dirname, '../dist/weapp')
const appJsonPath = path.join(weappDistDir, 'app.json')

const requiredPageExts = ['.json', '.js', '.wxml']

const fail = (message) => {
  console.error(`[verify-weapp-routes] ${message}`)
}

const assertFileExists = (absPath, relPath, errors) => {
  if (!fs.existsSync(absPath)) {
    errors.push(`missing file: ${relPath}`)
  }
}

const readAppConfig = () => {
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`missing app.json: ${appJsonPath}`)
  }

  const raw = fs.readFileSync(appJsonPath, 'utf8')
  return JSON.parse(raw)
}

const verifyPages = (pages, errors) => {
  for (const page of pages) {
    if (typeof page !== 'string' || !page.trim()) {
      errors.push(`invalid page entry: ${JSON.stringify(page)}`)
      continue
    }
    if (/\s/.test(page)) {
      errors.push(`page path contains whitespace: ${page}`)
      continue
    }

    for (const ext of requiredPageExts) {
      const rel = `${page}${ext}`
      const abs = path.join(weappDistDir, rel)
      assertFileExists(abs, rel, errors)
    }
  }
}

const verifyTabbarIcons = (tabBar, errors) => {
  if (!tabBar || !Array.isArray(tabBar.list)) {
    return
  }

  for (const [index, item] of tabBar.list.entries()) {
    for (const field of ['iconPath', 'selectedIconPath']) {
      const icon = item?.[field]
      if (!icon) {
        errors.push(`tabBar.list[${index}].${field} is empty`)
        continue
      }
      if (/\s/.test(icon)) {
        errors.push(`tabBar.list[${index}].${field} contains whitespace: ${icon}`)
        continue
      }
      const abs = path.join(weappDistDir, icon)
      assertFileExists(abs, icon, errors)
    }
  }
}

const main = () => {
  try {
    const appConfig = readAppConfig()
    const errors = []

    const pages = Array.isArray(appConfig.pages) ? appConfig.pages : []
    verifyPages(pages, errors)
    verifyTabbarIcons(appConfig.tabBar, errors)

    if (errors.length > 0) {
      fail(`validation failed with ${errors.length} issue(s):`)
      for (const err of errors) {
        fail(`- ${err}`)
      }
      process.exit(1)
    }

    console.log(
      `[verify-weapp-routes] ok: ${pages.length} page route(s) and tabBar icon paths are valid`
    )
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
