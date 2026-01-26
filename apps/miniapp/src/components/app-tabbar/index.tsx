import Tabbar from '@taroify/core/tabbar'
import OrdersOutlined from '@taroify/icons/OrdersOutlined'
import ShoppingCartOutlined from '@taroify/icons/ShoppingCartOutlined'
import UserOutlined from '@taroify/icons/UserOutlined'
import WapHomeOutlined from '@taroify/icons/WapHomeOutlined'
import { ROUTES } from '../../routes'
import { switchTabLike } from '../../utils/navigation'

const TAB_ITEMS = [
  { key: 'home', label: 'Home', icon: <WapHomeOutlined />, url: ROUTES.home },
  { key: 'cart', label: 'Cart', icon: <ShoppingCartOutlined />, url: ROUTES.cart },
  { key: 'orders', label: 'Orders', icon: <OrdersOutlined />, url: ROUTES.orders },
  { key: 'mine', label: 'Mine', icon: <UserOutlined />, url: ROUTES.mine }
] as const

export type AppTabKey = (typeof TAB_ITEMS)[number]['key']

type AppTabbarProps = {
  value: AppTabKey
  fixed?: boolean
  placeholder?: boolean
}

export default function AppTabbar({ value, fixed = true, placeholder = true }: AppTabbarProps) {
  const handleChange = (nextValue: AppTabKey) => {
    if (nextValue === value) return
    const target = TAB_ITEMS.find((item) => item.key === nextValue)
    if (!target) return
    switchTabLike(target.url)
  }

  return (
    <Tabbar
      value={value}
      fixed={fixed}
      placeholder={placeholder}
      safeArea={fixed ? 'bottom' : undefined}
      onChange={(next) => handleChange(next as AppTabKey)}
    >
      {TAB_ITEMS.map((item) => (
        <Tabbar.TabItem key={item.key} value={item.key} icon={item.icon}>
          {item.label}
        </Tabbar.TabItem>
      ))}
    </Tabbar>
  )
}
