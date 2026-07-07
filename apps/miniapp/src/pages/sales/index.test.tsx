import fs from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { gatewayServices } from '../../services/gateway'
import { identityServices } from '../../services/identity'
import SalesPage from './index'

describe('SalesPage', () => {
  beforeEach(() => {
    ;(gatewayServices.bootstrap.get as jest.Mock).mockResolvedValue({
      me: {
        displayName: '张三',
        currentRole: 'SALES',
        roles: ['CUSTOMER', 'SALES']
      }
    })
    ;(identityServices.customers.list as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'customer-5622',
          displayName: '用户5622',
          phone: '+8616360475622',
          ownerSalesUserId: 'sales-3059',
          createdAt: '2026-06-27T15:04:08+08:00'
        },
        {
          id: 'customer-4556',
          displayName: '用户4556',
          phone: null,
          ownerSalesUserId: 'sales-3059',
          createdAt: '2026-06-02T10:02:14+08:00'
        }
      ],
      page: 1,
      pageSize: 20,
      total: 2
    })
  })

  it('switches an assigned customer identity to SALES before requesting the QR code', async () => {
    ;(gatewayServices.bootstrap.get as jest.Mock)
      .mockResolvedValueOnce({
        me: {
          displayName: '张三',
          currentRole: 'CUSTOMER',
          roles: ['CUSTOMER', 'SALES']
        }
      })
      .mockResolvedValue({
        me: {
          displayName: '张三',
          currentRole: 'SALES',
          roles: ['CUSTOMER', 'SALES']
        }
      })

    render(<SalesPage />)

    await waitFor(() => {
      expect(identityServices.auth.switchRole).toHaveBeenCalledWith({ role: 'SALES' })
    })
    expect(identityServices.me.getSalesQrCode).toHaveBeenCalled()
    expect(await screen.findByText('SALES')).toBeInTheDocument()
  })

  it('applies shared long-text protection to sales order titles', () => {
    render(<SalesPage />)

    fireEvent.click(screen.getByText('订单'))

    const company = screen.getAllByText(/Acme 集团|星辰实业|创新动力/)[0]
    const productName = screen.getAllByText(/重型轴承|钢制支架|电路板 v2|工业级润滑油/)[0]

    expect(company).toHaveClass('u-safe-title-2')
    expect(productName).toHaveClass('u-safe-title-2')

    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8')
    expect(stylesheet).toContain('.sales-order-company')
    expect(stylesheet).toContain('.sales-order-item-name')
    expect(stylesheet).toContain('.u-safe-title-2')
  })

  it('renders dashboard by default and switches between tabs', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    try {
      render(<SalesPage />)

      expect(screen.getByText('您的专属推广二维码')).toBeInTheDocument()
      expect(await screen.findByText('张三')).toBeInTheDocument()
      expect(await screen.findByText(/客户扫码后将打开微信小程序并进入登录流程/)).toBeInTheDocument()
      expect(await screen.findByText('渠道码：mock-sales-bind')).toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringMatching(/^data:image\/svg\+xml;charset=UTF-8,/))
      expect(screen.getByRole('img')).toHaveClass('sales-dashboard-qr-image')

      fireEvent.click(screen.getByText('客户'))
      expect(screen.getByText('客户列表')).toBeInTheDocument()
      expect(await screen.findByText('用户5622')).toBeInTheDocument()
      expect(screen.getByText('+86 16360475622')).toBeInTheDocument()
      expect(screen.getByText('未设置')).toBeInTheDocument()
      expect(screen.getByText('创建时间：2026/06/27')).toBeInTheDocument()
      expect(screen.queryByText('Acme 集团')).not.toBeInTheDocument()
      expect(identityServices.customers.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 })

      fireEvent.click(screen.getByText('订单'))
      expect(screen.getByText('订单列表')).toBeInTheDocument()

      fireEvent.click(screen.getByText('财务'))
      expect(screen.getByText('财务结算')).toBeInTheDocument()
      expect(screen.getByText('总销售额')).toBeInTheDocument()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it('searches owned customers without sending an owner id', async () => {
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    const input = screen.getByPlaceholderText('搜索客户...')

    fireEvent.change(input, { target: { value: '用户5622' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(identityServices.customers.list).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        q: '用户5622'
      })
    })
    expect(identityServices.customers.list).not.toHaveBeenCalledWith(
      expect.objectContaining({ ownerSalesUserId: expect.anything() })
    )
  })

  it('shows empty and error states instead of mock customers', async () => {
    ;(identityServices.customers.list as jest.Mock).mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    })
    const { unmount } = render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    expect(await screen.findByText('暂无客户')).toBeInTheDocument()
    expect(screen.queryByText('Acme 集团')).not.toBeInTheDocument()
    unmount()

    ;(identityServices.customers.list as jest.Mock).mockRejectedValueOnce(new Error('network down'))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    expect(await screen.findByText('客户加载失败，请稍后重试。')).toBeInTheDocument()
    expect(screen.queryByText('Acme 集团')).not.toBeInTheDocument()
  })

  it('shows a loading state while the owned customer request is pending', async () => {
    let resolveCustomers: ((value: { items: []; page: number; pageSize: number; total: number }) => void) | undefined
    ;(identityServices.customers.list as jest.Mock).mockImplementationOnce(() => new Promise((resolve) => {
      resolveCustomers = resolve
    }))

    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    expect(await screen.findByText('正在加载客户...')).toBeInTheDocument()

    await act(async () => {
      resolveCustomers?.({ items: [], page: 1, pageSize: 20, total: 0 })
    })
    expect(await screen.findByText('暂无客户')).toBeInTheDocument()
  })

  it('returns to shopping home when clicking global action', () => {
    render(<SalesPage />)

    fireEvent.click(screen.getByText('返回购物'))

    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/index/index' })
  })
})
