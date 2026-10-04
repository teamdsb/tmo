import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { commerceServices } from '../../services/commerce'
import ImportPage from './index'

const flush = () => new Promise((resolve) => process.nextTick(resolve))

beforeEach(() => {
  jest.clearAllMocks()
  ;(useDidHide as jest.Mock).mockImplementation(() => {})
  ;(useDidShow as jest.Mock).mockImplementation(() => {})
  commerceServices.cart.uploadImportExcel = jest.fn().mockResolvedValue({ id: 'job-1' })
})

describe('cart Excel upload', () => {
  it('opens a non-tab confirmation page with the returned job id', async () => {
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    fireEvent.click(screen.getByRole('button', { name: '上传并查看' }))

    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/import/confirm/index?jobId=job-1'
    }))
    expect(Taro.switchTab).not.toHaveBeenCalled()
  })

  it('submits only once while an upload is pending and allows retry after failure', async () => {
    let rejectUpload: (error: Error) => void = () => {}
    ;(commerceServices.cart.uploadImportExcel as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => {
      rejectUpload = reject
    }))
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    const button = screen.getByRole('button', { name: '上传并查看' })
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
      await flush()
    })
    expect(commerceServices.cart.uploadImportExcel).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()

    await act(async () => {
      rejectUpload(new Error('network unavailable'))
      await flush()
    })
    expect(button).not.toBeDisabled()
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalled())
  })

  it('retries opening an uploaded job without importing the file again', async () => {
    ;(Taro.navigateTo as jest.Mock).mockRejectedValueOnce(new Error('navigation failed'))
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    const button = screen.getByRole('button', { name: '上传并查看' })
    fireEvent.click(button)
    await waitFor(() => expect(button).not.toBeDisabled())
    fireEvent.click(button)
    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalledTimes(2))
    expect(commerceServices.cart.uploadImportExcel).toHaveBeenCalledTimes(1)
  })

  it.each(['unmount', 'hide', 'back'])('ignores a pending upload after %s', async (action) => {
    let hide: (() => void) | undefined
    ;(useDidHide as jest.Mock).mockImplementation((callback) => { hide = callback })
    let finishUpload: (result: { id: string }) => void = () => {}
    ;(commerceServices.cart.uploadImportExcel as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishUpload = resolve }))
    const page = render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    fireEvent.click(screen.getByRole('button', { name: '上传并查看' }))
    await act(async () => {
      if (action === 'unmount') page.unmount()
      else if (action === 'hide') hide?.()
      else fireEvent.click(screen.getByRole('button', { name: '返回' }))
      await flush()
      finishUpload({ id: 'late-job' })
      await flush()
    })
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(Taro.showToast).not.toHaveBeenCalled()
  })

  it('keeps a background upload in flight and reuses its job only after an explicit result click', async () => {
    let hide: (() => void) | undefined
    let show: (() => void) | undefined
    ;(useDidHide as jest.Mock).mockImplementation((callback) => { hide = callback })
    ;(useDidShow as jest.Mock).mockImplementation((callback) => { show = callback })
    let finishUpload: (result: { id: string }) => void = () => {}
    ;(commerceServices.cart.uploadImportExcel as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishUpload = resolve }))
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    const button = screen.getByRole('button', { name: '上传并查看' })
    fireEvent.click(button)
    await act(async () => { hide?.(); show?.(); await flush() })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(commerceServices.cart.uploadImportExcel).toHaveBeenCalledTimes(1)
    await act(async () => { finishUpload({ id: 'background-job' }); await flush() })
    expect(button).not.toBeDisabled()
    expect(Taro.navigateTo).not.toHaveBeenCalled()
    expect(Taro.showToast).not.toHaveBeenCalled()
    fireEvent.click(button)
    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/import/confirm/index?jobId=background-job' }))
    expect(commerceServices.cart.uploadImportExcel).toHaveBeenCalledTimes(1)
  })

  it.each(['before-show', 'after-show'])('accepts native picker results %s without treating its hide as navigation away', async (timing) => {
    let hide: (() => void) | undefined
    let show: (() => void) | undefined
    ;(useDidHide as jest.Mock).mockImplementation((callback) => { hide = callback })
    ;(useDidShow as jest.Mock).mockImplementation((callback) => { show = callback })
    let finishChoose: (file: { path: string; name: string }) => void = () => {}
    ;(commerceServices.files.chooseExcelFile as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishChoose = resolve }))
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await act(async () => {
      hide?.()
      if (timing === 'after-show') show?.()
      finishChoose({ path: '/tmp/late.xlsx', name: '迟到文件.xlsx' })
      await flush()
      if (timing === 'before-show') {
        expect(screen.getByText('未选择文件')).toBeInTheDocument()
        show?.()
      }
    })
    expect(screen.getByText('迟到文件.xlsx')).toBeInTheDocument()
    expect(Taro.showToast).not.toHaveBeenCalled()
  })

  it('discards file selection after explicit back navigation even if the page is still mounted', async () => {
    let finishChoose: (file: { path: string; name: string }) => void = () => {}
    ;(commerceServices.files.chooseExcelFile as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishChoose = resolve }))
    render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    await act(async () => {
      finishChoose({ path: '/tmp/old.xlsx', name: '旧文件.xlsx' })
      await flush()
    })
    expect(screen.getByText('未选择文件')).toBeInTheDocument()
    expect(screen.queryByText('旧文件.xlsx')).not.toBeInTheDocument()
  })

  it('does not show a late navigation error after the page unmounts', async () => {
    let rejectNavigation: (error: Error) => void = () => {}
    ;(Taro.navigateTo as jest.Mock).mockReturnValueOnce(new Promise((_resolve, reject) => { rejectNavigation = reject }))
    const page = render(<ImportPage />)
    fireEvent.click(screen.getByRole('button', { name: '选择 Excel 文件' }))
    await screen.findByText('已选.xlsx')
    fireEvent.click(screen.getByRole('button', { name: '上传并查看' }))
    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalled())
    page.unmount()
    await act(async () => { rejectNavigation(new Error('late error')); await flush() })
    expect(Taro.showToast).not.toHaveBeenCalled()
  })
})
