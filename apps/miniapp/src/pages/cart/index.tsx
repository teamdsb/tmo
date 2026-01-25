import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tabs from '@taroify/core/tabs'
import Progress from '@taroify/core/progress'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import Button from '@taroify/core/button'
import Flex from '@taroify/core/flex'
import FixedView from '@taroify/core/fixed-view'
import QuestionOutlined from '@taroify/icons/QuestionOutlined'
import WarningOutlined from '@taroify/icons/WarningOutlined'
import AppTabbar from '../../components/app-tabbar'
import { getNavbarStyle } from '../../utils/navbar'
import { commerceServices } from '../../services/commerce'
import { ROUTES } from '../../routes'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import type {
  Cart,
  CartImportJob,
  CartImportPendingItem,
  CartImportSelection
} from '@tmo/api-client'

export default function ExcelImportConfirmation() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('to-confirm')
  const [importJob, setImportJob] = useState<CartImportJob | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [selectionMap, setSelectionMap] = useState<Record<number, CartImportSelection>>({})
  const [loading, setLoading] = useState(false)
  const navbarStyle = getNavbarStyle()

  const jobIdParam = typeof router.params?.jobId === 'string' ? router.params.jobId : null

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        if (jobIdParam) {
          const job = await commerceServices.cart.getImportJob(jobIdParam)
          setImportJob(job)
          setCart(null)
          setSelectionMap({})
          if (job.result?.pendingItems?.length) {
            setActiveTab('to-confirm')
          }
          return
        }
        const cartData = await commerceServices.cart.getCart()
        setCart(cartData)
        setImportJob(null)
      } catch (error) {
        console.warn('load cart/import failed', error)
        await Taro.showToast({ title: 'Failed to load cart', icon: 'none' })
      } finally {
        setLoading(false)
      }
    })()
  }, [jobIdParam])

  const pendingItems = importJob?.result?.pendingItems ?? []
  const autoAddedItems = importJob?.result?.autoAddedItems ?? []
  const identifiedCount = importJob?.result?.autoAddedCount ?? 0
  const pendingCount = importJob?.result?.pendingCount ?? pendingItems.length
  const totalCount = identifiedCount + pendingCount

  const progressPercent = totalCount > 0 ? Math.round((identifiedCount / totalCount) * 100) : 0

  const selections = useMemo(() => Object.values(selectionMap), [selectionMap])

  const handleSelectSpec = async (item: CartImportPendingItem) => {
    const candidates = item.candidates ?? []
    if (candidates.length === 0) {
      await Taro.showToast({ title: 'No candidates', icon: 'none' })
      return
    }
    try {
      const result = await Taro.showActionSheet({
        itemList: candidates.map((candidate) => candidate.sku.spec ?? candidate.sku.name)
      })
      const candidate = candidates[result.tapIndex]
      if (!candidate) return
      const qty = item.rawQty ? Number.parseInt(item.rawQty, 10) : undefined
      setSelectionMap((prev) => ({
        ...prev,
        [item.rowNo]: {
          rowNo: item.rowNo,
          skuId: candidate.sku.id,
          qty: Number.isNaN(qty) ? undefined : qty
        }
      }))
    } catch (error) {
      if ((error as { errMsg?: string })?.errMsg?.includes('cancel')) {
        return
      }
      console.warn('select spec failed', error)
      await Taro.showToast({ title: 'Select failed', icon: 'none' })
    }
  }

  const handleConfirmImport = async () => {
    if (!importJob?.id) return
    if (pendingItems.length > 0 && selections.length < pendingItems.length) {
      await Taro.showToast({ title: 'Complete all selections', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      const updatedCart = await commerceServices.cart.confirmImport(importJob.id, selections)
      setCart(updatedCart)
      setImportJob(null)
      await Taro.showToast({ title: 'Added to cart', icon: 'success' })
      await switchTabLike(ROUTES.cart)
    } catch (error) {
      console.warn('confirm import failed', error)
      await Taro.showToast({ title: 'Confirm failed', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className='page page-compact-navbar'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>

      {importJob ? (
        <>
          <View className='page-content'>
            <Flex justify='space-between' align='end'>
              <View>
                <Text className='section-title'>
                  {totalCount > 0 ? `${totalCount} Items Found` : 'Import Job'}
                </Text>
                <Text className='section-subtitle'>Ready for your review</Text>
              </View>
              <Tag size='small' color='primary'>
                {identifiedCount}/{totalCount} Identified
              </Tag>
            </Flex>

            <Progress percent={progressPercent} color='primary' />

            <Flex align='center' gutter={6} className='section-notice'>
              <WarningOutlined />
              <Text className='section-subtitle'>
                {pendingCount} items require specification choice
              </Text>
            </Flex>
          </View>

          <Tabs value={activeTab} onChange={(value) => setActiveTab(String(value))}>
            <Tabs.TabPane value='to-confirm' title={`To Confirm (${pendingItems.length})`}>
              <Cell.Group inset>
                {pendingItems.map((item) => {
                  const selected = selectionMap[item.rowNo]
                  return (
                    <Cell
                      key={item.rowNo}
                      icon={<QuestionOutlined />}
                      title={item.rawName}
                      brief={`Row ${item.rowNo} · ${item.matchType}`}
                      rightIcon={(
                        <Button size='small' color='primary' onClick={() => handleSelectSpec(item)}>
                          {selected ? 'Selected' : 'Select Spec'}
                        </Button>
                      )}
                    />
                  )
                })}
                {pendingItems.length === 0 ? (
                  <Cell title='No pending items' brief='All items were auto-matched.' />
                ) : null}
              </Cell.Group>
            </Tabs.TabPane>

            <Tabs.TabPane value='confirmed' title={`Confirmed (${autoAddedItems.length})`}>
              <Cell.Group inset>
                {autoAddedItems.map((item) => (
                  <Cell
                    key={`${item.rowNo}-${item.skuId}`}
                    title={`SKU ${item.skuId.slice(0, 8)}`}
                    brief={`Qty: ${item.qty} · Row ${item.rowNo}`}
                  />
                ))}
                {autoAddedItems.length === 0 ? (
                  <Cell title='No auto-added items' brief='Selections will appear here after confirmation.' />
                ) : null}
              </Cell.Group>
            </Tabs.TabPane>
          </Tabs>
        </>
      ) : (
        <View className='page-content'>
          <Flex justify='space-between' align='center'>
            <View>
              <Text className='section-title'>Cart</Text>
              <Text className='section-subtitle'>Review items before checkout</Text>
            </View>
            <Button size='small' variant='outlined' onClick={() => navigateTo(ROUTES.import)}>
              Bulk Import
            </Button>
          </Flex>
          <Cell.Group inset>
            {(cart?.items ?? []).map((item) => (
              <Cell
                key={item.id}
                title={item.sku.name}
                brief={`Qty: ${item.qty}`}
              />
            ))}
            {(cart?.items ?? []).length === 0 ? (
              <Cell title='Cart is empty' brief='Use bulk import or add items from catalog.' />
            ) : null}
          </Cell.Group>
        </View>
      )}

      <FixedView position='bottom' safeArea='bottom' placeholder>
        <Flex justify='space-between' gutter={12} className='action-bar'>
          <Button block variant='outlined' disabled={loading}>
            {importJob ? 'Save Draft' : 'Continue Browsing'}
          </Button>
          <Button block color='primary' disabled={loading} onClick={importJob ? handleConfirmImport : undefined}>
            {importJob ? 'Confirm & Add to Cart' : 'Checkout'}
          </Button>
        </Flex>
        <AppTabbar value='cart' fixed={false} placeholder={false} />
      </FixedView>
    </View>
  )
}
