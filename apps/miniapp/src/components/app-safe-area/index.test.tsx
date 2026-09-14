import { render } from '@testing-library/react'
import Taro from '@tarojs/taro'

import AppFixedBottom, { AppSafeAreaBottom } from './index'

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('app bottom safe area primitives', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    asMock(Taro.getWindowInfo).mockReturnValue({
      statusBarHeight: 47,
      screenHeight: 844,
      safeArea: { top: 47, bottom: 810 }
    })
  })

  it('publishes the runtime inset through the shared CSS variable', () => {
    const { container } = render(<AppSafeAreaBottom />)

    expect(container.querySelector('.app-safe-area-bottom')).toHaveStyle({
      '--app-safe-area-bottom': '34px'
    })
  })

  it('includes one safe-area spacer by default', () => {
    const { container } = render(
      <AppFixedBottom contentClassName='checkout-bar'>结算</AppFixedBottom>
    )

    expect(container.querySelectorAll('.app-safe-area-bottom')).toHaveLength(1)
    expect(container.querySelector('.checkout-bar')).toHaveTextContent('结算')
  })

  it('lets native tab pages delegate the system inset to the native tab bar', () => {
    const { container } = render(
      <AppFixedBottom includeSafeArea={false}>结算</AppFixedBottom>
    )

    expect(container.querySelector('.app-safe-area-bottom')).toBeNull()
  })
})
