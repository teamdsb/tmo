import { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, Button as NativeButton } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
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
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import { getRuntimeTheme } from '../../utils/device-info'

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
  { key: 'demand', label: '我的需求', icon: Description, route: ROUTES.demandList },
  { key: 'favorites', label: '收藏', icon: StarOutlined, route: ROUTES.favorites },
  { key: 'address', label: '收货地址', icon: LocationOutlined, route: ROUTES.addressList },
  { key: 'import', label: 'Excel 批量导入', icon: AppsOutlined, route: ROUTES.import },
  { key: 'tracking', label: '批量物流', icon: BarChartOutlined, route: ROUTES.trackingBatch },
  { key: 'settings', label: '系统设置', icon: SettingOutlined, route: ROUTES.settings }
]

const ORDER_ITEMS: OrderItem[] = [
  { key: 'pending', label: '待处理', icon: OrdersOutlined, badge: '2', route: ROUTES.orders },
  { key: 'shipped', label: '已发货', icon: Logistics, route: ROUTES.orders },
  { key: 'delivered', label: '已送达', icon: TodoList, route: ROUTES.orders },
  { key: 'returns', label: '退货', icon: Exchange, route: ROUTES.orders }
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
  const isH5 = process.env.TARO_ENV === 'h5'
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [isDark] = useState(() => getRuntimeTheme() === 'dark')
  const [loggingOut, setLoggingOut] = useState(false)
  const avatarFallback = placeholderProductImage

  const refreshBootstrap = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void refreshBootstrap()
  }, [refreshBootstrap])

  useDidShow(() => {
    void (async () => {
      await refreshBootstrap()
    })()
  })

  const isLoggedIn = Boolean(bootstrap?.me)
  const displayName = bootstrap?.me?.displayName ?? '访客'
  const themeClassName = isDark ? 'mine-theme mine-theme--dark' : 'mine-theme'

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    try {
      const results = await Promise.allSettled([
        gatewayServices.tokens.setToken(null),
        commerceServices.tokens.setToken(null),
        identityServices.tokens.setToken(null),
        clearBootstrap()
      ])
      const hasFailedTask = results.some((item) => item.status === 'rejected')
      if (hasFailedTask) {
        throw new Error('logout cleanup failed')
      }
      setBootstrap(null)
      await Taro.showToast({ title: '已退出登录', icon: 'none' })
    } catch (error) {
      console.warn('logout failed', error)
      await Taro.showToast({ title: '退出失败，请重试', icon: 'none' })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <View className={`page font-sans mine-page ${themeClassName}`} style={isH5 ? navbarStyle : undefined}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'></Navbar> : null}

      <View className='px-5 pt-4 pb-2 flex items-center justify-between'>
        <View
          className='w-8 h-8 rounded-full mine-card border flex items-center justify-center'
          onClick={() => switchTabLike(ROUTES.home)}
        >
          <HomeOutlined className='text-base mine-icon' />
        </View>
        <Text className='text-base font-medium'>我的</Text>
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

      {isLoggedIn ? (
        <View className='px-5 mb-6'>
          <View
            className='mine-card mine-shadow border rounded-2xl p-4 mine-contact-card'
            onClick={() => navigateTo(ROUTES.support)}
          >
            <View className='mine-contact-row'>
              <View className='mine-contact-icon'>
                <ServiceOutlined className='text-base mine-accent' />
              </View>
              <Text className='mine-contact-label'>客户经理</Text>
              <View className='mine-contact-spacer' />
              <View className='mine-contact-action'>
                <ChatOutlined className='text-base' />
              </View>
            </View>
            <Text className='mine-contact-name'>王经理</Text>
          </View>
        </View>
      ) : null}

      <View className='px-5 mb-6'>
        <View className='flex items-center justify-between mb-4'>
          <Text className='text-lg font-medium'>订单跟踪</Text>
          <Text className='text-sm mine-muted' onClick={() => navigateTo(ROUTES.orders)}>
            查看全部
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

      <View className='px-5 pb-8 mine-logout-section'>
        <NativeButton
          id='mine-logout-btn'
          className={`mine-card border rounded-xl py-3 flex items-center justify-center gap-2 mine-logout-btn ${
            loggingOut ? 'opacity-60' : ''
          }`}
          disabled={loggingOut}
          onClick={handleLogout}
        >
          <Revoke className='text-base mine-subtle' />
          <Text className='text-sm font-medium mine-muted'>切换账号或退出登录</Text>
        </NativeButton>
      </View>
    </View>
  )
}
