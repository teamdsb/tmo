import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import ProfileEditPage from './index'
import { loadBootstrap, saveBootstrap } from '../../../services/bootstrap'
import { loadEditableProfile, saveEditableProfile } from '../../../services/profile'

jest.mock('../../../services/bootstrap', () => ({
  loadBootstrap: jest.fn(),
  saveBootstrap: jest.fn()
}))

jest.mock('../../../services/profile', () => ({
  loadEditableProfile: jest.fn(),
  saveEditableProfile: jest.fn()
}))

describe('ProfileEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(loadBootstrap as jest.Mock).mockResolvedValue({
      me: {
        displayName: '张三',
        currentRole: 'CUSTOMER',
        userType: 'customer',
        roles: ['CUSTOMER']
      },
      permissions: { items: [] },
      featureFlags: {}
    })
    ;(loadEditableProfile as jest.Mock).mockReturnValue({
      displayName: '张三',
      phone: '13800138000'
    })
  })

  it('loads current profile values into the form', async () => {
    render(<ProfileEditPage />)

    expect(await screen.findByDisplayValue('张三')).toBeInTheDocument()
    expect(screen.getByDisplayValue('13800138000')).toBeInTheDocument()
  })

  it('saves display name and phone then navigates back', async () => {
    render(<ProfileEditPage />)

    const nameInput = await screen.findByDisplayValue('张三')
    const phoneInput = screen.getByDisplayValue('13800138000')

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '李四' } })
      fireEvent.change(phoneInput, { target: { value: '13900139000' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByText('保存'))
    })

    expect(saveEditableProfile).toHaveBeenCalledWith({
      displayName: '李四',
      phone: '13900139000'
    })
    expect(saveBootstrap).toHaveBeenCalledWith(expect.objectContaining({
      me: expect.objectContaining({
        displayName: '李四'
      })
    }))

    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith({ title: '个人信息已保存', icon: 'success' })
      expect(Taro.navigateBack).toHaveBeenCalled()
    })
  })

  it('blocks save when phone is invalid', async () => {
    render(<ProfileEditPage />)

    const phoneInput = await screen.findByDisplayValue('13800138000')

    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: '12345' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByText('保存'))
    })

    expect(saveEditableProfile).not.toHaveBeenCalled()
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '请输入正确手机号', icon: 'none' })
  })
})
