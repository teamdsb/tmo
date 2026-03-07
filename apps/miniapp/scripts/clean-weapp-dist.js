const fs = require('node:fs')
const { assertWeappPathsReady } = require('./weapp-paths')

const { miniappDir, outputRoot, sharedEnabled } = assertWeappPathsReady()

try {
  fs.rmSync(outputRoot, { recursive: true, force: true })
  console.log(
    `[clean-weapp-dist] source=${miniappDir} output=${outputRoot} shared=${String(sharedEnabled)}`
  )
  console.log(`[clean-weapp-dist] removed ${outputRoot}`)
} catch (error) {
  console.error(`[clean-weapp-dist] failed to remove ${outputRoot}`)
  console.error(error)
  process.exit(1)
}
