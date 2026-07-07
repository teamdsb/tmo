const { spawnSync } = require('node:child_process')

const { syncWeappDevtools } = require('./sync-weapp-devtools')

const cli = process.env.WECHAT_DEVTOOLS_CLI || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const { target } = syncWeappDevtools()
const result = spawnSync(cli, ['open', '--project', target, '--lang', 'zh'], { stdio: 'inherit' })
if (result.error) {
  throw result.error
}
process.exit(result.status ?? 0)
