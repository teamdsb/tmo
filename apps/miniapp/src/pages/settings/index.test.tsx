import { act, fireEvent, render, screen } from '@testing-library/react'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))
const actualReact = jest.requireActual('react')
const actualJsxRuntime = jest.requireActual('react/jsx-runtime')

const loadSettingsPage = (isIsolatedMock: boolean) => {
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
    const { SettingsPage } = loadSettingsPage(true)
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
    const { SettingsPage, applyMockLogin } = loadSettingsPage(true)

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
})
