const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { describeWeappPaths } = require('./weapp-paths')

const DEFAULT_PROJECT_DIR = path.join(os.homedir(), '.tmo', 'weapp-devtools')

function assertAsciiPath(target) {
  if (!/^[\x00-\x7F]+$/.test(target)) {
    throw new Error(`WeChat DevTools project path must contain ASCII characters only: ${target}`)
  }
}

function syncDirectory(sourceDir, targetDir) {
  const source = path.resolve(sourceDir)
  const target = path.resolve(targetDir)
  assertAsciiPath(target)
  if (!fs.existsSync(source)) {
    throw new Error(`weapp build output not found: ${source}`)
  }
  if (source === target || target === path.parse(target).root || target === os.homedir()) {
    throw new Error(`refusing unsafe WeChat DevTools target: ${target}`)
  }
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new Error(`WeChat DevTools target must be a real directory, not a symlink: ${target}`)
  }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true, force: true })
  return { source, target }
}

function syncWeappDevtools(options = {}) {
  const miniappDir = options.miniappDir || path.resolve(__dirname, '..')
  const sourceDir = options.sourceDir || describeWeappPaths(miniappDir).outputRoot
  const targetDir = options.targetDir || process.env.TMO_WEAPP_DEVTOOLS_PROJECT_DIR || DEFAULT_PROJECT_DIR
  const result = syncDirectory(sourceDir, targetDir)
  console.log(`[sync-weapp-devtools] source=${result.source} target=${result.target}`)
  return result
}

if (require.main === module) {
  syncWeappDevtools()
}

module.exports = { DEFAULT_PROJECT_DIR, assertAsciiPath, syncDirectory, syncWeappDevtools }
