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
    navigationBarTitleText: '微信',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom'
  },
  tabBar: {
    color: '#6b7280',
    selectedColor: '#137fec',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/tab-default.png',
        selectedIconPath: 'assets/tabbar/tab-active.png'
      },
      {
        pagePath: 'pages/category/index',
        text: '分类',
        iconPath: 'assets/tabbar/tab-default.png',
        selectedIconPath: 'assets/tabbar/tab-active.png'
      },
      {
        pagePath: 'pages/cart/index',
        text: '购物车',
        iconPath: 'assets/tabbar/tab-default.png',
        selectedIconPath: 'assets/tabbar/tab-active.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/tab-default.png',
        selectedIconPath: 'assets/tabbar/tab-active.png'
      }
    ]
  }
})
