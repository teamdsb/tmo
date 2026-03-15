import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import {
  Exchange,
  Logistics,
  OrdersOutlined,
  TodoList
} from '@taroify/icons'
import type { CreateProductRequest, ProductRequest } from '@tmo/api-client'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { ROUTES } from '../../routes'
import { clearAuthSession, hasAuthToken, isUnauthorized } from '../../utils/auth'
import { getCurrentRole } from '../../utils/authz'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import { identityServices } from '../../services/identity'
import { loadEditableProfile } from '../../services/profile'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import { runtimeEnv } from '../../config/runtime-env'
import {
  INITIAL_ADDRESSES_DATA,
  INITIAL_ORDERS_DATA,
  PENDING_ORDER_STATUSES,
  createMineMenuItems,
  toOrderBadge
} from './data'
import { AddressView, DemandView, MineProfileView, OrderManagementView } from './components'
import type { MenuItem, MineSubview, OrderBadges, OrderItem } from './types'

export default function PersonalCenter() {
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [orderBadges, setOrderBadges] = useState<OrderBadges>({})
  const [loggingOut, setLoggingOut] = useState(false)
  const [switchingRole, setSwitchingRole] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<MineSubview>('profile')
  const [initialOrderTab, setInitialOrderTab] = useState('全部')
  const [demands, setDemands] = useState<ProductRequest[]>([])
  const [editableDisplayName, setEditableDisplayName] = useState('')
  const [editableAvatarUrl, setEditableAvatarUrl] = useState('')

  const avatarFallback = editableAvatarUrl || placeholderProductImage

  const refreshOrderBadges = useCallback(async () => {
    try {
      const stats = await commerceServices.orders.stats()
      const countByStatus = new Map<string, number>()
      for (const item of stats.items ?? []) {
        const count = typeof item.count === 'number' ? item.count : 0
        countByStatus.set(item.status, (countByStatus.get(item.status) ?? 0) + count)
      }

      const pending = PENDING_ORDER_STATUSES.reduce((sum, status) => {
        return sum + (countByStatus.get(status) ?? 0)
      }, 0)

      setOrderBadges({
        pending: toOrderBadge(pending),
        shipped: toOrderBadge(countByStatus.get('SHIPPED') ?? 0),
        delivered: toOrderBadge(countByStatus.get('DELIVERED') ?? 0)
      })
    } catch (error) {
      console.warn('order stats refresh failed', error)
      setOrderBadges({})
    }
  }, [])

  const refreshBootstrap = useCallback(async () => {
    const cached = await loadBootstrap()
    const editableProfile = loadEditableProfile()
    setEditableDisplayName(editableProfile?.displayName || '')
    setEditableAvatarUrl(editableProfile?.avatarUrl || '')
    if (cached) {
      setBootstrap(cached)
    }
    const tokenExists = await hasAuthToken()
    if (!tokenExists) {
      setBootstrap(null)
      await clearBootstrap()
      return
    }
    if (runtimeEnv.isIsolatedMock) {
      return
    }
    try {
      const fresh = await gatewayServices.bootstrap.get()
      setBootstrap(fresh)
      await saveBootstrap(fresh)
    } catch (error) {
      if (isUnauthorized(error)) {
        setBootstrap(null)
        await clearAuthSession()
        return
      }
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

  useEffect(() => {
    if (!bootstrap?.me?.id) {
      setOrderBadges({})
      return
    }
    void refreshOrderBadges()
  }, [bootstrap?.me?.id, refreshOrderBadges])

  const refreshDemands = useCallback(async () => {
    if (!bootstrap?.me?.id) {
      setDemands([])
      return
    }

    try {
      const response = await commerceServices.productRequests.list({ page: 1, pageSize: 20 })
      setDemands(response.items ?? [])
    } catch (error) {
      console.warn('demand list refresh failed', error)
      await Taro.showToast({ title: '加载需求失败', icon: 'none' })
    }
  }, [bootstrap?.me?.id])

  useEffect(() => {
    if (currentPage !== 'demand') {
      return
    }
    void refreshDemands()
  }, [currentPage, refreshDemands])

  const isLoggedIn = Boolean(bootstrap?.me)
  const displayName = editableDisplayName || bootstrap?.me?.displayName?.trim() || (isLoggedIn ? '企业用户' : '未登录')
  const currentRole = getCurrentRole(bootstrap)
  const roleLabel = currentRole || '高级 B2B 客户经理'
  const ownerSalesDisplayName = bootstrap?.me?.ownerSalesDisplayName?.trim() || '暂未分配专属顾问'
  const debugRoleChoices = useMemo(() => {
    if (!runtimeEnv.enableDebugRoleSwitch) {
      return []
    }
    const roles = bootstrap?.me?.roles
    if (!Array.isArray(roles)) {
      return []
    }
    return Array.from(new Set(
      roles
        .filter((role): role is string => typeof role === 'string')
        .map((role) => role.trim().toUpperCase())
        .filter((role) => role === 'CUSTOMER' || role === 'SALES')
    ))
  }, [bootstrap?.me?.roles])

  const orderItems: OrderItem[] = [
    {
      key: 'pending',
      label: '待处理',
      icon: OrdersOutlined,
      badge: orderBadges.pending,
      onClick: () => {
        setInitialOrderTab('待处理')
        setCurrentPage('orders')
      }
    },
    {
      key: 'shipped',
      label: '已发货',
      icon: Logistics,
      badge: orderBadges.shipped,
      onClick: () => {
        setInitialOrderTab('已发货')
        setCurrentPage('orders')
      }
    },
    {
      key: 'delivered',
      label: '已送达',
      icon: TodoList,
      badge: orderBadges.delivered,
      onClick: () => {
        setInitialOrderTab('已送达')
        setCurrentPage('orders')
      }
    },
    {
      key: 'returns',
      label: '退换货',
      icon: Exchange,
      badge: orderBadges.returns,
      onClick: () => {
        setInitialOrderTab('退换货')
        setCurrentPage('orders')
      }
    }
  ]

  const menuItems: MenuItem[] = useMemo(
    () =>
      createMineMenuItems((page) => {
        if (page === 'orders') {
          setInitialOrderTab('待收货')
        }
        setCurrentPage(page)
      }),
    []
  )

  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)
    try {
      await clearAuthSession()
      setBootstrap(null)
      setCurrentPage('profile')
      await Taro.showToast({ title: '已退出登录', icon: 'none' })
      await switchTabLike(ROUTES.authLogin)
    } catch (error) {
      console.warn('logout failed', error)
      await Taro.showToast({ title: '退出失败，请重试', icon: 'none' })
    } finally {
      setLoggingOut(false)
    }
  }

  const handleSwitchRole = async (role: string) => {
    if (switchingRole || !bootstrap?.me) {
      return
    }
    setSwitchingRole(role)
    try {
      await identityServices.auth.switchRole({ role })
      const fresh = await gatewayServices.bootstrap.get()
      setBootstrap(fresh)
      await saveBootstrap(fresh)
      await Taro.showToast({ title: '角色已切换', icon: 'none' })
    } catch (error) {
      console.warn('switch role failed', error)
      await Taro.showToast({ title: '切换失败，请重试', icon: 'none' })
    } finally {
      setSwitchingRole(null)
    }
  }

  const handleCreateDemand = useCallback(async (payload: CreateProductRequest) => {
    const created = await commerceServices.productRequests.create(payload)
    setDemands((current) => [created, ...current.filter((item) => item.id !== created.id)])
    await Taro.showToast({ title: '已提交需求', icon: 'success' })
  }, [])

  return (
    <View className='page font-sans mine-modern' style={isH5 ? navbarStyle : undefined}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'></Navbar> : null}

      {currentPage === 'orders' ? (
        <OrderManagementView
          orders={INITIAL_ORDERS_DATA}
          initialTab={initialOrderTab}
          onBack={() => setCurrentPage('profile')}
        />
      ) : null}

      {currentPage === 'address' ? (
        <AddressView addresses={INITIAL_ADDRESSES_DATA} onBack={() => setCurrentPage('profile')} />
      ) : null}

      {currentPage === 'demand' ? (
        <DemandView
          demands={demands}
          onBack={() => setCurrentPage('profile')}
          onCreateDemand={handleCreateDemand}
        />
      ) : null}

      {currentPage === 'profile' ? (
        <MineProfileView
          avatarFallback={avatarFallback}
          displayName={displayName}
          isLoggedIn={isLoggedIn}
          roleLabel={roleLabel}
          ownerSalesDisplayName={ownerSalesDisplayName}
          orderItems={orderItems}
          menuItems={menuItems}
          loggingOut={loggingOut}
          debugRoleChoices={debugRoleChoices}
          currentRole={currentRole}
          switchingRole={switchingRole}
          onOpenOrders={(tab) => {
            setInitialOrderTab(tab)
            setCurrentPage('orders')
          }}
          onMenuItemClick={(item) => {
            if (typeof item.action === 'function') {
              item.action()
              return
            }
            if (item.route) {
              navigateTo(item.route)
            }
          }}
          onAuthAction={isLoggedIn ? handleLogout : () => navigateTo(ROUTES.authLogin)}
          onOpenAuth={() => navigateTo(ROUTES.authLogin)}
          onSwitchRole={handleSwitchRole}
        />
      ) : null}
    </View>
  )
}
