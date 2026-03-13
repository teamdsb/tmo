import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
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
        currentRole: 'CUSTOMER',
        roles: ['CUSTOMER']
      }
    }))
    asMock(identityServices.auth.switchRole).mockResolvedValue({
      accessToken: 'switched-token',
      expiresIn: 3600,
      user: {
        currentRole: 'SALES',
        displayName: '张三',
        ownerSalesDisplayName: '李经理',
        roles: ['CUSTOMER', 'SALES'],
        userType: 'staff'
      }
    })
    asMock(gatewayServices.bootstrap.get).mockClear()
    asMock(gatewayServices.tokens.setToken).mockClear()
    asMock(commerceServices.tokens.setToken).mockClear()
    asMock(identityServices.tokens.setToken).mockClear()
    asMock(identityServices.auth.switchRole).mockClear()
    asMock(Taro.navigateTo).mockClear()
    asMock(Taro.showToast).mockClear()
    asMock(removeStorage).mockClear()
  })

  it('renders user info and key sections', async () => {
    await renderPersonalCenter()

    const navbar = document.querySelector('.app-navbar.app-navbar--primary')
    expect(navbar).not.toBeNull()

    expect(await screen.findAllByText('张三')).toHaveLength(2)
    expect(screen.getByText('CUSTOMER')).toBeInTheDocument()
    expect(screen.getAllByText(/李经理/)).toHaveLength(2)
    expect(screen.getByText('专属顾问')).toBeInTheDocument()
    expect(screen.getByText('下单后由专属顾问继续报价、确认货源与同步发货进度。')).toBeInTheDocument()
    expect(screen.getAllByText('立即沟通')).toHaveLength(2)
  })

  it('shows debug role switcher and switches current role', async () => {
    asMock(gatewayServices.bootstrap.get)
      .mockResolvedValueOnce({
        me: {
          displayName: '张三',
          ownerSalesDisplayName: '李经理',
          currentRole: 'CUSTOMER',
          roles: ['CUSTOMER', 'SALES'],
          userType: 'customer'
        }
      })
      .mockResolvedValueOnce({
        me: {
          displayName: '张三',
          ownerSalesDisplayName: '李经理',
          currentRole: 'SALES',
          roles: ['CUSTOMER', 'SALES'],
          userType: 'staff'
        }
      })

    await renderPersonalCenter()

    expect(await screen.findByText('调试角色')).toBeInTheDocument()
    expect(screen.getByText('当前身份 CUSTOMER，可快速切换当前会话角色。')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'SALES' }))
      await flushPromises()
    })

    expect(identityServices.auth.switchRole).toHaveBeenCalledWith({ role: 'SALES' })
    expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(2)
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '角色已切换', icon: 'none' })
  })

  it('hides manager card when not logged in', async () => {
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: undefined
    }))

    await renderPersonalCenter()

    expect(await screen.findByText('开启您的专属购物之旅')).toBeInTheDocument()
    expect(screen.queryByText('访客模式')).not.toBeInTheDocument()
    expect(screen.queryByText('未登录')).not.toBeInTheDocument()
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
    expect(removeStorage).toHaveBeenCalledWith('tmo:auth:role-selection')
    expect(Taro.reLaunch).toHaveBeenCalledWith({ url: '/pages/auth/login/index' })

    await waitFor(() => {
      expect(screen.getByText('开启您的专属购物之旅')).toBeInTheDocument()
    })
  })

  it('renders key menu entries', async () => {
    await renderPersonalCenter()

    expect(screen.getByText('订单跟踪')).toBeInTheDocument()
    expect(screen.getByText('我的需求')).toBeInTheDocument()
    expect(screen.getByText('我的收藏')).toBeInTheDocument()
    expect(screen.getByText('帮助中心')).toBeInTheDocument()
    expect(screen.getByText('物流跟踪')).toBeInTheDocument()
    expect(screen.getByText('系统设置')).toBeInTheDocument()
  })

  it('navigates to support page when opening advisor chat', async () => {
    await renderPersonalCenter()

    fireEvent.click(screen.getByText('专属顾问'))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith({
        url: '/pages/support/index'
      })
    })
  })

  it('falls back to guest state without token and does not refresh bootstrap', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)

    await renderPersonalCenter()

    expect(await screen.findByText('立即登录 / 注册')).toBeInTheDocument()
    expect(screen.queryByText('未登录')).not.toBeInTheDocument()
    expect(gatewayServices.bootstrap.get).not.toHaveBeenCalled()
    expect(removeStorage).toHaveBeenCalledWith('tmo:bootstrap')
  })

  it('opens login page when tapping guest hero CTA', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)

    await renderPersonalCenter()

    fireEvent.click(screen.getByText('立即登录 / 注册'))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith({
        url: '/pages/auth/login/index'
      })
    })
  })

  it('shows logged-in hero CTA', async () => {
    await renderPersonalCenter()

    expect(await screen.findAllByText('立即沟通')).toHaveLength(2)
  })

  it('shows guest hero CTA', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)

    await renderPersonalCenter()

    expect(await screen.findByText('立即登录 / 注册')).toBeInTheDocument()
  })

  it('opens order list from summary card', async () => {
    await renderPersonalCenter()

    fireEvent.click(screen.getByText('追踪您的包裹'))

    expect(await screen.findByText('订单列表')).toBeInTheDocument()
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

  it('opens logistics page when clicking an order card', async () => {
    await renderPersonalCenter()

    await act(async () => {
      fireEvent.click(screen.getByText('已发货'))
      await flushPromises()
    })

    fireEvent.click(screen.getByTestId('mine-order-card-ORD-20240515-17'))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith({
        url: '/pages/order/tracking/index?id=ORD-20240515-17'
      })
    })
  })
})
