describe('navbar metrics', () => {
  const loadModule = () => require('./navbar') as typeof import('./navbar')
  const loadTaro = () => require('@tarojs/taro').default as {
    getSystemInfoSync: jest.Mock
    getMenuButtonBoundingClientRect: jest.Mock
  }

  beforeEach(() => {
    jest.resetModules()
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
      top: 24,
      height: 32,
      lineHeight: 32
    })
    expect(getNavbarStyle()).toMatchObject({
      '--navbar-top': '24px',
      '--navbar-height': '32px',
      '--navbar-line-height': '32px',
      '--navbar-total-height': '56px'
    })
    expect(getNavbarTotalHeight()).toBe(56)
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
      top: 24,
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
      top: 24,
      height: 32,
      lineHeight: 32
    })
  })
})
