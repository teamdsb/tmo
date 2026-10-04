import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import SalesPage from './index'

const flush = () => new Promise((resolve) => process.nextTick(resolve))
const customer = (number: number) => ({
  id: `customer-${number}`, displayName: `客户 ${number}`, phone: null,
  ownerSalesUserId: 'sales-1', createdAt: '2026-01-01T00:00:00Z'
})
const order = (number: number, status = 'SUBMITTED') => ({
  id: `order-${number}`, status, createdAt: '2026-01-01T00:00:00Z',
  items: [{ sku: { id: `sku-${number}`, name: `商品 ${number}` }, qty: 1, unitPriceFen: 100 }]
})
const pageOf = <T,>(items: T[], page = 1, pageSize = 20) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length
})
const ready = { me: { id: 'sales-1', displayName: '销售甲', currentRole: 'SALES', roles: ['CUSTOMER', 'SALES'] } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(gatewayServices.bootstrap.get as jest.Mock).mockReset().mockResolvedValue(ready)
  ;(identityServices.auth.switchRole as jest.Mock).mockReset().mockResolvedValue({})
  ;(identityServices.customers.list as jest.Mock).mockReset().mockResolvedValue(pageOf([]))
  ;(commerceServices.orders.list as jest.Mock).mockReset().mockResolvedValue(pageOf([]))
})

describe('sales list pagination', () => {
  it('loads the 21st customer and resets pagination when a search is cleared', async () => {
    const customers = Array.from({ length: 21 }, (_, index) => customer(index + 1))
    ;(identityServices.customers.list as jest.Mock).mockImplementation(async ({ q, page, pageSize }) =>
      pageOf(q ? customers.filter((item) => item.displayName === q) : customers, page, pageSize))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    await screen.findByText('客户 20')
    expect(screen.queryByText('客户 21')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '加载更多客户' }))
    await screen.findByText('客户 21')
    expect(screen.getByText('已加载 21 / 21 位客户')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '加载更多客户' })).not.toBeInTheDocument()
    const input = screen.getByPlaceholderText('搜索客户...')
    fireEvent.change(input, { target: { value: '客户 21' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(identityServices.customers.list).toHaveBeenLastCalledWith({ q: '客户 21', page: 1, pageSize: 20 }))
    await screen.findByText('已加载 1 / 1 位客户')
    expect(screen.queryByText('客户 1')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '' } })
    await waitFor(() => expect(identityServices.customers.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 }))
    await screen.findByText('客户 20')
    expect(screen.queryByText('客户 21')).not.toBeInTheDocument()
  })

  it('loads all 51 orders and asks the server for a status group beyond the first page', async () => {
    const orders = Array.from({ length: 51 }, (_, index) => order(index + 1, index === 50 ? 'PAID' : 'SUBMITTED'))
    ;(commerceServices.orders.list as jest.Mock).mockImplementation(async ({ statuses, page, pageSize }) =>
      pageOf(statuses ? orders.filter((item) => statuses.includes(item.status)) : orders, page, pageSize))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('订单'))
    await screen.findByText('商品 20')
    fireEvent.click(screen.getByText('已确认'))
    await screen.findByText('商品 51')
    expect(commerceServices.orders.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, statuses: ['CONFIRMED', 'PAID'] })
    expect(screen.queryByText('商品 1')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('全部'))
    await screen.findByText('商品 20')
    expect(commerceServices.orders.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 })
    fireEvent.click(screen.getByRole('button', { name: '加载更多订单' }))
    await screen.findByText('商品 40')
    fireEvent.click(screen.getByRole('button', { name: '加载更多订单' }))
    await screen.findByText('商品 51')
    expect(screen.getByText('已加载 51 / 51 个订单')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '加载更多订单' })).not.toBeInTheDocument()
  })

  it('keeps the first page after a page-two failure and retries the same page once', async () => {
    const customers = Array.from({ length: 21 }, (_, index) => customer(index + 1))
    ;(identityServices.customers.list as jest.Mock)
      .mockResolvedValueOnce(pageOf(customers))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(pageOf(customers, 2))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    await screen.findByText('客户 20')
    fireEvent.click(screen.getByRole('button', { name: '加载更多客户' }))
    const retry = await screen.findByRole('button', { name: '重试加载客户' })
    expect(screen.getByText('客户 20')).toBeInTheDocument()
    fireEvent.click(retry)
    await screen.findByText('客户 21')
    expect((identityServices.customers.list as jest.Mock).mock.calls.map(([params]) => params.page)).toEqual([1, 2, 2])
  })

  it('ignores a late old search response', async () => {
    let finishOld: (result: ReturnType<typeof pageOf>) => void = () => {}
    ;(identityServices.customers.list as jest.Mock)
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
      .mockResolvedValueOnce(pageOf([customer(21)]))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    await waitFor(() => expect(identityServices.customers.list).toHaveBeenCalledTimes(1))
    const input = screen.getByPlaceholderText('搜索客户...')
    fireEvent.change(input, { target: { value: '客户 21' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('客户 21')
    await act(async () => { finishOld(pageOf([customer(1)])); await flush() })
    expect(screen.getByText('客户 21')).toBeInTheDocument()
    expect(screen.queryByText('客户 1')).not.toBeInTheDocument()
  })

  it('ignores a late old status response and prevents duplicate load-more requests', async () => {
    const orders = Array.from({ length: 21 }, (_, index) => order(index + 1))
    let finishOld: (result: ReturnType<typeof pageOf>) => void = () => {}
    ;(commerceServices.orders.list as jest.Mock)
      .mockResolvedValueOnce(pageOf(orders))
      .mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
      .mockResolvedValueOnce(pageOf([order(51, 'PAID')]))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('订单'))
    await screen.findByText('商品 20')
    const more = screen.getByRole('button', { name: '加载更多订单' })
    await act(async () => { fireEvent.click(more); fireEvent.click(more); await flush() })
    expect(commerceServices.orders.list).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByText('已确认'))
    await screen.findByText('商品 51')
    await act(async () => { finishOld(pageOf(orders, 2)); await flush() })
    expect(screen.getByText('商品 51')).toBeInTheDocument()
    expect(screen.queryByText('商品 21')).not.toBeInTheDocument()
  })

  it('waits for the SALES role switch and fresh bootstrap before requesting lists', async () => {
    let finishSwitch: (result: object) => void = () => {}
    ;(gatewayServices.bootstrap.get as jest.Mock).mockResolvedValueOnce({ me: { ...ready.me, currentRole: 'CUSTOMER' } })
    ;(identityServices.auth.switchRole as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishSwitch = resolve }))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('客户'))
    await waitFor(() => expect(identityServices.auth.switchRole).toHaveBeenCalled())
    expect(identityServices.customers.list).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('订单'))
    expect(commerceServices.orders.list).not.toHaveBeenCalled()
    await act(async () => { finishSwitch({}); await flush() })
    await waitFor(() => expect(commerceServices.orders.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 }))
    expect(identityServices.customers.list).not.toHaveBeenCalled()
  })

  it('blocks lists after a failed role switch and allows retry', async () => {
    ;(gatewayServices.bootstrap.get as jest.Mock).mockResolvedValueOnce({ me: { ...ready.me, currentRole: 'CUSTOMER' } })
    ;(identityServices.auth.switchRole as jest.Mock).mockRejectedValueOnce(new Error('switch failed'))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('订单'))
    fireEvent.click(await screen.findByRole('button', { name: '重试加载订单' }))
    await waitFor(() => expect(commerceServices.orders.list).toHaveBeenCalledTimes(1))
    expect(gatewayServices.bootstrap.get).toHaveBeenCalledTimes(2)
  })

  it('shows cancelled and closed labels only in the all-orders results', async () => {
    ;(commerceServices.orders.list as jest.Mock)
      .mockResolvedValueOnce(pageOf([order(1, 'CANCELLED'), order(2, 'CLOSED')]))
      .mockResolvedValueOnce(pageOf([]))
    render(<SalesPage />)
    fireEvent.click(screen.getByText('订单'))
    await screen.findByText('已取消')
    expect(screen.getByText('已关闭')).toBeInTheDocument()
    fireEvent.click(screen.getByText('待处理'))
    await waitFor(() => expect(commerceServices.orders.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, statuses: ['SUBMITTED', 'PAY_PENDING', 'PAY_FAILED'] }))
    expect(screen.queryByText('已取消')).not.toBeInTheDocument()
    expect(screen.queryByText('已关闭')).not.toBeInTheDocument()
  })
})
