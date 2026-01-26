const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')

const distDir = path.resolve(__dirname, '..', 'dist')

const targets = {
  ie: '11'
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }
    if (fullPath.endsWith('.js') || fullPath.endsWith('.sjs')) {
      files.push(fullPath)
    }
  }
  return files
}

function transformFile(filePath) {
  const input = fs.readFileSync(filePath, 'utf8')
  const result = babel.transformSync(input, {
    filename: filePath,
    sourceType: 'unambiguous',
    babelrc: false,
    configFile: false,
    presets: [
      [
        require('@babel/preset-env'),
        {
          targets,
          bugfixes: true,
          modules: false
        }
      ]
    ],
    comments: false,
    compact: true
  })

  if (result && result.code && result.code !== input) {
    fs.writeFileSync(filePath, result.code, 'utf8')
  }
}

if (fs.existsSync(distDir)) {
  const files = walk(distDir)
  for (const filePath of files) {
    transformFile(filePath)
  }
}
