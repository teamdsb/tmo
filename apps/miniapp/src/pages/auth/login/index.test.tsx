import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import LoginPage from './index'
import { gatewayServices } from '../../../services/gateway'
import { identityServices } from '../../../services/identity'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const setRouterParams = (params: Record<string, string> = {}) => {
  ;(globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

const renderLoginPage = async () => {
  render(<LoginPage />)
  await act(async () => {
    await flushPromises()
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setRouterParams()
  })

  it('renders hero copy and action hierarchy classes', async () => {
    await renderLoginPage()

    expect(screen.getByText('批发合作伙伴')).toBeInTheDocument()
    expect(screen.getByText('登录后可查看专属价格。')).toBeInTheDocument()
    expect(screen.getByText('快速登录').closest('button')).toHaveClass('login-primary')
    expect(screen.getByText('测试登录').closest('button')).toHaveClass('login-secondary')
    expect(screen.getByText('暂不登录').closest('button')).toHaveClass('login-ghost')

    const hero = document.querySelector('.login-hero')
    expect(hero).not.toBeNull()
  })

  it('blocks quick login before agreement is checked', async () => {
    await renderLoginPage()

    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(identityServices.auth.miniLogin).not.toHaveBeenCalled()
    expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '请先同意条款。' }))
  })

  it('handles quick login after agreement and switches to tab page', async () => {
    await renderLoginPage()

    await act(async () => {
      const agreement = document.querySelector('.login-agreement')
      if (!agreement) {
        throw new Error('missing agreement element')
      }
      fireEvent.click(agreement)
      await flushPromises()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(identityServices.auth.miniLogin).toHaveBeenCalledTimes(1)
    expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(1)
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })

  it('supports mock login and alt login actions', async () => {
    await renderLoginPage()

    await act(async () => {
      fireEvent.click(screen.getByText('测试登录'))
      await flushPromises()
    })

    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
    ;(Taro as { navigateBack?: jest.Mock }).navigateBack = jest.fn(() => Promise.resolve())

    await act(async () => {
      fireEvent.click(screen.getByText('暂不登录'))
      await flushPromises()
    })

    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(Taro.navigateBack).toHaveBeenCalled()
  })
})
