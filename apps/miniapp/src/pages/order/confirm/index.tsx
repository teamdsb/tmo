import { useCallback, useState } from 'react'
import { View, Text, Textarea } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import type { Cart } from '@tmo/api-client'
import { ROUTES, orderDetailRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { ensureLoggedIn } from '../../../utils/auth'
import { commerceServices } from '../../../services/commerce'

type LocalAddress = {
  id: string
  name: string
  phone: string
  address: string
  isDefault: boolean
}

const STORAGE_KEY = 'tmo.addresses'

export default function OrderConfirmPage() {
  const navbarStyle = getNavbarStyle()
  const [cart, setCart] = useState<Cart | null>(null)
  const [addresses, setAddresses] = useState<LocalAddress[]>([])
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const allowed = await ensureLoggedIn({ redirect: true })
      if (!allowed) return
      const cartData = await commerceServices.cart.getCart()
      setCart(cartData)
      const stored = Taro.getStorageSync(STORAGE_KEY)
      setAddresses(Array.isArray(stored) ? stored : [])
    } catch (error) {
      console.warn('load confirm data failed', error)
      await Taro.showToast({ title: '加载订单数据失败', icon: 'none' })
    }
  }, [])

  useDidShow(() => {
    void loadData()
  })

  const defaultAddress = addresses.find((addr) => addr.isDefault) ?? addresses[0]
  const cartItems = cart?.items ?? []

  const handleSubmit = async () => {
    if (!cartItems.length) {
      await Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    if (!defaultAddress) {
      await Taro.showToast({ title: '请添加收货地址', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    setSubmitting(true)
    try {
      const order = await commerceServices.orders.submit({
        address: {
          receiverName: defaultAddress.name,
          receiverPhone: defaultAddress.phone,
          detail: defaultAddress.address
        },
        remark: remark.trim() || undefined,
        items: cartItems.map((item) => ({
          skuId: item.sku.id,
          qty: item.qty
        }))
      })
      await Taro.showToast({ title: '订单已提交', icon: 'success' })
      await navigateTo(orderDetailRoute(order.id))
    } catch (error) {
      console.warn('submit order failed', error)
      await Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.cart))} />
        <Navbar.Title>确认订单</Navbar.Title>
        <Navbar.NavRight>
          <Text className='text-xs text-slate-400'>{cartItems.length} 件</Text>
        </Navbar.NavRight>
      </Navbar>

      <View className='page-content'>
        <View className='bg-white rounded-2xl border border-slate-100 p-4 mb-4'>
          <View className='flex items-center justify-between mb-2'>
            <Text className='text-sm font-semibold text-slate-900'>收货地址</Text>
            <Text className='text-xs text-blue-600' onClick={() => navigateTo(ROUTES.addressList)}>
              管理
            </Text>
          </View>
          {defaultAddress ? (
            <>
              <Text className='text-sm text-slate-900'>
                {defaultAddress.name} · {defaultAddress.phone}
              </Text>
              <Text className='text-xs text-slate-500 mt-1'>{defaultAddress.address}</Text>
            </>
          ) : (
            <View className='py-3'>
              <Text className='text-xs text-slate-400'>暂无地址，请先添加。</Text>
              <Button
                size='small'
                color='primary'
                className='mt-3'
                onClick={() => navigateTo(ROUTES.addressList)}
              >
                添加地址
              </Button>
            </View>
          )}
        </View>

        <View className='bg-white rounded-2xl border border-slate-100 p-4 mb-4'>
          <Text className='text-sm font-semibold text-slate-900 mb-3'>商品</Text>
          <Cell.Group inset>
            {cartItems.map((item) => (
              <Cell
                key={item.id}
                title={item.sku.name}
                brief={item.sku.spec ?? '标准规格'}
                rightIcon={<Text>×{item.qty}</Text>}
              />
            ))}
            {cartItems.length === 0 ? <Cell title='购物车为空' /> : null}
          </Cell.Group>
        </View>

        <View className='bg-white rounded-2xl border border-slate-100 p-4'>
          <Text className='text-sm font-semibold text-slate-900 mb-2'>备注</Text>
          <Textarea
            className='w-full px-3 py-2 rounded-xl bg-slate-50 text-sm'
            placeholder='添加订单备注...'
            value={remark}
            onInput={(event) => setRemark(event.detail.value)}
          />
        </View>

        <View className='placeholder-actions'>
          <Button block color='primary' loading={submitting} onClick={handleSubmit}>
            提交意向订单
          </Button>
        </View>
      </View>
    </View>
  )
}
