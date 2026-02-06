const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const babel = require('@babel/core')

const distDir = path.resolve(__dirname, '..', 'dist')
const targetDir = path.join(distDir, 'alipay')
const workspaceRoot = path.resolve(__dirname, '..', '..', '..')

const targets = {
  ie: '11'
}

function resolvePresetEnv() {
  try {
    return require('@babel/preset-env')
  } catch (_err) {
    const pnpmRoot = path.resolve(workspaceRoot, 'node_modules', '.pnpm')
    if (!fs.existsSync(pnpmRoot)) {
      throw _err
    }

    const entries = fs.readdirSync(pnpmRoot)
    const match = entries.find((name) => name.startsWith('@babel+preset-env@'))
    if (!match) {
      throw _err
    }

    const presetPath = path.join(
      pnpmRoot,
      match,
      'node_modules',
      '@babel',
      'preset-env'
    )
    const presetRequire = createRequire(presetPath)
    return presetRequire(presetPath)
  }
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, files)
      continue
    }
    files.push(fullPath)
  }
  return files
}

function transformJsFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.sjs')) {
    return
  }

  const original = fs.readFileSync(filePath, 'utf8')
  let input = original
  const basename = path.basename(filePath)
  const needsShim = basename === 'vendors.js' || basename === 'app.js' || basename === 'common.js'
  const shimRegex = /\/\*__tmo_global_shim__\*\/[\s\S]*?var global=__tmo_global__;/g
  const looseShimRegex = /var __tmo_global__=[\s\S]*?var global=__tmo_global__;/g
  const shim =
    '/*__tmo_global_shim__*/var __tmo_global__=(typeof globalThis!=="undefined"&&globalThis)||(typeof my!=="undefined"&&my)||(typeof self!=="undefined"&&self)||(typeof window!=="undefined"&&window);if(!__tmo_global__){try{__tmo_global__=Function("return this")();}catch(e){__tmo_global__={};}}if(!__tmo_global__.global){try{__tmo_global__.global=__tmo_global__;}catch(e){}}var global=__tmo_global__;\n'

  if (needsShim) {
    if (input.includes('__tmo_global_shim__')) {
      input = input.replace(shimRegex, '')
    }
    if (input.includes('var __tmo_global__=')) {
      input = input.replace(looseShimRegex, '')
    }
    input = shim + input
  }

  const result = babel.transformSync(input, {
    filename: filePath,
    sourceType: 'unambiguous',
    babelrc: false,
    configFile: false,
    presets: [
      [
        resolvePresetEnv(),
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

  let output = result && result.code ? result.code : input
  if (needsShim) {
    if (output.includes('__tmo_global_shim__')) {
      output = output.replace(shimRegex, '')
    }
    if (output.includes('var __tmo_global__=')) {
      output = output.replace(looseShimRegex, '')
    }
    output = shim + output
  }

  if (basename === 'vendors.js') {
    output = output.replace(/\bglobal\.Date\s*=\s*Date/g, '__tmo_global__.Date=Date')
  }

  if (output !== original) {
    fs.writeFileSync(filePath, output, 'utf8')
  }
}

function patchAppAcss() {
  const appFile = path.join(targetDir, 'app.acss')
  if (!fs.existsSync(appFile)) {
    return
  }

  const content = fs.readFileSync(appFile, 'utf8')
  const updated = content.replace(
    /@import\s+(['"])app-origin\.acss\1;/g,
    '@import "./app-origin.acss";'
  )

  if (updated !== content) {
    fs.writeFileSync(appFile, updated, 'utf8')
  }
}

function patchMiniProject() {
  const projectFile = path.join(targetDir, 'mini.project.json')
  if (!fs.existsSync(projectFile)) {
    const fallback = {
      format: 2,
      miniprogramRoot: './',
      compileType: 'mini'
    }
    fs.writeFileSync(projectFile, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8')
    return
  }

  const content = fs.readFileSync(projectFile, 'utf8')
  let projectConfig

  try {
    projectConfig = JSON.parse(content)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[postprocess-alipay] failed to parse ${projectFile}: ${message}`)
  }

  const root = typeof projectConfig.miniprogramRoot === 'string' ? projectConfig.miniprogramRoot : ''
  const normalized = root.replace(/\\/g, '/')
  if (
    normalized === 'dist' ||
    normalized === './dist' ||
    normalized.startsWith('dist/') ||
    normalized.startsWith('./dist/')
  ) {
    projectConfig.miniprogramRoot = './'
  }

  const updated = `${JSON.stringify(projectConfig, null, 2)}\n`
  if (updated !== content) {
    fs.writeFileSync(projectFile, updated, 'utf8')
  }
}

function run() {
  if (!fs.existsSync(targetDir)) {
    process.exit(0)
  }

  const files = walk(targetDir)
  for (const filePath of files) {
    transformJsFile(filePath)
  }
  patchAppAcss()
  patchMiniProject()
}

run()
