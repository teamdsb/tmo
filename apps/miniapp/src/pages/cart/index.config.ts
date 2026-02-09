const isWeapp = process.env.TARO_ENV === 'weapp'

export default definePageConfig({
  navigationBarTitleText: '购物车',
  navigationStyle: isWeapp ? 'default' : 'custom'
})
