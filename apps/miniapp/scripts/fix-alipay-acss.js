const fs = require('fs')
const path = require('path')

const distDir = path.resolve(__dirname, '..', 'dist')
const appFile = path.join(distDir, 'app.acss')

if (!fs.existsSync(appFile)) {
  process.exit(0)
}

const content = fs.readFileSync(appFile, 'utf8')
const updated = content.replace(
  /@import\s+(['"])app-origin\.acss\1;/g,
  '@import "./app-origin.acss";'
)

if (updated !== content) {
  fs.writeFileSync(appFile, updated, 'utf8')
}
