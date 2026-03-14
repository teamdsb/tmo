import { act, fireEvent, render, screen } from '@testing-library/react'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const actualReact = jest.requireActual('react')
const actualJsxRuntime = jest.requireActual('react/jsx-runtime')

const loadSettingsPage = (
  isIsolatedMock: boolean,
  bootstrap: { me?: { roles?: string[] } } | null = null
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
        isIsolatedMock
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

  it('shows mock debug actions only in isolated mock mode', async () => {
    const { SettingsPage } = loadSettingsPage(true, { me: { roles: ['CUSTOMER', 'SALES'] } })
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('开发调试')).toBeInTheDocument()
    expect(screen.getByText('切换为业务员 Mock 账号')).toBeInTheDocument()
    expect(screen.getByText('重置 Mock 数据')).toBeInTheDocument()
  })

  it('hides mock debug actions outside isolated mock mode', async () => {
    const { SettingsPage } = loadSettingsPage(false)
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.queryByText('开发调试')).toBeNull()
    expect(screen.queryByText('切换为业务员 Mock 账号')).toBeNull()
  })

  it('runs mock sales login from debug panel', async () => {
    const { SettingsPage, applyMockLogin } = loadSettingsPage(true, { me: { roles: ['SALES'] } })

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

  it('shows sales workbench entry only for logged-in sales users', async () => {
    const { SettingsPage } = loadSettingsPage(false, { me: { roles: ['CUSTOMER', 'SALES'] } })
    render(<SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.getByText('业务员页面')).toBeInTheDocument()
  })

  it('hides sales workbench entry for guest or non-sales users', async () => {
    const guestModule = loadSettingsPage(false, null)
    render(<guestModule.SettingsPage />)

    await act(async () => {
      await flushPromises()
    })

    expect(screen.queryByText('业务员页面')).toBeNull()
    expect(screen.queryByText('紧凑显示')).toBeNull()
  })
})
