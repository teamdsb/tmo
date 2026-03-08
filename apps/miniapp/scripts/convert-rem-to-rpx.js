const fs = require('fs')
const path = require('path')

const inputFile = path.resolve(__dirname, '..', 'src', 'styles', 'tailwind.generated.css')
const REM_TO_RPX = 32
const FONT_SCALE = 1

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

function scaleTypography(css) {
  const scaleRpxDeclaration = (source, property) =>
    source.replace(new RegExp(`(${property}:\\s*)(-?\\d*\\.?\\d+)rpx\\b`, 'g'), (_, prefix, raw) => {
      const num = Number(raw)
      if (!Number.isFinite(num)) return `${prefix}${raw}rpx`
      if (num === 0) return `${prefix}0rpx`
      return `${prefix}${formatNumber(num * FONT_SCALE)}rpx`
    })

  const scaledFontSize = scaleRpxDeclaration(css, 'font-size')
  return scaleRpxDeclaration(scaledFontSize, 'line-height')
}

function normalizeTailwindColorSyntax(css) {
  const normalizedOpacityVar = css
    .replace(/--tw-(bg|text|border)-opacity:\s*[^;]+;/g, '')
    .replace(
      /rgb\(([^()]+?)\s*\/\s*var\(--tw-(?:bg|text|border)-opacity(?:,\s*[^)]+)?\)\)/g,
      'rgb($1)'
    )

  return normalizedOpacityVar
}

function stripUnsupportedBlocks(css) {
  const lines = css.split('\n')
  const result = []
  let buffer = []
  let depth = 0
  let hasUnsupported = false

  const countBraces = (line) => {
    const open = (line.match(/{/g) || []).length
    const close = (line.match(/}/g) || []).length
    return open - close
  }

  const markUnsupported = (line) => {
    if (line.includes('\\')) return true
    if (line.includes('--tw-')) return true
    if (line.includes('var(--tw-')) return true
    return false
  }

  for (const line of lines) {
    if (buffer.length === 0) {
      if (line.includes('{')) {
        buffer.push(line)
        hasUnsupported = markUnsupported(line)
        depth = countBraces(line)
        if (depth <= 0) {
          if (!hasUnsupported) result.push(...buffer)
          buffer = []
          depth = 0
          hasUnsupported = false
        }
        continue
      }
      if (!markUnsupported(line)) {
        result.push(line)
      }
      continue
    }

    buffer.push(line)
    if (markUnsupported(line)) {
      hasUnsupported = true
    }
    depth += countBraces(line)
    if (depth <= 0) {
      if (!hasUnsupported) result.push(...buffer)
      buffer = []
      depth = 0
      hasUnsupported = false
    }
  }

  return result.join('\n')
}

function run() {
  if (!fs.existsSync(inputFile)) {
    return
  }

  const original = fs.readFileSync(inputFile, 'utf8')
  const converted = stripUnsupportedBlocks(normalizeTailwindColorSyntax(scaleTypography(convertRemToRpx(original))))
  if (converted !== original) {
    fs.writeFileSync(inputFile, converted, 'utf8')
  }
}

run()
