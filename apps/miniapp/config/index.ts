import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

const postcssConfig = {
  pxtransform: {
    enable: true,
    config: {}
  },
  autoprefixer: {
    enable: true,
    config: {}
  },
  cssModules: {
    enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
    config: {
      namingPattern: 'module', // 转换模式，取值为 global/module
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    }
  }
}

const defineConstants = {
  __TMO_API_BASE_URL__: JSON.stringify(process.env.TARO_APP_API_BASE_URL ?? ''),
  __TMO_GATEWAY_BASE_URL__: JSON.stringify(process.env.TARO_APP_GATEWAY_BASE_URL ?? ''),
  __TMO_COMMERCE_BASE_URL__: JSON.stringify(process.env.TARO_APP_COMMERCE_BASE_URL ?? ''),
  __TMO_IDENTITY_BASE_URL__: JSON.stringify(process.env.TARO_APP_IDENTITY_BASE_URL ?? ''),
  __TMO_GATEWAY_DEV_TOKEN__: JSON.stringify(process.env.TARO_APP_GATEWAY_DEV_TOKEN ?? ''),
  __TMO_COMMERCE_DEV_TOKEN__: JSON.stringify(process.env.TARO_APP_COMMERCE_DEV_TOKEN ?? ''),
  __TMO_IDENTITY_DEV_TOKEN__: JSON.stringify(process.env.TARO_APP_IDENTITY_DEV_TOKEN ?? ''),
  __TMO_MOCK_MODE__: JSON.stringify(process.env.TARO_APP_MOCK_MODE ?? ''),
  __TMO_COMMERCE_MOCK_FALLBACK__: JSON.stringify(process.env.TARO_APP_COMMERCE_MOCK_FALLBACK ?? ''),
  __TMO_ENABLE_MOCK_LOGIN__: JSON.stringify(process.env.TARO_APP_ENABLE_MOCK_LOGIN ?? ''),
  __TMO_WEAPP_PHONE_PROOF_SIMULATION__: JSON.stringify(process.env.TARO_APP_WEAPP_PHONE_PROOF_SIMULATION ?? '')
}

export default defineConfig<'vite'>(async (merge) => {
  const taroEnv = process.env.TARO_ENV || 'weapp'
  const outputRoot = `dist/${taroEnv}`

  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'miniapp',
    date: '2026-1-22',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot,
    plugins: [
      "@tarojs/plugin-generator"
    ],
    defineConstants,
    modifyViteConfig(config) {
      if (process.env.TARO_ENV !== 'alipay') {
        return
      }

      const build = config.build ?? {}
      config.build = {
        ...build,
        target: 'es5',
        cssCodeSplit: false
      }
      config.esbuild = {
        ...(config.esbuild ?? {}),
        target: 'es5'
      }

      config.plugins = config.plugins ?? []
      config.plugins.push({
        name: 'taro-alipay-es5-override',
        enforce: 'post',
        config: () => ({
          build: {
            target: 'es5',
            cssCodeSplit: false
          },
          esbuild: {
            target: 'es5'
          }
        })
      })
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/fonts',
          to: 'assets/fonts'
        },
        {
          from: 'src/assets/tabbar',
          to: 'assets/tabbar'
        }
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: 'vite',
    postcss: postcssConfig,
    mini: {
      postcss: postcssConfig,
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: postcssConfig,
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
