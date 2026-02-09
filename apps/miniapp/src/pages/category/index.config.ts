const isWeapp = process.env.TARO_ENV === 'weapp'

export default definePageConfig({
  navigationBarTitleText: '分类',
  navigationStyle: isWeapp ? 'default' : 'custom'
})
