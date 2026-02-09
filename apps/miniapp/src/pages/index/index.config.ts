const isWeapp = process.env.TARO_ENV === 'weapp'

export default definePageConfig({
  navigationBarTitleText: '首页',
  navigationStyle: isWeapp ? 'default' : 'custom'
})
