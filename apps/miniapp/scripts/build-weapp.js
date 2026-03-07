const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { buildModeEnv } = require('./miniapp-mode')

const mode = process.argv[2] || 'dev'
const env = buildModeEnv(mode)
const miniappDir = path.resolve(__dirname, '..')
const envFile = mode === 'mock' ? '.env.mock' : mode === 'prod' ? '.env.production' : '.env.development'

const steps = [
  { name: 'build:tailwind', cmd: 'pnpm', args: ['run', 'build:tailwind'] },
  { name: 'clean:weapp', cmd: 'pnpm', args: ['run', 'clean:weapp'] },
  { name: 'taro build', cmd: 'taro', args: ['build', '--type', 'weapp', '--no-check'] },
  { name: 'postprocess-weapp-project', cmd: process.execPath, args: [path.join(__dirname, 'postprocess-weapp-project.js')] },
  { name: 'verify-weapp-routes', cmd: process.execPath, args: [path.join(__dirname, 'verify-weapp-routes.js')] },
  { name: 'verify-miniapp-api-base', cmd: process.execPath, args: [path.join(__dirname, 'verify-miniapp-api-base.js'), 'weapp'] }
]

console.log(`[build-weapp] mode=${mode} nodeEnv=${env.NODE_ENV} envFile=${envFile}`)

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
