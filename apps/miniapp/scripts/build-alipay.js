const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildModeEnv } = require('./miniapp-mode')

const mode = process.argv[2] || 'dev'
const env = buildModeEnv(mode, { TARO_ENV: 'alipay' })
const miniappDir = path.resolve(__dirname, '..')
const envFile = mode === 'mock' ? '.env.mock' : mode === 'prod' ? '.env.production' : '.env.development'

const steps = [
  { name: 'build:tailwind', cmd: 'npm', args: ['run', 'build:tailwind'] },
  { name: 'taro build', cmd: 'taro', args: ['build', '--type', 'alipay', '--no-check'] },
  { name: 'postprocess-alipay', cmd: process.execPath, args: [path.join(__dirname, 'postprocess-alipay.js')] },
  { name: 'verify-alipay-dist', cmd: process.execPath, args: [path.join(__dirname, 'verify-alipay-dist.js')] },
  { name: 'verify-miniapp-api-base', cmd: process.execPath, args: [path.join(__dirname, 'verify-miniapp-api-base.js'), 'alipay'] }
]

console.log(`[build-alipay] mode=${mode} nodeEnv=${env.NODE_ENV} envFile=${envFile}`)

for (const step of steps) {
  const result = spawnSync(step.cmd, step.args, {
    cwd: miniappDir,
    env,
    stdio: 'inherit'
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
