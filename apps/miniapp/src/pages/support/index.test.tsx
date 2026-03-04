import { act, render, screen } from '@testing-library/react'
import { removeStorage } from '@tmo/platform-adapter'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
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

    expect(await screen.findByText('客服支持')).toBeInTheDocument()
    expect(commerceServices.afterSales.listTickets).toHaveBeenCalled()
    expect(commerceServices.inquiries.list).toHaveBeenCalled()
  })
})
