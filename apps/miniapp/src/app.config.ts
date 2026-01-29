export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/category/index',
    'pages/auth/login/index',
    'pages/auth/role-select/index',
    'pages/mine/index',
    'pages/favorites/index',
    'pages/goods/search/index',
    'pages/goods/detail/index',
    'pages/cart/index',
    'pages/order/list/index',
    'pages/demand/index',
    'pages/demand/list/index',
    'pages/demand/create/index',
    'pages/order/confirm/index',
    'pages/order/detail/index',
    'pages/order/tracking/index',
    'pages/account/address/index',
    'pages/import/index',
    'pages/tracking/batch/index',
    'pages/settings/index',
    'pages/support/index',
    'pages/support/create/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'WeChat',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom'
  }
})
