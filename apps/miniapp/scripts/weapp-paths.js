const path = require('node:path')
const fs = require('node:fs')

const legacySharedWeappOutputRoot = '/Users/lifuyue/Documents/tmo/apps/miniapp/dist/weapp'

function readBool(rawValue, defaultValue) {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') {
    return defaultValue
  }
  const normalized = rawValue.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return defaultValue
}

function resolveMiniappDir(customMiniappDir) {
  return customMiniappDir
    ? path.resolve(customMiniappDir)
    : path.resolve(__dirname, '..')
}

function resolveDefaultSharedWeappOutputRoot(miniappDir) {
  const currentMiniappDir = resolveMiniappDir(miniappDir)
  const legacyProjectDir = path.resolve(legacySharedWeappOutputRoot, '..', '..')
  if (!fs.existsSync(legacyProjectDir)) {
    return null
  }
  if (legacyProjectDir === currentMiniappDir) {
    return null
  }
  return legacySharedWeappOutputRoot
}

function resolveWeappSharedEnabled(miniappDir) {
  if (typeof process.env.TMO_WEAPP_SHARED_OUTPUT_ENABLED === 'string') {
    return readBool(process.env.TMO_WEAPP_SHARED_OUTPUT_ENABLED, true)
  }
  return resolveDefaultSharedWeappOutputRoot(miniappDir) !== null
}

function resolveWeappSharedOutputRoot(miniappDir) {
  const baseDir = resolveMiniappDir(miniappDir)
  const configured = typeof process.env.TMO_WEAPP_SHARED_OUTPUT_ROOT === 'string'
    ? process.env.TMO_WEAPP_SHARED_OUTPUT_ROOT.trim()
    : ''
  if (!configured) {
    const fallback = resolveDefaultSharedWeappOutputRoot(baseDir)
    if (!fallback) {
      return path.resolve(baseDir, 'dist', 'weapp')
    }
    return fallback
  }
  return path.resolve(baseDir, configured)
}

function resolveOutputRootForTaroEnv(taroEnv, miniappDir) {
  const env = String(taroEnv || 'weapp').trim() || 'weapp'
  const currentMiniappDir = resolveMiniappDir(miniappDir)
  const localOutputRoot = path.resolve(currentMiniappDir, 'dist', env)

  if (env !== 'weapp') {
    return {
      taroEnv: env,
      shared: false,
      absolute: localOutputRoot,
      relativeToMiniapp: path.relative(currentMiniappDir, localOutputRoot) || '.',
      miniappDir: currentMiniappDir
    }
  }

  if (!resolveWeappSharedEnabled(currentMiniappDir)) {
    return {
      taroEnv: env,
      shared: false,
      absolute: localOutputRoot,
      relativeToMiniapp: path.relative(currentMiniappDir, localOutputRoot) || '.',
      miniappDir: currentMiniappDir
    }
  }

  const sharedOutputRoot = resolveWeappSharedOutputRoot(currentMiniappDir)
  return {
    taroEnv: env,
    shared: true,
    absolute: sharedOutputRoot,
    relativeToMiniapp: path.relative(currentMiniappDir, sharedOutputRoot) || '.',
    miniappDir: currentMiniappDir
  }
}

function resolveWeappProjectDir(miniappDir) {
  const currentMiniappDir = resolveMiniappDir(miniappDir)
  const output = resolveOutputRootForTaroEnv('weapp', currentMiniappDir)
  if (!output.shared) {
    return currentMiniappDir
  }
  return path.resolve(output.absolute, '..', '..')
}

function describeWeappPaths(miniappDir) {
  const currentMiniappDir = resolveMiniappDir(miniappDir)
  const output = resolveOutputRootForTaroEnv('weapp', currentMiniappDir)
  const projectDir = resolveWeappProjectDir(currentMiniappDir)
  return {
    miniappDir: currentMiniappDir,
    sharedEnabled: output.shared,
    outputRoot: output.absolute,
    outputRootRelativeToMiniapp: output.relativeToMiniapp,
    projectDir
  }
}

function assertWeappPathsReady(miniappDir) {
  const paths = describeWeappPaths(miniappDir)
  if (!paths.sharedEnabled) {
    return paths
  }

  if (!fs.existsSync(paths.projectDir)) {
    throw new Error(`shared weapp project dir not found: ${paths.projectDir}`)
  }

  const expectedProjectDir = path.resolve(paths.outputRoot, '..', '..')
  if (expectedProjectDir !== paths.projectDir) {
    throw new Error(
      `shared weapp output root must stay under its project dir: output=${paths.outputRoot} project=${paths.projectDir}`
    )
  }

  return paths
}

module.exports = {
  legacySharedWeappOutputRoot,
  resolveDefaultSharedWeappOutputRoot,
  resolveMiniappDir,
  resolveWeappSharedEnabled,
  resolveWeappSharedOutputRoot,
  resolveOutputRootForTaroEnv,
  resolveWeappProjectDir,
  describeWeappPaths,
  assertWeappPathsReady
}
