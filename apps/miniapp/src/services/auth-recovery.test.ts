import Taro from '@tarojs/taro'
import { removeStorage } from '@tmo/platform-adapter'

import { recoverUnauthorizedSession } from './auth-recovery'

describe('unauthorized session recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Taro.getCurrentPages as jest.Mock).mockReturnValue([{ route: 'pages/cart/index' }])
    localStorage.setItem('tmo:auth:token', 'expired-token')
    localStorage.setItem('tmo:commerce:token', 'legacy-token')
  })

  it('clears shared auth state and redirects to login', async () => {
    await recoverUnauthorizedSession()

    expect(removeStorage).toHaveBeenCalledWith('tmo:auth:token')
    expect(removeStorage).toHaveBeenCalledWith('tmo:commerce:token')
    expect(removeStorage).toHaveBeenCalledWith('tmo:bootstrap')
    expect(removeStorage).toHaveBeenCalledWith('tmo:auth:role-selection')
    expect(localStorage.getItem('tmo:auth:token')).toBeNull()
    expect(localStorage.getItem('tmo:commerce:token')).toBeNull()
    expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/auth/login/index' })
  })

  it('coalesces simultaneous unauthorized responses into one redirect', async () => {
    await Promise.all([
      recoverUnauthorizedSession(),
      recoverUnauthorizedSession(),
      recoverUnauthorizedSession()
    ])

    expect(Taro.reLaunch).toHaveBeenCalledTimes(1)
  })
})
