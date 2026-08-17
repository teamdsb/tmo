import fs from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro, { useDidShow } from '@tarojs/taro'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import SalesPage from './index'

describe('SalesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useDidShow as jest.Mock).mockImplementation(() => {})
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
    ;(commerceServices.orders.list as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'owned-order-001',
          createdAt: '2026-08-17T10:00:00+08:00',
          status: 'PAID',
          paymentStatus: 'PAID',
          ownerSalesUserId: 'sales-3059',
          address: { receiverName: '宁波远航', receiverPhone: '13800000000', detail: '测试地址', isDefault: true },
          items: [
            {
              qty: 2,
              unitPriceFen: 1250,
              sku: { id: 'sku-1', spuId: 'spu-1', name: '工业螺栓', spec: 'M8', isActive: true }
            }
          ]
        }
      ],
      page: 1,
      pageSize: 20,
      total: 1
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

  it('loads the sales dashboard once on initial show and refreshes only after returning to the page', async () => {
    let didShowCallback: (() => void) | undefined
    ;(useDidShow as jest.Mock).mockImplementation((callback) => {
      didShowCallback = callback
    })

    render(<SalesPage />)
    expect(await screen.findByText('渠道码：mock-sales-bind')).toBeInTheDocument()
    expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(1)
    expect(identityServices.me.getSalesQrCode).toHaveBeenCalledTimes(1)

    await act(async () => {
      didShowCallback?.()
      await Promise.resolve()
    })
    expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(1)
    expect(identityServices.me.getSalesQrCode).toHaveBeenCalledTimes(1)

    await act(async () => {
      didShowCallback?.()
    })
    await waitFor(() => {
      expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(2)
      expect(identityServices.me.getSalesQrCode).toHaveBeenCalledTimes(2)
    })
  })

  it('loads owned orders instead of rendering demo order fixtures', async () => {
    render(<SalesPage />)

    fireEvent.click(screen.getByText('订单'))

    expect(await screen.findByText('工业螺栓')).toBeInTheDocument()
    expect(screen.getByText('宁波远航')).toBeInTheDocument()
    expect(screen.getAllByText('¥25.00')).toHaveLength(2)
    expect(screen.queryByText('Acme 集团')).not.toBeInTheDocument()
    expect(commerceServices.orders.list).toHaveBeenCalledWith({ page: 1, pageSize: 50 })

    const company = screen.getByText('宁波远航')
    const productName = screen.getByText('工业螺栓')
    expect(company).toHaveClass('u-safe-title-2')
    expect(productName).toHaveClass('u-safe-title-2')

    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8')
    expect(stylesheet).toContain('.sales-order-company')
    expect(stylesheet).toContain('.sales-order-item-name')
    expect(stylesheet).toContain('.u-safe-title-2')
  })

  it('shows a real order load failure instead of falling back to demo orders', async () => {
    ;(commerceServices.orders.list as jest.Mock).mockRejectedValueOnce(new Error('network down'))

    render(<SalesPage />)
    fireEvent.click(screen.getByText('订单'))

    expect(await screen.findByText('订单加载失败，请稍后重试。')).toBeInTheDocument()
    expect(screen.queryByText('Acme 集团')).not.toBeInTheDocument()
  })

  it('marks accounting as unavailable until a real settlement API exists', () => {
    render(<SalesPage />)

    fireEvent.click(screen.getByText('财务'))

    expect(screen.getByText('财务结算暂未接入')).toBeInTheDocument()
    expect(screen.queryByText('$45,230')).not.toBeInTheDocument()
    expect(screen.queryByText('ORD-2023-089')).not.toBeInTheDocument()

    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8')
    expect(stylesheet).toMatch(/\.sales-empty-copy\s*\{[\s\S]*?max-width:\s*100%/)
    expect(stylesheet).toMatch(/\.sales-empty-copy\s*\{[\s\S]*?text-align:\s*center/)
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
      expect(await screen.findByText('工业螺栓')).toBeInTheDocument()

      fireEvent.click(screen.getByText('财务'))
      expect(screen.getByText('财务结算')).toBeInTheDocument()
      expect(screen.getByText('财务结算暂未接入')).toBeInTheDocument()
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
