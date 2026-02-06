const path = require('node:path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const { getMetroConfig } = require('@tarojs/rn-supporter')

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const workspaceRoot = path.resolve(__dirname, '../..')

const config = {
  resolver: {
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    nodeModulesPaths: [
      path.join(__dirname, 'node_modules'),
      path.join(workspaceRoot, 'node_modules')
    ]
  },
  watchFolders: [workspaceRoot]
}

module.exports = (async function () {
  return mergeConfig(getDefaultConfig(__dirname), await getMetroConfig(), config)
})()
