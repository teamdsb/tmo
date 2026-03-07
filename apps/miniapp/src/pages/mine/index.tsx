import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import {
  Exchange,
  Logistics,
  OrdersOutlined,
  TodoList
} from '@taroify/icons'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { ROUTES } from '../../routes'
import { clearAuthSession, hasAuthToken, isUnauthorized } from '../../utils/auth'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo } from '../../utils/navigation'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import { runtimeEnv } from '../../config/runtime-env'
import {
  INITIAL_ADDRESSES_DATA,
  INITIAL_DEMANDS_DATA,
  INITIAL_MESSAGES,
  INITIAL_ORDERS_DATA,
  PENDING_ORDER_STATUSES,
  createMineMenuItems,
  toOrderBadge
} from './data'
import { AddressView, ChatView, DemandView, MineProfileView, OrderManagementView } from './components'
import type { ChatMessage, MenuItem, MineSubview, OrderBadges, OrderItem } from './types'

export default function PersonalCenter() {
  const navbarStyle = getNavbarStyle()
  const isH5 = process.env.TARO_ENV === 'h5'

  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [orderBadges, setOrderBadges] = useState<OrderBadges>({})
  const [loggingOut, setLoggingOut] = useState(false)
  const [currentPage, setCurrentPage] = useState<MineSubview>('profile')
  const [initialOrderTab, setInitialOrderTab] = useState('全部')

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [chatInputValue, setChatInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avatarFallback = placeholderProductImage

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

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current)
      }
    }
  }, [])

  const isLoggedIn = Boolean(bootstrap?.me)
  const displayName = bootstrap?.me?.displayName?.trim() || (isLoggedIn ? '企业用户' : '未登录')
  const roleLabel = bootstrap?.me?.roles?.find((role) => typeof role === 'string' && role.trim())?.trim() || '高级 B2B 客户经理'
  const ownerSalesDisplayName = bootstrap?.me?.ownerSalesDisplayName?.trim() || '暂未分配专属顾问'

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

  const handleSendChat = () => {
    const trimmed = chatInputValue.trim()
    if (!trimmed) {
      return
    }

    setChatMessages((prev) => [...prev, { id: Date.now(), sender: 'user', text: trimmed, time: '14:35' }])
    setChatInputValue('')

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current)
    }
    if (replyTimerRef.current) {
      clearTimeout(replyTimerRef.current)
    }

    typingTimerRef.current = setTimeout(() => {
      setIsTyping(true)
      replyTimerRef.current = setTimeout(() => {
        setIsTyping(false)
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, sender: 'agent', text: '已收到，我马上为您核实。', time: '14:36' }
        ])
      }, 1200)
    }, 600)
  }

  return (
    <View className='page font-sans mine-modern' style={isH5 ? navbarStyle : undefined}>
      {isH5 ? <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--primary'></Navbar> : null}

      {currentPage === 'chat' ? (
        <ChatView
          messages={chatMessages}
          isTyping={isTyping}
          inputValue={chatInputValue}
          onInput={setChatInputValue}
          onSend={handleSendChat}
          onBack={() => setCurrentPage('profile')}
        />
      ) : null}

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
        <DemandView demands={INITIAL_DEMANDS_DATA} onBack={() => setCurrentPage('profile')} />
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
          onOpenOrders={(tab) => {
            setInitialOrderTab(tab)
            setCurrentPage('orders')
          }}
          onOpenChat={() => setCurrentPage('chat')}
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
        />
      ) : null}
    </View>
  )
}
