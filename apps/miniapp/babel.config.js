// babel-preset-taro 更多选项和默认值：
// https://docs.taro.zone/docs/next/babel-config
module.exports = (api) => {
  const isTest = api.env('test')

  return {
    presets: [
      ['taro', {
        framework: 'react',
        ts: true,
        compiler: isTest ? 'webpack' : 'vite',
      }]
    ]
  }
}
