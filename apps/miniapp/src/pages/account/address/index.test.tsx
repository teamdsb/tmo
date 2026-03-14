import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'

import AddressList from './index'
import { listUserAddresses, setSelectedUserAddressId } from '../../../services/addresses'

jest.mock('../../../services/addresses', () => ({
  listUserAddresses: jest.fn(),
  getSelectedUserAddressId: jest.fn(() => ''),
  setSelectedUserAddressId: jest.fn()
}))

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

describe('AddressList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (params?: Record<string, string>) => void })
      .__setTaroRouterParams?.({})
    ;(listUserAddresses as jest.Mock).mockResolvedValue([
      {
        id: 'addr-1',
        receiverName: '张三',
        receiverPhone: '13800000000',
        detail: '上海市浦东新区 1 号',
        isDefault: true,
        createdAt: '2026-03-06T00:00:00Z',
        updatedAt: '2026-03-06T00:00:00Z'
      },
      {
        id: 'addr-2',
        receiverName: '李四',
        receiverPhone: '13900000000',
        detail: '杭州市西湖区 2 号',
        isDefault: false,
        createdAt: '2026-03-06T00:00:00Z',
        updatedAt: '2026-03-06T00:00:00Z'
      }
    ])
  })

  it('selects an address and navigates back in select mode', async () => {
    ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (params?: Record<string, string>) => void })
      .__setTaroRouterParams?.({ mode: 'select' })

    render(<AddressList />)
    await act(async () => {
      await flushPromises()
    })

    fireEvent.click(screen.getByText('李四'))

    expect(setSelectedUserAddressId).toHaveBeenCalledWith('addr-2')
    expect(Taro.navigateBack).toHaveBeenCalled()
  })
})
