const fs = require('fs')
const path = require('path')

const filePath = path.resolve(__dirname, '../src/styles/tailwind.generated.css')

if (!fs.existsSync(filePath)) {
  console.error('[wxss-check] Missing tailwind CSS file:', filePath)
  process.exit(1)
}

const css = fs.readFileSync(filePath, 'utf8')
const ruleRegex = /([^{}]+)\{/g
const errors = []

const checks = [
  { re: /\\/, reason: 'escaped selector (\\\\)' },
  { re: /:[a-zA-Z-]+/, reason: 'pseudo selector (:...)' },
  { re: /\[[^\]]+\]/, reason: 'attribute selector ([...])' }
]

let match
while ((match = ruleRegex.exec(css)) !== null) {
  const rawSelector = match[1].trim()
  if (!rawSelector || rawSelector.startsWith('@')) {
    continue
  }
  const selectors = rawSelector.split(',').map((value) => value.trim()).filter(Boolean)
  for (const selector of selectors) {
    for (const check of checks) {
      if (check.re.test(selector)) {
        errors.push({ selector, reason: check.reason })
        break
      }
    }
  }
}

if (errors.length > 0) {
  console.error('[wxss-check] Unsupported selectors detected in Tailwind output:')
  for (const error of errors.slice(0, 20)) {
    console.error(`- ${error.selector} (${error.reason})`)
  }
  if (errors.length > 20) {
    console.error(`- ...and ${errors.length - 20} more`)
  }
  process.exit(1)
}

console.log('[wxss-check] Tailwind output is WXSS-safe.')
