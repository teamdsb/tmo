import { act, fireEvent, render, screen } from '@testing-library/react'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock
const actualReact = jest.requireActual('react')
const actualJsxRuntime = jest.requireActual('react/jsx-runtime')

type LoadedLoginModule = {
  LoginPage: typeof import('./index').default
  identityServices: typeof import('../../../services/identity').identityServices
  gatewayServices: typeof import('../../../services/gateway').gatewayServices
  ApiError: typeof import('@tmo/identity-services').ApiError
  Taro: typeof import('@tarojs/taro')
}

type LoadLoginModuleOptions = {
  platform?: 'weapp' | 'unknown'
  weappPhoneProofSimulation?: boolean
}

const setRouterParams = (params: Record<string, string> = {}) => {
  ;(globalThis as { __setTaroRouterParams?: (input: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}

const loadLoginModule = (options: LoadLoginModuleOptions = {}) => {
  const {
    platform = 'weapp',
    weappPhoneProofSimulation = true
  } = options
  let moduleValue: LoadedLoginModule | undefined

  jest.isolateModules(() => {
    jest.doMock('react', () => actualReact)
    jest.doMock('react/jsx-runtime', () => actualJsxRuntime)
    jest.doMock('../../../config/runtime-env', () => ({
      runtimeEnv: {
        isIsolatedMock: false,
        enableMockLogin: false,
        weappPhoneProofSimulation,
        identityDevToken: undefined,
        gatewayDevToken: undefined
      },
      requireIdentityBaseUrl: () => 'http://localhost:8080',
      requireGatewayBaseUrl: () => 'http://localhost:8080'
    }))

    const pageModule = require('./index')
    const identityModule = require('../../../services/identity')
    const gatewayModule = require('../../../services/gateway')
    const identityServicesModule = require('@tmo/identity-services')
    const taroModule = require('@tarojs/taro')
    const platformAdapterModule = require('@tmo/platform-adapter')

    platformAdapterModule.getPlatform.mockReturnValue(platform)

    moduleValue = {
      LoginPage: pageModule.default,
      identityServices: identityModule.identityServices,
      gatewayServices: gatewayModule.gatewayServices,
      ApiError: identityServicesModule.ApiError,
      Taro: taroModule.default
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

const agreeToTerms = async () => {
  const agreement = screen.getByText('我已阅读并同意隐私政策与服务条款。').parentElement
  if (!agreement) {
    throw new Error('agreement toggle not found')
  }

  await act(async () => {
    fireEvent.click(agreement)
    await flushPromises()
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    setRouterParams()
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
    const { LoginPage, identityServices, Taro: runtimeTaro } = loadLoginModule()
    await renderLoginPage(LoginPage)

    ;(runtimeTaro as unknown as { navigateBack?: jest.Mock }).navigateBack = jest.fn(() => Promise.resolve())

    await act(async () => {
      fireEvent.click(screen.getByText('暂不登录'))
      await flushPromises()
    })

    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(runtimeTaro.navigateBack).toHaveBeenCalled()
  })

  it('shows explicit dev mismatch toast when simulated proof hits invalid login code', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError, Taro: runtimeTaro } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('invalid login code', 400, { code: 'invalid_request' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await agreeToTerms()
    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(runtimeTaro.showToast).toHaveBeenCalledWith({
      title: '开发环境模拟登录配置不一致，请开启 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION 后重试',
      icon: 'none'
    })
  })

  it('shows explicit dev mismatch toast when simulated proof still gets phone_required', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError, Taro: runtimeTaro } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('phone proof is required', 400, { code: 'phone_required' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await agreeToTerms()
    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(runtimeTaro.showToast).toHaveBeenCalledWith({
      title: '开发环境模拟登录配置不一致，请开启 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION 后重试',
      icon: 'none'
    })
  })

  it('keeps generic failure toast when simulation is disabled', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError, Taro: runtimeTaro } = loadLoginModule({
      platform: 'unknown',
      weappPhoneProofSimulation: false
    })
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('invalid login code', 400, { code: 'invalid_request' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await agreeToTerms()
    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(runtimeTaro.showToast).toHaveBeenCalledWith({
      title: '登录失败，请重试。',
      icon: 'none'
    })
  })

  it('shows explicit simulated identity conflict toast before backend fix is live', async () => {
    const { LoginPage, identityServices, gatewayServices, ApiError, Taro: runtimeTaro } = loadLoginModule()
    asMock(identityServices.auth.miniLogin).mockRejectedValue(
      new ApiError('identity already bound', 409, { code: 'conflict' })
    )
    asMock(gatewayServices.bootstrap.get).mockResolvedValue({
      me: { id: 'u-1', roles: ['CUSTOMER'] },
      permissions: { items: [] },
      featureFlags: {}
    })

    await renderLoginPage(LoginPage)

    await agreeToTerms()
    await act(async () => {
      fireEvent.click(screen.getByText('快速登录'))
      await flushPromises()
    })

    expect(runtimeTaro.showToast).toHaveBeenCalledWith({
      title: '本地模拟账号与 seed 绑定冲突，请重启 identity 容器或更新后端后重试',
      icon: 'none'
    })
  })
})
