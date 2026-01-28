const fs = require('fs')
const path = require('path')

const inputFile = path.resolve(__dirname, '..', 'src', 'styles', 'tailwind.generated.css')
const REM_TO_RPX = 32

function formatNumber(value) {
  const fixed = value.toFixed(4)
  return fixed.replace(/\.?0+$/, '')
}

function convertRemToRpx(css) {
  return css.replace(/(-?\d*\.?\d+)rem\b/g, (_, raw) => {
    const num = Number(raw)
    if (!Number.isFinite(num)) return `${raw}rem`
    if (num === 0) return '0rpx'
    return `${formatNumber(num * REM_TO_RPX)}rpx`
  })
}

function run() {
  if (!fs.existsSync(inputFile)) {
    return
  }

  const original = fs.readFileSync(inputFile, 'utf8')
  const converted = convertRemToRpx(original)
  if (converted !== original) {
    fs.writeFileSync(inputFile, converted, 'utf8')
  }
}

run()
