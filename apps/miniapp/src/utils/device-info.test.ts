import Taro from '@tarojs/taro'

import { getRuntimeDeviceInfo } from './device-info'

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('bottom safe area metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    asMock(Taro.getSystemInfoSync).mockReturnValue({
      statusBarHeight: 20,
      screenHeight: 667,
      windowHeight: 667
    })
  })

  it('prefers an explicit bottom safe-area inset, including a real zero value', () => {
    asMock(Taro.getWindowInfo).mockReturnValue({
      statusBarHeight: 20,
      screenHeight: 844,
      safeArea: { top: 47, bottom: 810 },
      safeAreaInsets: { top: 47, bottom: 0 }
    })

    expect(getRuntimeDeviceInfo()).toMatchObject({
      bottomSafeArea: 0,
      bottomSafeAreaAvailable: true
    })
  })

  it('derives the bottom inset from screen height and safe-area bottom', () => {
    asMock(Taro.getWindowInfo).mockReturnValue({
      statusBarHeight: 47,
      screenHeight: 844,
      safeArea: { top: 47, bottom: 810 }
    })

    expect(getRuntimeDeviceInfo()).toMatchObject({
      bottomSafeArea: 34,
      bottomSafeAreaAvailable: true
    })
  })

  it('falls back to legacy system information when window information is incomplete', () => {
    asMock(Taro.getWindowInfo).mockReturnValue({ statusBarHeight: 20 })
    asMock(Taro.getSystemInfoSync).mockReturnValue({
      statusBarHeight: 20,
      screenHeight: 812,
      safeArea: { top: 44, bottom: 778 }
    })

    expect(getRuntimeDeviceInfo()).toMatchObject({
      bottomSafeArea: 34,
      bottomSafeAreaAvailable: true
    })
  })

  it('distinguishes unavailable data from a device with no bottom inset', () => {
    asMock(Taro.getWindowInfo).mockReturnValue({ statusBarHeight: 20 })

    expect(getRuntimeDeviceInfo()).toMatchObject({
      bottomSafeArea: 0,
      bottomSafeAreaAvailable: false
    })
  })
})
