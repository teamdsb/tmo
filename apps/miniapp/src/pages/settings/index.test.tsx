import { act, fireEvent, render, screen, within } from '@testing-library/react'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const actualReact = jest.requireActual('react')
const actualJsxRuntime = jest.requireActual('react/jsx-runtime')

type BootstrapMock = {
  me?: {
    displayName?: string
    currentRole?: string
    roles?: string[]
  }
} | null

const loadSettingsPage = (
  runtimeOverrides: {
    isIsolatedMock?: boolean
    gatewayBaseUrl?: string
    commerceBaseUrl?: string
    identityBaseUrl?: string
    devFakePaymentEnabled?: boolean
  } = {},
  bootstrap: BootstrapMock = null
) => {
  let moduleValue:
    | {
        SettingsPage: typeof import('./index').default
        applyMockLogin: jest.Mock
      }
    | undefined

  jest.isolateModules(() => {
    const applyMockLogin = jest.fn(async () => {})
    jest.doMock('react', () => actualReact)
    jest.doMock('react/jsx-runtime', () => actualJsxRuntime)
    jest.doMock('../../config/runtime-env', () => ({
      runtimeEnv: {
        isIsolatedMock: false,
        gatewayBaseUrl: 'http://localhost:8080',
        commerceBaseUrl: 'http://localhost:8082',
        identityBaseUrl: 'http://localhost:8081',
        devFakePaymentEnabled: true,
        ...runtimeOverrides
      }
    }))
    jest.doMock('../../services/bootstrap', () => ({
      clearBootstrap: jest.fn(async () => {}),
      loadBootstrap: jest.fn(async () => bootstrap)
    }))
    jest.doMock('../../services/mock-auth', () => ({
      applyMockLogin
    }))

    moduleValue = {
      SettingsPage: require('./index').default,
      applyMockLogin
    }
  })

  if (!moduleValue) {
    throw new Error('failed to load settings page')
  }

  return moduleValue
}

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  it('renders cards in the updated order with account card first', async () => {
    const { SettingsPage } = loadSettingsPage({ isIsolatedMock: true })
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByTestId('settings-basic-card')).toBeInTheDocument()
    expect(screen.getByTestId('settings-account-card')).toBeInTheDocument()
    expect(screen.getByTestId('settings-policy-card')).toBeInTheDocument()
    expect(screen.getByTestId('settings-debug-card')).toBeInTheDocument()
    expect(screen.getByTestId('settings-env-card')).toBeInTheDocument()
    expect(screen.getByText('账号与角色信息')).toBeInTheDocument()
    expect(screen.getByText('订单通知')).toBeInTheDocument()
    expect(screen.getByText('自动登录')).toBeInTheDocument()
    expect(screen.getByText('隐私与协议')).toBeInTheDocument()
    expect(screen.getByText('版本与环境信息')).toBeInTheDocument()
  })

  it('shows mock debug actions only in isolated mock mode', async () => {
    const { SettingsPage } = loadSettingsPage(
      { isIsolatedMock: true },
      { me: { displayName: '张三', currentRole: 'SALES', roles: ['CUSTOMER', 'SALES'] } }
    )
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('开发调试')).toBeInTheDocument()
    expect(screen.getByText('切换为业务员 Mock 账号')).toBeInTheDocument()
    expect(screen.getByText('重置 Mock 数据')).toBeInTheDocument()
  })

  it('hides mock debug actions outside isolated mock mode', async () => {
    const { SettingsPage } = loadSettingsPage()
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.queryByText('开发调试')).toBeNull()
    expect(screen.queryByText('切换为业务员 Mock 账号')).toBeNull()
  })

  it('runs mock sales login from debug panel', async () => {
    const { SettingsPage, applyMockLogin } = loadSettingsPage(
      { isIsolatedMock: true },
      { me: { displayName: '张三', currentRole: 'SALES', roles: ['SALES'] } }
    )

    render(<SettingsPage />)
    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('切换为业务员 Mock 账号'))
      await flushPromises()
    })

    expect(applyMockLogin).toHaveBeenCalled()
  })

  it('shows account and role info for logged-in sales users and places sales entry in account card', async () => {
    const { SettingsPage } = loadSettingsPage(
      {},
      { me: { displayName: '张三', currentRole: 'SALES', roles: ['CUSTOMER', 'SALES'] } }
    )
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    const accountCard = screen.getByTestId('settings-account-card')
    const basicCard = screen.getByTestId('settings-basic-card')

    expect(within(accountCard).getByText('张三')).toBeInTheDocument()
    expect(within(accountCard).getByText('SALES')).toBeInTheDocument()
    expect(within(accountCard).getByText('CUSTOMER / SALES')).toBeInTheDocument()
    expect(within(accountCard).getByText('业务员页面')).toBeInTheDocument()
    expect(within(basicCard).queryByText('业务员页面')).toBeNull()
  })

  it('shows guest account hint and hides sales workbench entry for guests', async () => {
    const { SettingsPage } = loadSettingsPage({}, null)
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    const accountCard = screen.getByTestId('settings-account-card')
    expect(within(accountCard).queryByText('业务员页面')).toBeNull()
    expect(screen.getByText('当前未登录')).toBeInTheDocument()
    expect(screen.getByText('去登录')).toBeInTheDocument()
  })

  it('expands only one privacy section at a time', async () => {
    const { SettingsPage } = loadSettingsPage()
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('隐私政策'))
      await flushPromises()
    })
    expect(screen.getByText(/我们会在登录、下单、收货与售后流程中处理账号信息/)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('服务条款'))
      await flushPromises()
    })
    expect(screen.getByText(/账号需按真实业务身份使用/)).toBeInTheDocument()
    expect(screen.queryByText(/我们会在登录、下单、收货与售后流程中处理账号信息/)).toBeNull()
  })

  it('shows version and environment summary and details', async () => {
    const { SettingsPage } = loadSettingsPage({
      isIsolatedMock: false,
      gatewayBaseUrl: 'http://localhost:8080',
      commerceBaseUrl: 'http://localhost:8082',
      identityBaseUrl: 'http://localhost:8081',
      devFakePaymentEnabled: true
    })
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('版本与环境信息')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('Real')).toBeInTheDocument()
    expect(screen.getByText('http://localhost:8080')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('查看详情'))
      await flushPromises()
    })

    expect(screen.getAllByText('http://localhost:8082').length).toBeGreaterThan(0)
    expect(screen.getAllByText('http://localhost:8081').length).toBeGreaterThan(0)
    expect(screen.getByText('已开启')).toBeInTheDocument()
  })
})
