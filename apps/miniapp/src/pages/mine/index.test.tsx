import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { removeStorage } from '@tmo/platform-adapter'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import PersonalCenter from './index'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const renderPersonalCenter = async () => {
  render(<PersonalCenter />)
  await act(async () => {
    await flushPromises()
  })
}

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('PersonalCenter', () => {
  beforeEach(() => {
    asMock(identityServices.tokens.getToken).mockResolvedValue('token-123')
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: {
        displayName: '张三',
        ownerSalesDisplayName: '李经理',
        roles: ['客户经理']
      }
    }))
    asMock(gatewayServices.bootstrap.get).mockClear()
    asMock(gatewayServices.tokens.setToken).mockClear()
    asMock(commerceServices.tokens.setToken).mockClear()
    asMock(identityServices.tokens.setToken).mockClear()
    asMock(removeStorage).mockClear()
  })

  it('renders user info and key sections', async () => {
    await renderPersonalCenter()

    const navbar = document.querySelector('.app-navbar.app-navbar--primary')
    expect(navbar).not.toBeNull()

    expect(await screen.findByText('张三')).toBeInTheDocument()
    expect(screen.getByText('客户经理')).toBeInTheDocument()
    expect(screen.getAllByText(/李经理/)).toHaveLength(2)
    expect(screen.getByText('专属顾问')).toBeInTheDocument()
    expect(screen.getByText('下单后由专属顾问继续报价、确认货源与同步发货进度。')).toBeInTheDocument()
  })

  it('hides manager card when not logged in', async () => {
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: undefined
    }))

    await renderPersonalCenter()

    expect(await screen.findByText('未登录')).toBeInTheDocument()
    expect(screen.queryByText('客户经理')).not.toBeInTheDocument()
    expect(screen.queryByText('李经理')).not.toBeInTheDocument()
  })

  it('clears tokens and updates UI after logout', async () => {
    await renderPersonalCenter()

    const button = screen.getByRole('button', { name: '切换账号或退出登录' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('id', 'mine-logout-btn')

    await act(async () => {
      fireEvent.click(button)
      await flushPromises()
    })

    expect(gatewayServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(commerceServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(identityServices.tokens.setToken).toHaveBeenCalledWith(null)
    expect(removeStorage).toHaveBeenCalledWith('tmo:bootstrap')

    await waitFor(() => {
      expect(screen.getByText('未登录')).toBeInTheDocument()
    })
  })

  it('renders key menu entries', async () => {
    await renderPersonalCenter()

    expect(screen.getByText('订单跟踪')).toBeInTheDocument()
    expect(screen.getByText('我的需求')).toBeInTheDocument()
    expect(screen.getByText('收藏')).toBeInTheDocument()
    expect(screen.getByText('物流跟踪')).toBeInTheDocument()
    expect(screen.getByText('系统设置')).toBeInTheDocument()
  })

  it('opens manager chat and sends a message', async () => {
    await renderPersonalCenter()

    fireEvent.click(screen.getByText('立即沟通'))

    expect(await screen.findByText('联系经理')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('请输入...')
    fireEvent.change(input, { target: { value: '在吗' } })
    expect(input).toHaveValue('在吗')

    fireEvent.click(document.querySelector('.mine-modern-chat-send-btn') as Element)

    await waitFor(() => {
      expect(screen.getByText('在吗')).toBeInTheDocument()
    })
  })

  it('falls back to guest state without token and does not refresh bootstrap', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)

    await renderPersonalCenter()

    expect(await screen.findByText('未登录')).toBeInTheDocument()
    expect(gatewayServices.bootstrap.get).not.toHaveBeenCalled()
    expect(removeStorage).toHaveBeenCalledWith('tmo:bootstrap')
  })

  it('filters orders by selected tracking status', async () => {
    await renderPersonalCenter()

    await act(async () => {
      fireEvent.click(screen.getByText('已发货'))
      await flushPromises()
    })

    expect(await screen.findByText('订单列表')).toBeInTheDocument()
    expect(screen.getByText('ORD-20240515-17')).toBeInTheDocument()
    expect(screen.queryByText('ORD-20240510-08')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('退换货'))
      await flushPromises()
    })

    expect(screen.getByText('ORD-20240506-03')).toBeInTheDocument()
    expect(screen.queryByText('ORD-20240515-17')).not.toBeInTheDocument()
  })
})
