import fs from 'node:fs'
import path from 'node:path'

describe('navbar metrics', () => {
  const loadModule = () => require('./navbar') as typeof import('./navbar')
  const loadTaro = () => require('@tarojs/taro').default as {
    getSystemInfoSync: jest.Mock
    getWindowInfo: jest.Mock
    getAppBaseInfo: jest.Mock
    getMenuButtonBoundingClientRect: jest.Mock
  }

  beforeEach(() => {
    jest.resetModules()
    process.env.TARO_ENV = 'h5'
  })

  it('uses menu button metrics when valid', () => {
    const Taro = loadTaro()
    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 20 }
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'light'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 20 }
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 24,
      height: 32
    })

    const { getNavbarMetrics, getNavbarStyle, getNavbarTotalHeight } = loadModule()

    expect(getNavbarMetrics()).toEqual({
      top: 20,
      height: 32,
      lineHeight: 32
    })
    expect(getNavbarStyle()).toMatchObject({
      '--navbar-top': '20px',
      '--navbar-height': '32px',
      '--navbar-line-height': '32px',
      '--navbar-total-height': '52px'
    })
    expect(getNavbarTotalHeight()).toBe(52)
  })

  it('falls back to safeArea top and default height when menu button is invalid', () => {
    const Taro = loadTaro()
    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 28 }
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'light'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 28 }
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 0,
      height: 0
    })

    const { getNavbarMetrics, getNavbarTotalHeight } = loadModule()

    expect(getNavbarMetrics()).toEqual({
      top: 28,
      height: 44,
      lineHeight: 44
    })
    expect(getNavbarTotalHeight()).toBe(72)
  })

  it('falls back to status bar top when safeArea is missing', () => {
    const Taro = loadTaro()
    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 18
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'light'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 18
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue(null)

    const { getNavbarMetrics, getNavbarTotalHeight } = loadModule()

    expect(getNavbarMetrics()).toEqual({
      top: 18,
      height: 44,
      lineHeight: 44
    })
    expect(getNavbarTotalHeight()).toBe(62)
  })

  it('caches metrics after first read', () => {
    const Taro = loadTaro()
    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 20 }
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'light'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 20,
      safeArea: { top: 20 }
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 24,
      height: 32
    })

    const { getNavbarMetrics } = loadModule()
    expect(getNavbarMetrics()).toEqual({
      top: 20,
      height: 32,
      lineHeight: 32
    })

    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 30,
      safeArea: { top: 30 }
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'dark'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 30,
      safeArea: { top: 30 }
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 36,
      height: 40
    })

    expect(getNavbarMetrics()).toEqual({
      top: 20,
      height: 32,
      lineHeight: 32
    })
  })

  it('uses top 0 in alipay env', () => {
    process.env.TARO_ENV = 'alipay'
    const Taro = loadTaro()
    Taro.getWindowInfo.mockReturnValue({
      statusBarHeight: 24,
      safeArea: { top: 24 }
    })
    Taro.getAppBaseInfo.mockReturnValue({
      theme: 'light'
    })
    Taro.getSystemInfoSync.mockReturnValue({
      statusBarHeight: 24,
      safeArea: { top: 24 }
    })
    Taro.getMenuButtonBoundingClientRect.mockReturnValue({
      top: 32,
      height: 36
    })

    const { getNavbarMetrics, getNavbarStyle, getNavbarTotalHeight } = loadModule()

    expect(getNavbarMetrics()).toEqual({
      top: 0,
      height: 36,
      lineHeight: 36
    })
    expect(getNavbarStyle()).toMatchObject({
      '--navbar-top': '0px',
      '--navbar-height': '36px',
      '--navbar-line-height': '36px',
      '--navbar-total-height': '36px'
    })
    expect(getNavbarTotalHeight()).toBe(36)
  })
})

describe('secondary navbar usage', () => {
  const secondaryPageFiles = [
    'pages/account/address/index.tsx',
    'pages/import/index.tsx',
    'pages/settings/index.tsx',
    'pages/support/create/index.tsx',
    'pages/demand/create/index.tsx',
    'pages/tracking/batch/index.tsx',
    'pages/support/support-customer-view.tsx',
    'pages/support/support-sales-view.tsx',
    'pages/favorites/index.tsx',
    'pages/demand/list/index.tsx',
    'pages/goods/detail/index.tsx',
    'pages/profile/edit/index.tsx',
    'pages/order/list/index.tsx',
    'pages/demand/index.tsx',
    'pages/order/tracking/detail/index.tsx',
    'pages/support/chat/index.tsx',
    'pages/goods/search/index.tsx',
    'pages/order/detail/index.tsx',
    'pages/order/confirm/index.tsx',
    'pages/order/tracking/index.tsx'
  ]

  it.each(secondaryPageFiles)('%s uses the shared secondary navbar contract', (relativeFile) => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', relativeFile), 'utf8')

    expect(source).toContain('app-navbar--secondary')
    expect(source).not.toMatch(/<Navbar[^>]*safeArea=['"]top['"]/)
  })

  it('uses a single device-driven box model for secondary navbars', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../app.scss'), 'utf8')

    expect(stylesheet).toContain('.app-navbar--secondary .taroify-navbar__content {')
    expect(stylesheet).toContain('box-sizing: border-box;')
    expect(stylesheet).toContain('.app-navbar--secondary .taroify-navbar__left,')
    expect(stylesheet).toContain('top: var(--navbar-top, 0);')
    expect(stylesheet).not.toContain('height: calc(var(--navbar-total-height, 64px) - 12px);')
  })
})
