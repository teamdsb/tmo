import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import type { CartImportJob, CartImportPendingItem } from '@tmo/api-client'
import AppFixedBottom from '../../../components/app-safe-area'
import { useRefreshOnReturn } from '../../../hooks/use-refresh-on-return'
import { ROUTES, importConfirmRoute, withQuery } from '../../../routes'
import { commerceServices } from '../../../services/commerce'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { ImportResultView } from './components'
import type { ImportTab, SelectionMap } from './types'

type LoadError = 'missing' | 'unauthorized' | 'retry' | null

const statusCodeOf = (error: unknown): number | undefined => (
  error && typeof error === 'object' && 'statusCode' in error
    ? Number(error.statusCode)
    : undefined
)

const retainPendingSelections = (job: CartImportJob, selections: SelectionMap): SelectionMap => {
  const next: SelectionMap = {}
  for (const row of job.result?.pendingItems ?? []) {
    const selection = selections[row.rowNo]
    if (selection && row.candidates?.some((candidate) => candidate.sku.id === selection.skuId)) {
      next[row.rowNo] = selection
    }
  }
  return next
}

export default function ImportConfirmPage() {
  const router = useRouter()
  const jobId = typeof router.params?.jobId === 'string' ? router.params.jobId.trim() : ''
  const [job, setJob] = useState<CartImportJob | null>(null)
  const [activeTab, setActiveTab] = useState<ImportTab>('to-confirm')
  const [selectionMap, setSelectionMap] = useState<SelectionMap>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [loadError, setLoadError] = useState<LoadError>(null)
  const requestVersion = useRef(0)
  const confirmInFlight = useRef(false)
  const navbarStyle = getNavbarStyle()

  const loadJob = useCallback(async () => {
    if (confirmInFlight.current) return
    const version = ++requestVersion.current
    if (!jobId) {
      setJob(null)
      setSelectionMap({})
      setLoadError('missing')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const result = await commerceServices.cart.getImportJob(jobId)
      if (version !== requestVersion.current) return
      setJob(result)
      setSelectionMap((current) => retainPendingSelections(result, current))
      setConfirmed(false)
    } catch (error) {
      if (version !== requestVersion.current) return
      const statusCode = statusCodeOf(error)
      if (statusCode === 404 || statusCode === 403 || statusCode === 401) {
        setJob(null)
        setSelectionMap({})
        setLoadError(statusCode === 401 ? 'unauthorized' : 'missing')
      } else {
        setLoadError('retry')
      }
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    confirmInFlight.current = false
    setSubmitting(false)
    setJob(null)
    setSelectionMap({})
    setConfirmed(false)
    setActiveTab('to-confirm')
    void loadJob()
    return () => { requestVersion.current += 1 }
  }, [loadJob])

  useRefreshOnReturn(() => { void loadJob() })

  const originalPendingItems = job?.result?.pendingItems ?? []
  const unmatchedItems = originalPendingItems.filter((row) => !row.candidates?.length)
  const selectableItems = originalPendingItems.filter((row) => row.candidates?.length)
  const pendingItems = confirmed ? unmatchedItems : originalPendingItems
  const newlyAddedItems = confirmed ? selectableItems.map((row) => ({
    rowNo: row.rowNo,
    skuId: selectionMap[row.rowNo].skuId,
    qty: selectionMap[row.rowNo].qty ?? 1
  })) : []
  const autoAddedItems = [...(job?.result?.autoAddedItems ?? []), ...newlyAddedItems]
  const identifiedCount = (job?.result?.autoAddedCount ?? job?.result?.autoAddedItems.length ?? 0) + newlyAddedItems.length
  const totalCount = identifiedCount + pendingItems.length
  const ready = job?.status === 'SUCCEEDED' && Boolean(job.result)
  const complete = confirmed || (ready && selectableItems.length === 0)

  const handleBack = () => {
    void Taro.navigateBack().catch(() => switchTabLike(ROUTES.cart))
  }

  const handleSelectSpec = async (item: CartImportPendingItem) => {
    if (loading || confirmInFlight.current || confirmed) return
    const candidates = item.candidates ?? []
    if (!candidates.length) {
      await Taro.showToast({ title: '没有候选项，请修改文件后重新上传', icon: 'none' })
      return
    }
    const version = requestVersion.current
    try {
      const selected = await Taro.showActionSheet({
        itemList: candidates.map((candidate) => candidate.sku.spec ?? candidate.sku.name)
      })
      const candidate = candidates[selected.tapIndex]
      if (!candidate || version !== requestVersion.current || confirmInFlight.current) return
      const qty = Number(item.rawQty)
      setSelectionMap((current) => ({
        ...current,
        [item.rowNo]: {
          rowNo: item.rowNo,
          skuId: candidate.sku.id,
          ...(Number.isSafeInteger(qty) && qty > 0 ? { qty } : {})
        }
      }))
    } catch (error) {
      if (!(error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        await Taro.showToast({ title: '选择失败，请重试', icon: 'none' })
      }
    }
  }

  const returnToCart = async () => {
    try {
      await switchTabLike(ROUTES.cart)
    } catch {
      await Taro.showToast({ title: '返回购物车失败，请重试', icon: 'none' })
    }
  }

  const handleConfirm = async () => {
    if (!job || !ready || loading || loadError || confirmInFlight.current) return
    if (complete) {
      await returnToCart()
      return
    }
    const selections = selectableItems.map((row) => selectionMap[row.rowNo])
    if (selections.some((selection) => !selection)) {
      await Taro.showToast({ title: '请完成全部选择', icon: 'none' })
      return
    }
    confirmInFlight.current = true
    setSubmitting(true)
    const version = requestVersion.current
    try {
      await commerceServices.cart.confirmImport(job.id, selections)
      if (version !== requestVersion.current) return
      setConfirmed(true)
      await Taro.showToast({ title: unmatchedItems.length ? '已加入所选商品，仍有未匹配行' : '已加入购物车', icon: 'success' })
      if (!unmatchedItems.length) await returnToCart()
    } catch (error) {
      if (version !== requestVersion.current) return
      const statusCode = statusCodeOf(error)
      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        setJob(null)
        setSelectionMap({})
        setLoadError(statusCode === 401 ? 'unauthorized' : 'missing')
      } else if (statusCode === 409) {
        await Taro.showToast({ title: '导入结果已变化，请刷新后确认', icon: 'none' })
        setLoadError('retry')
      } else {
        await Taro.showToast({ title: '确认失败，请重试', icon: 'none' })
      }
    } finally {
      if (version === requestVersion.current) {
        confirmInFlight.current = false
        setSubmitting(false)
      }
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
        <Navbar.NavLeft onClick={handleBack} />
        <Navbar.Title>导入确认</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        {loadError ? (
          <View className='placeholder-actions'>
            <Text>{loadError === 'missing' ? '导入任务不存在或已失效' : loadError === 'unauthorized' ? '登录已失效，请重新登录' : '加载导入任务失败，请重试'}</Text>
            {loadError === 'retry' ? <Button onClick={() => void loadJob()}>重试</Button> : null}
            {loadError === 'missing' ? <Button onClick={() => void navigateTo(ROUTES.import)}>重新上传</Button> : null}
            {loadError === 'unauthorized' ? (
              <Button onClick={() => void navigateTo(withQuery(ROUTES.authLogin, { redirect: importConfirmRoute(jobId) }))}>重新登录</Button>
            ) : null}
          </View>
        ) : ready && job ? (
          confirmed && !unmatchedItems.length ? <Text>已加入购物车</Text> : (
            <ImportResultView
              activeTab={activeTab}
              autoAddedItems={autoAddedItems}
              handleSelectSpec={handleSelectSpec}
              identifiedCount={identifiedCount}
              disabled={loading || submitting}
              onTabChange={setActiveTab}
              pendingItems={pendingItems}
              progressPercent={totalCount ? Math.round(identifiedCount / totalCount * 100) : 0}
              selectionMap={selectionMap}
              totalCount={totalCount}
            />
          )
        ) : loading ? <Text>正在加载导入任务...</Text> : (
          <View className='placeholder-actions'>
            <Text>{job?.status === 'FAILED' ? '导入处理失败，请重新上传' : '正在处理导入文件，请稍后刷新'}</Text>
            {job?.status === 'FAILED'
              ? <Button onClick={() => void navigateTo(ROUTES.import)}>重新上传</Button>
              : <Button onClick={() => void loadJob()}>刷新</Button>}
          </View>
        )}
        {ready && !loadError && unmatchedItems.length > 0 ? (
          <Text>{`${unmatchedItems.length} 行未匹配，尚未加入购物车。请仅修正这些行后重新导入，避免重复导入已加入的商品。`}</Text>
        ) : null}
      </View>
      {ready && !loadError ? (
        <AppFixedBottom contentClassName='cart-bottom-bar cart-bottom-bar--import'>
          <View className='cart-bottom-summary cart-bottom-summary--import'>
            <Text className='cart-bottom-summary-label'>导入结果</Text>
            <Text className='cart-bottom-summary-meta'>
              {complete
                ? unmatchedItems.length ? `已加入 ${identifiedCount} 行，仍有 ${unmatchedItems.length} 行未匹配` : '商品已加入购物车'
                : '请完成可匹配项后加入购物车'}
            </Text>
          </View>
          <View className='cart-bottom-actions'>
            <Button className='cart-action cart-action-primary' disabled={loading || submitting} onClick={() => void handleConfirm()}>
              {complete ? '返回购物车' : '确认并加入购物车'}
            </Button>
          </View>
        </AppFixedBottom>
      ) : null}
    </View>
  )
}
