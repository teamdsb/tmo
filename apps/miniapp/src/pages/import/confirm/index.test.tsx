import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro, { useDidShow } from '@tarojs/taro'
import { commerceServices } from '../../../services/commerce'
import CartPage from '../../cart'
import ImportConfirmPage from './index'

const flush = () => new Promise((resolve) => process.nextTick(resolve))
const setParams = (params: Record<string, string>) => {
  ;(globalThis as typeof globalThis & { __setTaroRouterParams?: (value: Record<string, string>) => void }).__setTaroRouterParams?.(params)
}
const pendingJob = () => ({
  id: 'job-1', status: 'SUCCEEDED', progress: 100,
  result: {
    autoAddedCount: 0, pendingCount: 1, autoAddedItems: [] as { rowNo: number; skuId: string; qty: number }[],
    pendingItems: [{
      rowNo: 2, rawName: '待匹配螺栓', rawQty: '3', matchType: 'AMBIGUOUS',
      candidates: [{ sku: { id: 'sku-import', name: '螺栓', spec: 'M8' } }]
    }]
  }
})
const completedJob = () => ({
  ...pendingJob(),
  result: {
    autoAddedCount: 1, pendingCount: 0,
    autoAddedItems: [{ rowNo: 2, skuId: 'sku-import', qty: 3 }], pendingItems: []
  }
})
const chooseSpec = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '选择规格' }))
  await screen.findByRole('button', { name: '已选择' })
}

beforeEach(() => {
  jest.clearAllMocks()
  setParams({ jobId: 'job-1' })
  ;(useDidShow as jest.Mock).mockImplementation(() => {})
  ;(commerceServices.cart.getImportJob as jest.Mock).mockReset().mockResolvedValue(pendingJob())
  ;(commerceServices.cart.confirmImport as jest.Mock).mockReset().mockResolvedValue({ items: [] })
})
afterEach(() => setParams({}))

describe('Excel import confirmation', () => {
  it('confirms selected rows once and refreshes an already mounted cart after returning', async () => {
    const onShows: (() => void)[] = []
    ;(useDidShow as jest.Mock).mockImplementation((callback) => onShows.push(callback))
    const cart = render(<CartPage />)
    await act(async () => { await flush(); onShows[0]?.() })
    ;(commerceServices.cart.getCart as jest.Mock).mockClear()
    render(<ImportConfirmPage />)
    await chooseSpec()
    let finishConfirm: (value: { items: never[] }) => void = () => {}
    ;(commerceServices.cart.confirmImport as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishConfirm = resolve }))
    const button = screen.getByRole('button', { name: '确认并加入购物车' })
    await act(async () => { fireEvent.click(button); fireEvent.click(button); await flush() })
    expect(commerceServices.cart.confirmImport).toHaveBeenCalledTimes(1)
    expect(commerceServices.cart.confirmImport).toHaveBeenCalledWith('job-1', [{ rowNo: 2, skuId: 'sku-import', qty: 3 }])
    expect(button).toBeDisabled()
    expect(screen.queryByText('保存草稿')).not.toBeInTheDocument()
    await act(async () => { finishConfirm({ items: [] }); await flush() })
    expect(Taro.switchTab).toHaveBeenCalledWith({ url: '/pages/cart/index' })
    await act(async () => { onShows[0]?.(); await flush() })
    expect(commerceServices.cart.getCart).toHaveBeenCalledTimes(1)
    cart.unmount()
  })

  it('requires all selections and preserves them when confirmation fails', async () => {
    render(<ImportConfirmPage />)
    const button = await screen.findByRole('button', { name: '确认并加入购物车' })
    fireEvent.click(button)
    expect(commerceServices.cart.confirmImport).not.toHaveBeenCalled()
    await chooseSpec()
    ;(commerceServices.cart.confirmImport as jest.Mock).mockRejectedValueOnce(new Error('timeout'))
    fireEvent.click(button)
    await waitFor(() => expect(Taro.showToast).toHaveBeenCalledWith({ title: '确认失败，请重试', icon: 'none' }))
    expect(screen.getByRole('button', { name: '已选择' })).toBeInTheDocument()
    fireEvent.click(button)
    await waitFor(() => expect(Taro.switchTab).toHaveBeenCalled())
  })

  it('returns directly to the cart when every row is already added', async () => {
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue(completedJob())
    render(<ImportConfirmPage />)
    fireEvent.click(await screen.findByRole('button', { name: '返回购物车' }))
    await waitFor(() => expect(Taro.switchTab).toHaveBeenCalled())
    expect(commerceServices.cart.confirmImport).not.toHaveBeenCalled()
  })

  it('confirms matching rows without blocking on unmatched rows or calling them imported', async () => {
    const job = pendingJob()
    job.result.autoAddedCount = 1
    job.result.autoAddedItems = [{ rowNo: 1, skuId: 'sku-auto', qty: 2 }]
    job.result.pendingCount = 2
    job.result.pendingItems.push({ rowNo: 3, rawName: '未找到的垫片', rawQty: '4', matchType: 'NOT_FOUND', candidates: [] })
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue(job)
    render(<ImportConfirmPage />)
    await chooseSpec()
    expect(screen.getByText('未找到的垫片')).toBeInTheDocument()
    expect(screen.getByText(/仅修正这些行后重新导入/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认并加入购物车' }))
    await screen.findByRole('button', { name: '返回购物车' })
    expect(commerceServices.cart.confirmImport).toHaveBeenCalledWith('job-1', [{ rowNo: 2, skuId: 'sku-import', qty: 3 }])
    expect(screen.getByText('未找到的垫片')).toBeInTheDocument()
    expect(screen.queryByText('待匹配螺栓')).not.toBeInTheDocument()
    expect(screen.getByText('2/3 已识别')).toBeInTheDocument()
    expect(screen.queryByText('已自动匹配全部项目。')).not.toBeInTheDocument()
    expect(Taro.switchTab).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '返回购物车' }))
    await waitFor(() => expect(Taro.switchTab).toHaveBeenCalled())
  })

  it('allows returning to the cart when only unmatched rows remain', async () => {
    const job = pendingJob()
    job.result.pendingItems[0].candidates = []
    job.result.pendingItems[0].matchType = 'NOT_FOUND'
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue(job)
    render(<ImportConfirmPage />)
    fireEvent.click(await screen.findByRole('button', { name: '返回购物车' }))
    await waitFor(() => expect(Taro.switchTab).toHaveBeenCalled())
    expect(commerceServices.cart.confirmImport).not.toHaveBeenCalled()
  })

  it('reloads on return and removes a local selection that the server already confirmed', async () => {
    let onShow: (() => void) | undefined
    ;(useDidShow as jest.Mock).mockImplementation((callback) => { onShow = callback })
    render(<ImportConfirmPage />)
    await chooseSpec()
    await act(async () => { onShow?.(); await flush() })
    expect(commerceServices.cart.getImportJob).toHaveBeenCalledTimes(1)
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue(completedJob())
    await act(async () => { onShow?.(); await flush() })
    expect(screen.queryByRole('button', { name: '已选择' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回购物车' })).toBeInTheDocument()
  })

  it('shows a recoverable load error without pretending the job is empty', async () => {
    ;(commerceServices.cart.getImportJob as jest.Mock).mockRejectedValueOnce(new Error('timeout'))
    render(<ImportConfirmPage />)
    expect(await screen.findByText('加载导入任务失败，请重试')).toBeInTheDocument()
    expect(screen.queryByText('无待确认项')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('待匹配螺栓')).toBeInTheDocument()
  })

  it.each([undefined, 404])('handles a missing or inaccessible job (%s) without exposing stale rows', async (statusCode) => {
    if (statusCode) (commerceServices.cart.getImportJob as jest.Mock).mockRejectedValue({ statusCode })
    else setParams({})
    render(<ImportConfirmPage />)
    expect(await screen.findByText('导入任务不存在或已失效')).toBeInTheDocument()
    expect(screen.queryByText('待匹配螺栓')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新上传' }))
    await waitFor(() => expect(Taro.navigateTo).toHaveBeenCalledWith({ url: '/pages/import/index' }))
    if (!statusCode) expect(commerceServices.cart.getImportJob).not.toHaveBeenCalled()
  })

  it('shows an expired login instead of stale import content after a 401', async () => {
    ;(commerceServices.cart.getImportJob as jest.Mock).mockRejectedValue({ statusCode: 401 })
    render(<ImportConfirmPage />)
    expect(await screen.findByText('登录已失效，请重新登录')).toBeInTheDocument()
    expect(screen.queryByText('待匹配螺栓')).not.toBeInTheDocument()
  })

  it('does not allow confirmation while the job is still processing', async () => {
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue({ ...pendingJob(), status: 'RUNNING', result: undefined })
    render(<ImportConfirmPage />)
    expect(await screen.findByText('正在处理导入文件，请稍后刷新')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认并加入购物车' })).not.toBeInTheDocument()
  })

  it('ignores a late response after changing to another job', async () => {
    let finishOld: (value: ReturnType<typeof pendingJob>) => void = () => {}
    ;(commerceServices.cart.getImportJob as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve }))
    const page = render(<ImportConfirmPage />)
    setParams({ jobId: 'job-2' })
    ;(commerceServices.cart.getImportJob as jest.Mock).mockResolvedValue({ ...completedJob(), id: 'job-2' })
    page.rerender(<ImportConfirmPage />)
    await screen.findByRole('button', { name: '返回购物车' })
    await act(async () => { finishOld(pendingJob()); await flush() })
    expect(screen.queryByText('待匹配螺栓')).not.toBeInTheDocument()
  })
})
