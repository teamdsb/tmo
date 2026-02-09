const isWeapp = process.env.TARO_ENV === 'weapp'

export default definePageConfig({
  navigationBarTitleText: '我的',
  navigationStyle: isWeapp ? 'default' : 'custom'
})
