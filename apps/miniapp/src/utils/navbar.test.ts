describe('navbar metrics', () => {
  const loadModule = () => require('./navbar') as typeof import('./navbar')
  const loadTaro = () => require('@tarojs/taro').default as {
    getSystemInfoSync: jest.Mock
    getMenuButtonBoundingClientRect: jest.Mock
  }

  beforeEach(() => {
    jest.resetModules()
    process.env.TARO_ENV = 'h5'
  })

  it('uses menu button metrics when valid', () => {
    const Taro = loadTaro()
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
