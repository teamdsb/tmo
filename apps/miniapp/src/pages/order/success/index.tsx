import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import { ROUTES, orderDetailRoute } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import './index.scss'

export default function OrderSuccessPage() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const orderId = typeof router.params?.id === 'string' ? router.params.id.trim() : ''
  const payment = typeof router.params?.payment === 'string' ? router.params.payment.trim().toLowerCase() : ''
  const isPaid = payment === 'paid'

  const handleBack = () => {
    void switchTabLike(ROUTES.orders)
  }

  return (
    <View className='page order-success-page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary order-success-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(handleBack)} />
        <Navbar.Title>下单成功</Navbar.Title>
      </Navbar>

      <View className='page-content order-success-content'>
        <View className='order-success-card'>
          <View className='order-success-icon'>
            <Text className='order-success-icon-mark'>✓</Text>
          </View>
          <Text className='order-success-title'>下单成功</Text>
          {isPaid ? <Text className='order-success-payment'>支付成功</Text> : null}
          <Text className='order-success-copy'>
            管理员正在处理您的订单，您可以在订单列表中看到订单状况。
          </Text>
          {orderId ? <Text className='order-success-order-id'>订单号：{orderId}</Text> : null}
        </View>

        <View className='order-success-actions'>
          <Button block color='primary' className='order-success-primary' onClick={() => switchTabLike(ROUTES.orders)}>
            查看订单列表
          </Button>
          <Button
            block
            variant='outlined'
            className='order-success-secondary'
            disabled={!orderId}
            onClick={() => orderId && navigateTo(orderDetailRoute(orderId))}
          >
            查看订单详情
          </Button>
          <Button block variant='text' className='order-success-text-button' onClick={() => switchTabLike(ROUTES.home)}>
            继续购物
          </Button>
        </View>
      </View>
    </View>
  )
}
