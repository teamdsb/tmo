import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import {
  AppsOutlined,
  ArrowRight,
  BarChartOutlined,
  ChatOutlined,
  Description,
  Exchange,
  HomeOutlined,
  LocationOutlined,
  Logistics,
  OrdersOutlined,
  Revoke,
  ServiceOutlined,
  SettingOutlined,
  StarOutlined,
  TodoList,
  UserOutlined
} from '@taroify/icons'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import AppTabbar from '../../components/app-tabbar'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'

type IconComponent = (props: { className?: string }) => JSX.Element

type MenuItem = {
  key: string
  label: string
  icon: IconComponent
  route: string
}

type OrderItem = {
  key: string
  label: string
  icon: IconComponent
  badge?: string
  route: string
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'demand', label: 'My Demand Requests', icon: Description, route: ROUTES.demandList },
  { key: 'favorites', label: 'Favorites', icon: StarOutlined, route: ROUTES.favorites },
  { key: 'address', label: 'Shipping Address', icon: LocationOutlined, route: ROUTES.addressList },
  { key: 'import', label: 'Bulk Excel Import', icon: AppsOutlined, route: ROUTES.import },
  { key: 'tracking', label: 'Batch Tracking', icon: BarChartOutlined, route: ROUTES.trackingBatch },
  { key: 'settings', label: 'System Settings', icon: SettingOutlined, route: ROUTES.settings }
]

const ORDER_ITEMS: OrderItem[] = [
  { key: 'pending', label: 'Pending', icon: OrdersOutlined, badge: '2', route: ROUTES.orders },
  { key: 'shipped', label: 'Shipped', icon: Logistics, route: ROUTES.orders },
  { key: 'delivered', label: 'Delivered', icon: TodoList, route: ROUTES.orders },
  { key: 'returns', label: 'Returns', icon: Exchange, route: ROUTES.orders }
]

type MenuLinkProps = {
  icon: IconComponent
  label: string
  onClick: () => void
  showDivider: boolean
}

function MenuLink({ icon: Icon, label, onClick, showDivider }: MenuLinkProps) {
  const rowClassName = `flex items-center justify-between px-4 py-3 ${
    showDivider ? 'border-b mine-divider' : ''
  }`

  return (
    <View className={rowClassName} onClick={onClick}>
      <View className='flex items-center gap-3'>
        <View className='w-6 h-6 flex items-center justify-center'>
          <Icon className='text-lg mine-icon' />
        </View>
        <Text className='text-sm font-medium'>{label}</Text>
      </View>
      <ArrowRight className='text-lg mine-subtle' />
    </View>
  )
}

type OrderItemProps = {
  icon: IconComponent
  label: string
  badge?: string
  onClick: () => void
}

function OrderItem({ icon: Icon, label, badge, onClick }: OrderItemProps) {
  return (
    <View className='flex flex-col items-center gap-2' onClick={onClick}>
      <View className='relative w-10 h-10 rounded-full mine-accent-bg flex items-center justify-center'>
        <Icon className='text-lg mine-accent' />
        {badge ? (
          <View className='absolute -top-1 -right-1 w-5 h-5 rounded-full mine-accent-solid text-xs leading-none flex items-center justify-center'>
            {badge}
          </View>
        ) : null}
      </View>
      <Text className='text-xs mine-muted'>{label}</Text>
    </View>
  )
}

export default function PersonalCenter() {
  const navbarStyle = getNavbarStyle()
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [isDark] = useState(() => Taro.getSystemInfoSync().theme === 'dark')
  const avatarFallback =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD6aMVVw542vMjqZUxZGYQDmSOyXCShOpx5kUCN61Wv6okrwKBUp-S_ZKLBYnnJqx_-Vx3-NhyPVZuH7gHkceoGBQajnU3ksD25p10yGt0-gT2HiURQNGy_gnhIX7OKre0UsPZyZOPchGKAqwzYVK1fBl081v0ZlwBlwVuv6RrLFj_h5OEIq0p_a7zFGn226VwTy0LMxL8E9P9LWcmgSTpQj6Tx-Th1qgUYfuhBUqvqiH9YIOAY249t69mZAho6SakEZO55UHrVJq2k'

  useEffect(() => {
    void (async () => {
      const cached = await loadBootstrap()
      if (cached) {
        setBootstrap(cached)
      }
      try {
        const fresh = await gatewayServices.bootstrap.get()
        setBootstrap(fresh)
        await saveBootstrap(fresh)
      } catch (error) {
        console.warn('bootstrap refresh failed', error)
      }
    })()
  }, [])

  const isLoggedIn = Boolean(bootstrap?.me)
  const displayName = bootstrap?.me?.displayName ?? 'Guest'
  const themeClassName = isDark ? 'mine-theme mine-theme--dark' : 'mine-theme'

  const handleLogout = async () => {
    await gatewayServices.tokens.setToken(null)
    await commerceServices.tokens.setToken(null)
    await identityServices.tokens.setToken(null)
    await clearBootstrap()
    await Taro.showToast({ title: 'Signed out', icon: 'none' })
    await switchTabLike(ROUTES.home)
  }

  return (
    <View className={`page pb-24 font-sans mine-page ${themeClassName}`}>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'></Navbar>

      <View className='px-5 pt-4 pb-2 flex items-center justify-between'>
        <View
          className='w-8 h-8 rounded-full mine-card border flex items-center justify-center'
          onClick={() => switchTabLike(ROUTES.home)}
        >
          <HomeOutlined className='text-base mine-icon' />
        </View>
        <Text className='text-base font-medium'>My Profile</Text>
        <View className='w-8 h-8' />
      </View>

      <View className='px-5 pt-2 pb-6'>
        <View className='flex items-center gap-4'>
          {isLoggedIn ? (
            <>
              <View className='relative'>
                <Image
                  className='w-16 h-16 rounded-full'
                  src={avatarFallback}
                  mode='aspectFill'
                />
                <View className='absolute bottom-0 right-0 w-3 h-3 rounded-full mine-accent-solid border-2 mine-avatar-border' />
              </View>
              <View>
                <Text className='text-xl font-semibold'>{displayName}</Text>
              </View>
            </>
          ) : (
            <>
              <View
                className='w-16 h-16 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center'
                onClick={() => navigateTo(ROUTES.authLogin)}
              >
                <UserOutlined className='text-2xl text-slate-400' />
              </View>
              <View className='flex-1'>
                <Text className='text-xl font-semibold'>未登录</Text>
                <Text className='text-sm mine-muted'>请先登录以查看账号信息</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <View className='px-5 mb-6'>
        <View
          className='mine-card mine-shadow border rounded-2xl p-4 mine-contact-card'
          onClick={() => navigateTo(ROUTES.support)}
        >
          <View className='mine-contact-row'>
            <View className='mine-contact-icon'>
              <ServiceOutlined className='text-base mine-accent' />
            </View>
            <Text className='mine-contact-label'>Account Manager</Text>
            <View className='mine-contact-spacer' />
            <View className='mine-contact-action'>
              <ChatOutlined className='text-base' />
            </View>
          </View>
          <Text className='mine-contact-name'>Sarah Wang</Text>
        </View>
      </View>

      <View className='px-5 mb-6'>
        <View className='flex items-center justify-between mb-4'>
          <Text className='text-lg font-medium'>Order Tracking</Text>
          <Text className='text-sm mine-muted' onClick={() => navigateTo(ROUTES.orders)}>
            View All
          </Text>
        </View>
        <View className='mine-card mine-shadow border rounded-2xl p-4'>
          <View className='grid grid-cols-4 gap-2'>
            {ORDER_ITEMS.map((item) => (
              <OrderItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                badge={item.badge}
                onClick={() => navigateTo(item.route)}
              />
            ))}
          </View>
        </View>
      </View>

      <View className='px-5 mb-6'>
        <View className='mine-card mine-shadow border rounded-2xl overflow-hidden'>
          {MENU_ITEMS.map((item, index) => (
            <MenuLink
              key={item.key}
              icon={item.icon}
              label={item.label}
              onClick={() => navigateTo(item.route)}
              showDivider={index < MENU_ITEMS.length - 1}
            />
          ))}
        </View>
      </View>

      <View className='px-5 pb-8'>
        <View
          className='mine-card border rounded-xl py-3 flex items-center justify-center gap-2'
          onClick={handleLogout}
        >
          <Revoke className='text-base mine-subtle' />
          <Text className='text-sm font-medium mine-muted'>Switch Account or Logout</Text>
        </View>
      </View>

      <AppTabbar value='mine' />
    </View>
  )
}
