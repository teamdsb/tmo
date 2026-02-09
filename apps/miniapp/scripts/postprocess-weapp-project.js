const fs = require('node:fs')
const path = require('node:path')

const projectConfigPath = path.resolve(__dirname, '../dist/weapp/project.config.json')

function processWeappProjectConfig() {
  if (!fs.existsSync(projectConfigPath)) {
    return { status: 'missing' }
  }

  const appId = process.env.TARO_APP_ID?.trim()
  if (!appId) {
    return { status: 'no-appid' }
  }

  const raw = fs.readFileSync(projectConfigPath, 'utf8')
  const config = JSON.parse(raw)
  if (config.appid === appId) {
    return { status: 'unchanged', appId }
  }

  config.appid = appId
  fs.writeFileSync(projectConfigPath, `${JSON.stringify(config, null, 2)}\n`)
  return { status: 'updated', appId }
}

if (require.main === module) {
  const result = processWeappProjectConfig()
  if (result.status === 'missing') {
    console.warn('[postprocess-weapp-project] skip: project.config.json not found')
  } else if (result.status === 'no-appid') {
    console.warn(
      '[postprocess-weapp-project] TARO_APP_ID is empty, keep touristappid (guest mode)'
    )
  } else if (result.status === 'updated') {
    console.log(`[postprocess-weapp-project] set appid to ${result.appId}`)
  } else {
    console.log(`[postprocess-weapp-project] appid already ${result.appId}`)
  }
}

module.exports = { processWeappProjectConfig }
