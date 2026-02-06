const fs = require('node:fs')
const path = require('node:path')

const appWxssPath = path.resolve(__dirname, '../dist/weapp/app-origin.wxss')

function processWeappWxss() {
  if (!fs.existsSync(appWxssPath)) {
    return { status: 'missing', removed: 0 }
  }

  const original = fs.readFileSync(appWxssPath, 'utf8')
  let content = original

  const patterns = [
    /@font-face\s*{[^{}]*number-keyboard[^{}]*}/g,
    /\.taroify-backspace:before\{[^}]*\}/g,
    /\.taroify-keyboard-hide:before\{[^}]*\}/g
  ]

  let removed = 0
  for (const pattern of patterns) {
    const matches = content.match(pattern)
    if (matches?.length) {
      removed += matches.length
      content = content.replace(pattern, '')
    }
  }

  if (content !== original) {
    fs.writeFileSync(appWxssPath, content)
    return { status: 'updated', removed }
  }

  return { status: 'unchanged', removed: 0 }
}

if (require.main === module) {
  const result = processWeappWxss()
  if (result.status === 'missing') {
    console.warn('[postprocess-weapp] skip: app-origin.wxss not found')
    process.exit(0)
  }
  if (result.status === 'updated') {
    console.log(
      `[postprocess-weapp] updated app-origin.wxss, removed ${result.removed} rule(s)`
    )
    process.exit(0)
  }
  console.log('[postprocess-weapp] no number-keyboard rules found')
}

module.exports = { processWeappWxss }
