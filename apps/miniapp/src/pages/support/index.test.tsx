import { act, render, screen } from '@testing-library/react'
import { removeStorage } from '@tmo/platform-adapter'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import SupportPage from './index'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

const renderSupportPage = async () => {
  render(<SupportPage />)
  await act(async () => {
    await flushPromises()
  })
}

describe('SupportPage', () => {
  beforeEach(async () => {
    await removeStorage('tmo:bootstrap')
    asMock(identityServices.tokens.getToken).mockResolvedValue('token-123')
    asMock(gatewayServices.bootstrap.get).mockClear()
    asMock(commerceServices.afterSales.listTickets).mockClear()
    asMock(commerceServices.inquiries.list).mockClear()
  })

  it('renders sales view for SALES role', async () => {
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: {
        id: 'u-sales',
        userType: 'staff',
        displayName: '业务员A',
        roles: ['SALES'],
        createdAt: '2026-01-01T00:00:00Z'
      },
      permissions: { items: [] },
      featureFlags: {}
    }))

    await renderSupportPage()

    expect(await screen.findByText('业务员工作台')).toBeInTheDocument()
    expect(screen.queryByText('客服支持')).not.toBeInTheDocument()
    expect(commerceServices.afterSales.listTickets).not.toHaveBeenCalled()
    expect(commerceServices.inquiries.list).not.toHaveBeenCalled()
  })

  it('renders sales view when bootstrap has CUSTOMER role but current userType is staff', async () => {
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: {
        id: 'u-multi-role',
        userType: 'staff',
        displayName: '多角色用户',
        roles: ['CUSTOMER', 'SALES'],
        createdAt: '2026-01-01T00:00:00Z'
      },
      permissions: { items: [] },
      featureFlags: {}
    }))

    await renderSupportPage()

    expect(await screen.findByText('业务员工作台')).toBeInTheDocument()
    expect(screen.queryByText('客服支持')).not.toBeInTheDocument()
    expect(commerceServices.afterSales.listTickets).not.toHaveBeenCalled()
    expect(commerceServices.inquiries.list).not.toHaveBeenCalled()
  })

  it('renders customer support view for non-SALES role', async () => {
    asMock(gatewayServices.bootstrap.get).mockImplementation(async () => ({
      me: {
        id: 'u-customer',
        userType: 'customer',
        displayName: '客户A',
        roles: ['CUSTOMER'],
        createdAt: '2026-01-01T00:00:00Z'
      },
      permissions: { items: [] },
      featureFlags: {}
    }))

    await renderSupportPage()

    expect(await screen.findByText('在线客服')).toBeInTheDocument()
  })

  it('renders sales view without requesting bootstrap when token is missing', async () => {
    asMock(identityServices.tokens.getToken).mockResolvedValue(null)

    await renderSupportPage()

    expect(await screen.findByText('业务员工作台')).toBeInTheDocument()
    expect(gatewayServices.bootstrap.get).not.toHaveBeenCalled()
  })
})
