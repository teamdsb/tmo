import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

const setRouterParams = (params: Record<string, string> = {}) => {
  ;(globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

const loadLoginModule = () => {
  let moduleValue: {
    LoginPage: typeof import('./index').default
    identityServices: typeof import('../../../services/identity').identityServices
    gatewayServices: typeof import('../../../services/gateway').gatewayServices
    ApiError: typeof import('@tmo/identity-services').ApiError
  } | null = null

  jest.isolateModules(() => {
    const pageModule = require('./index')
    const identityModule = require('../../../services/identity')
    const gatewayModule = require('../../../services/gateway')
    const identityServicesModule = require('@tmo/identity-services')

    moduleValue = {
      LoginPage: pageModule.default,
      identityServices: identityModule.identityServices,
      gatewayServices: gatewayModule.gatewayServices,
      ApiError: identityServicesModule.ApiError
    }
  })

  if (!moduleValue) {
    throw new Error('failed to load login module')
  }

  return moduleValue
}

const renderLoginPage = async (LoginPage: typeof import('./index').default) => {
  render(<LoginPage />)
  await act(async () => {
    await flushPromises()
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    setRouterParams()
    process.env.TARO_APP_WEAPP_PHONE_PROOF_SIMULATION = 'true'
  })

  it('renders hero copy and action hierarchy classes', async () => {
    const { LoginPage } = loadLoginModule()
    await renderLoginPage(LoginPage)

    expect(screen.getByText('批发合作伙伴')).toBeInTheDocument()
    expect(screen.getByText('登录后可查看专属价格。')).toBeInTheDocument()
    expect(screen.getByText('快速登录').closest('button')).toHaveClass('login-primary')
    expect(screen.getByText('暂不登录').closest('button')).toHaveClass('login-secondary')
    expect(screen.queryByText('测试登录')).not.toBeInTheDocument()
  })

  it('supports alt login action', async () => {
    const { LoginPage, identityServices } = loadLoginModule()
    await renderLoginPage(LoginPage)

    ;(Taro as unknown as { navigateBack?: jest.Mock }).navigateBack = jest.fn(() => Promise.resolve())

    await act(async () => {
      fireEvent.click(screen.getByText('暂不登录'))
      await flushPromises()
    })

    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(Taro.navigateBack).toHaveBeenCalled()
  })

  it('shows explicit dev mismatch toast when simulated proof hits invalid login code', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('invalid login code', 400, { code: 'invalid_request' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await act(async () => {
      fireEvent.click(screen.getByText('我已阅读并同意隐私政策与服务条款。'))
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '开发环境模拟登录配置不一致，请开启 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION 后重试',
      icon: 'none'
    })
  })

  it('shows explicit dev mismatch toast when simulated proof still gets phone_required', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('phone proof is required', 400, { code: 'phone_required' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await act(async () => {
      fireEvent.click(screen.getByText('我已阅读并同意隐私政策与服务条款。'))
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '开发环境模拟登录配置不一致，请开启 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION 后重试',
      icon: 'none'
    })
  })

  it('keeps generic failure toast when simulation is disabled', async () => {
    process.env.TARO_APP_WEAPP_PHONE_PROOF_SIMULATION = 'false'
    const { LoginPage, identityServices, gatewayServices, ApiError } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('invalid login code', 400, { code: 'invalid_request' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await act(async () => {
      fireEvent.click(screen.getByText('我已阅读并同意隐私政策与服务条款。'))
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(Taro.showToast).toHaveBeenCalledWith({
      title: '登录失败，请重试。',
      icon: 'none'
    })
  })
})
