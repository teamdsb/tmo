const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { processWeappWxss } = require('./postprocess-weapp')
const { processWeappProjectConfig } = require('./postprocess-weapp-project')

const weappDistDir = path.resolve(__dirname, '../dist/weapp')
let lastMtimeMs = -1

function runPostprocess() {
  const wxssResult = processWeappWxss()
  if (wxssResult.status === 'updated') {
    console.log(
      `[dev-weapp] postprocessed app-origin.wxss, removed ${wxssResult.removed} rule(s)`
    )
  }
  const projectResult = processWeappProjectConfig()
  if (projectResult.status === 'updated') {
    console.log(`[dev-weapp] set appid to ${projectResult.appId}`)
  }
}

function watchBuiltCss() {
  setInterval(() => {
    const appWxssPath = path.join(weappDistDir, 'app-origin.wxss')
    try {
      const stats = fs.statSync(appWxssPath)
      if (stats.mtimeMs !== lastMtimeMs) {
        lastMtimeMs = stats.mtimeMs
        runPostprocess()
      }
    } catch {
      // build not ready yet
    }
  }, 700)
}

watchBuiltCss()
runPostprocess()

const child = spawn(
  'taro',
  ['build', '--type', 'weapp', '--no-check', '--watch'],
  { stdio: 'inherit' }
)

const shutdown = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
