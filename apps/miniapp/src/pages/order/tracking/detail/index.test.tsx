import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { commerceServices } from '../../../../services/commerce'
import ShipmentTrackingDetail from './index'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('ShipmentTrackingDetail', () => {
  beforeEach(() => {
    asMock(Taro.setClipboardData).mockClear()
    asMock(Taro.showToast).mockClear()
  })

  it('renders shipment detail and copies waybill', async () => {
    ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (params?: Record<string, string>) => void }).__setTaroRouterParams?.({
      orderId: 'ORD-2026-001',
      waybillNo: 'FX-789012349981',
      shipmentIndex: '0'
    })
    asMock(commerceServices.tracking.getTracking).mockResolvedValue({
      orderId: 'ORD-2026-001',
      shipments: [
        {
          carrier: 'FedEx',
          waybillNo: 'FX-789012349981',
          shippedAt: '2026-02-24T12:00:00Z'
        }
      ]
    })

    render(<ShipmentTrackingDetail />)

    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('ORD-2026-001')).toBeInTheDocument()
    expect(screen.getByText('FedEx')).toBeInTheDocument()
    expect(screen.getAllByText('已发货，等待物流更新')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: '复制运单号' }))

    await waitFor(() => {
      expect(Taro.setClipboardData).toHaveBeenCalledWith({ data: 'FX-789012349981' })
    })
  })

  it('shows empty state when shipment is missing', async () => {
    ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (params?: Record<string, string>) => void }).__setTaroRouterParams?.({
      orderId: 'ORD-2026-001',
      waybillNo: 'missing-waybill'
    })
    asMock(commerceServices.tracking.getTracking).mockResolvedValue({
      orderId: 'ORD-2026-001',
      shipments: []
    })

    render(<ShipmentTrackingDetail />)

    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('运单不存在')).toBeInTheDocument()
  })
})
