import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import { commerceServices } from '../../../services/commerce'
import OrderTracking from './index'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as unknown as jest.Mock

describe('OrderTracking', () => {
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (params?: Record<string, string>) => void }).__setTaroRouterParams?.({
      id: 'ORD-2026-001'
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
    asMock(Taro.navigateTo).mockClear()
  })

  it('opens shipment detail from tracking list', async () => {
    render(<OrderTracking />)

    await act(async () => {
      await flushPromises()
    })

    expect(await screen.findByText('FX-789012349981')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看详情' }))

    await waitFor(() => {
      expect(Taro.navigateTo).toHaveBeenCalledWith({
        url: '/pages/order/tracking/detail/index?orderId=ORD-2026-001&waybillNo=FX-789012349981&shipmentIndex=0'
      })
    })
  })
})
