import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import LoginPage from './index'
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
    expect(screen.getByText('暂不登录').closest('button')).toHaveClass('login-secondary')
    expect(screen.queryByText('测试登录')).not.toBeInTheDocument()
  })

  it('supports alt login action', async () => {
    await renderLoginPage()

    ;(Taro as unknown as { navigateBack?: jest.Mock }).navigateBack = jest.fn(() => Promise.resolve())

    await act(async () => {
      fireEvent.click(screen.getByText('暂不登录'))
      await flushPromises()
    })

    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(Taro.navigateBack).toHaveBeenCalled()
  })
})
