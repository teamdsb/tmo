const fs = require('node:fs')
const path = require('node:path')

const weappDistDir = path.resolve(__dirname, '../dist/weapp')

try {
  fs.rmSync(weappDistDir, { recursive: true, force: true })
  console.log(`[clean-weapp-dist] removed ${weappDistDir}`)
} catch (error) {
  console.error(`[clean-weapp-dist] failed to remove ${weappDistDir}`)
  console.error(error)
  process.exit(1)
}
