import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button as NativeButton, Image, Input, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import {
  AddOutlined,
  AppsOutlined,
  ArrowLeft,
  ArrowRight,
  BarChartOutlined,
  ChatOutlined,
  Description,
  Exchange,
  LocationOutlined,
  Logistics,
  MoreOutlined,
  OrdersOutlined,
  Revoke,
  ServiceOutlined,
  SettingOutlined,
  ShieldOutlined,
  StarOutlined,
  TodoList
} from '@taroify/icons'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo } from '../../utils/navigation'
import { gatewayServices } from '../../services/gateway'
import { commerceServices } from '../../services/commerce'
import { identityServices } from '../../services/identity'
import { clearBootstrap, loadBootstrap, saveBootstrap } from '../../services/bootstrap'
import placeholderProductImage from '../../assets/images/placeholder-product.svg'
import { runtimeEnv } from '../../config/runtime-env'

type IconComponent = (props: { className?: string }) => JSX.Element

type MenuItem = {
  key: string
  label: string
  icon: IconComponent
  action?: () => void
  route?: string
}

type OrderItem = {
  key: string
  label: string
  icon: IconComponent
  badge?: string
  onClick: () => void
}

type MineSubview = 'profile' | 'chat' | 'orders' | 'address' | 'demand'

type ChatMessage = {
  id: number
  sender: 'agent' | 'user'
  text: string
  time: string
  hasActions?: boolean
}

type MockOrderItem = {
  name: string
  specs: string
  price: number
  count: number
  image: string
}

type MockOrder = {
  id: string
  status: string
  date: string
  totalPrice: number
  items: MockOrderItem[]
  tracking: {
    latest: string
    time: string
  }
}

type MockAddress = {
  id: number
  name: string
  phone: string
  tag: string
  address: string
  isDefault: boolean
}

type MockDemand = {
  id: number
  title: string
  status: string
  count: string
  date: string
  createdAt: string
}

const SALES_MENU_ITEM: MenuItem = {
  key: 'sales-workbench',
  label: '业务员工作台',
  icon: ServiceOutlined,
  route: ROUTES.sales
}

const PENDING_ORDER_STATUSES = ['SUBMITTED', 'CONFIRMED', 'PAY_PENDING', 'PAID', 'PAY_FAILED']

type OrderBadges = Partial<Record<'pending' | 'shipped' | 'delivered' | 'returns', string>>

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: 1, sender: 'agent', text: '您好！我是您的专属客户经理。今天有什么可以帮您的吗？', time: '09:41' },
  { id: 2, sender: 'user', text: '我想咨询一下最近那批电子元件订单的批量价格。', time: '09:42' },
  {
    id: 3,
    sender: 'agent',
    text: '好的，没问题。请问您是指哪个订单或者哪款产品？您可以直接发送链接给我。',
    time: '09:42',
    hasActions: true
  }
]

const INITIAL_ORDERS_DATA: MockOrder[] = [
  {
    id: 'ORD-20240520-99',
    status: '待收货',
    date: '2024-05-20 14:30',
    totalPrice: 2580,
    items: [
      {
        name: '人体工学办公椅 - 旗舰版',
        specs: '黑色 / 尼龙脚',
        price: 1290,
        count: 2,
        image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=100&h=100'
      }
    ],
    tracking: {
      latest: '[上海市] 派送中：快递员小王正在为您派送',
      time: '10分钟前'
    }
  }
]

const INITIAL_ADDRESSES_DATA: MockAddress[] = [
  {
    id: 1,
    name: '王小明',
    phone: '13812348888',
    tag: '默认',
    address: '上海市 浦东新区 世纪大道100号 上海环球金融中心 71层',
    isDefault: true
  },
  {
    id: 2,
    name: '李华',
    phone: '13900009999',
    tag: '',
    address: '北京市 朝阳区 建国路87号 SKP办公楼 15层',
    isDefault: false
  }
]

const INITIAL_DEMANDS_DATA: MockDemand[] = [
  {
    id: 1,
    title: '需要定制一批办公椅，带人体工学设计',
    status: '处理中',
    count: '500把',
    date: '2024-06-15',
    createdAt: '2024-05-20'
  },
  {
    id: 2,
    title: '寻源高性价比的A4打印纸',
    status: '已报价',
    count: '10000箱',
    date: '2024-05-30',
    createdAt: '2024-05-18'
  }
]

const toOrderBadge = (count: number): string | undefined => {
  if (!Number.isFinite(count) || count <= 0) {
    return undefined
  }
  return String(Math.floor(count))
}

type BadgeProps = {
  count?: string
}

function Badge({ count }: BadgeProps) {
  if (!count) {
    return null
  }

  return (
    <View className='mine-modern-badge'>
      <Text className='text-10 font-bold text-white'>{count}</Text>
    </View>
  )
}

function OrderTrackItem({ icon: Icon, label, badge, onClick }: OrderItem) {
  return (
    <View className='group flex flex-col items-center gap-2 text-center' onClick={onClick}>
      <View className='mine-modern-order-icon relative flex h-12 w-12 items-center justify-center rounded-2xl'>
        <Icon className='text-lg mine-modern-muted' />
        <Badge count={badge} />
      </View>
      <Text className='text-xs font-semibold mine-modern-muted leading-tight whitespace-nowrap'>{label}</Text>
    </View>
  )
}

type MenuLinkProps = {
  icon: IconComponent
  label: string
  showDivider: boolean
  onClick: () => void
}

function MenuLink({ icon: Icon, label, showDivider, onClick }: MenuLinkProps) {
  return (
    <View
      onClick={onClick}
      className={`mine-modern-menu-row flex items-center justify-between px-4 py-5 ${showDivider ? 'border-b mine-modern-border' : ''}`}
    >
      <View className='flex items-center gap-3'>
        <View className='mine-modern-menu-icon flex h-10 w-10 items-center justify-center rounded-xl'>
          <Icon className='text-lg mine-modern-subtle' />
        </View>
        <Text className='text-base font-semibold mine-modern-text'>{label}</Text>
      </View>
      <ArrowRight className='text-base mine-modern-subtle' />
    </View>
  )
}

type SubviewHeaderProps = {
  title: string
  onBack: () => void
}

function SubviewHeader({ title, onBack }: SubviewHeaderProps) {
  return (
    <View className='mine-modern-subview-header sticky top-0 z-20 flex items-center justify-between px-4 py-3'>
      <View className='mine-modern-icon-btn flex h-9 w-9 items-center justify-center rounded-full' onClick={onBack}>
        <ArrowLeft className='text-lg mine-modern-text' />
      </View>
      <Text className='text-base font-bold mine-modern-text'>{title}</Text>
      <View className='mine-modern-icon-btn flex h-9 w-9 items-center justify-center rounded-full'>
        <MoreOutlined className='text-base mine-modern-subtle' />
      </View>
    </View>
  )
}

type ChatViewProps = {
  messages: ChatMessage[]
  isTyping: boolean
  inputValue: string
  onInput: (value: string) => void
  onSend: () => void
  onBack: () => void
}

function ChatView({ messages, isTyping, inputValue, onInput, onSend, onBack }: ChatViewProps) {
  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='联系经理' onBack={onBack} />

      <View className='mine-modern-chat-list mine-modern-subview-scroll no-scrollbar'>
        {messages.map((msg) => (
          <View key={msg.id} className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <View className={msg.sender === 'user' ? 'mine-modern-chat-bubble-user' : 'mine-modern-chat-bubble-agent'}>
              <Text className={`text-sm ${msg.sender === 'user' ? 'text-white' : 'mine-modern-text'}`}>{msg.text}</Text>
              {msg.hasActions ? (
                <View className='mt-2 flex gap-2'>
                  <View className='mine-modern-chip'>
                    <Text className='text-10 font-bold mine-modern-primary'>发送订单</Text>
                  </View>
                  <View className='mine-modern-chip'>
                    <Text className='text-10 font-bold mine-modern-primary'>发送产品</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ))}

        {isTyping ? (
          <View className='mine-modern-chat-typing px-1'>
            <Text className='text-10 mine-modern-subtle'>对方正在输入...</Text>
          </View>
        ) : null}
      </View>

      <View className='mine-modern-chat-input-panel px-5 py-3'>
        <View className='mine-modern-chat-input-wrap flex items-center gap-2'>
          <View className='mine-modern-icon-btn flex h-9 w-9 items-center justify-center rounded-full'>
            <AddOutlined className='text-base mine-modern-muted' />
          </View>
          <Input
            value={inputValue}
            onInput={(event: { detail: { value: string } }) => onInput(event.detail.value)}
            onConfirm={onSend}
            className='mine-modern-chat-input h-10 flex-1 rounded-xl px-3 text-sm'
            placeholder='请输入...'
            confirmType='send'
          />
          <View className='mine-modern-chat-send-btn flex h-10 w-10 items-center justify-center rounded-xl' onClick={onSend}>
            <ChatOutlined className='text-base text-white' />
          </View>
        </View>
      </View>
    </View>
  )
}

type AddressViewProps = {
  addresses: MockAddress[]
  onBack: () => void
}

function AddressView({ addresses, onBack }: AddressViewProps) {
  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='收货地址' onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        {addresses.map((addr) => (
          <View key={addr.id} className='mine-modern-card mb-3 rounded-2xl p-4'>
            <View className='mb-2 flex items-center justify-between'>
              <Text className='text-sm font-bold mine-modern-text'>{addr.name} {addr.phone}</Text>
              {addr.isDefault ? (
                <View className='mine-modern-chip-active'>
                  <Text className='text-10 font-bold mine-modern-primary'>默认</Text>
                </View>
              ) : null}
            </View>
            <Text className='text-sm mine-modern-muted'>{addr.address}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

type DemandViewProps = {
  demands: MockDemand[]
  onBack: () => void
}

function DemandView({ demands, onBack }: DemandViewProps) {
  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='我的需求' onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        {demands.map((demand) => (
          <View key={demand.id} className='mine-modern-card mb-3 rounded-2xl p-4'>
            <View className='mb-2 flex items-start justify-between gap-2'>
              <Text className='flex-1 text-sm font-bold mine-modern-text'>{demand.title}</Text>
              <Text className='text-10 font-bold mine-modern-primary'>{demand.status}</Text>
            </View>
            <Text className='text-xs mine-modern-subtle'>数量: {demand.count} | 交期: {demand.date}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

type OrderViewProps = {
  orders: MockOrder[]
  initialTab: string
  onBack: () => void
}

function OrderManagementView({ orders, initialTab, onBack }: OrderViewProps) {
  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title={`订单列表 - ${initialTab}`} onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        {orders.map((order) => (
          <View key={order.id} className='mine-modern-card mb-3 rounded-2xl p-4'>
            <Text className='mb-2 block text-xs mine-modern-subtle'>单号: {order.id}</Text>
            {order.items.map((item, index) => (
              <View key={`${order.id}-${index}`} className='mb-2 flex gap-3'>
                <View className='mine-modern-order-thumb h-16 w-16 overflow-hidden rounded-lg'>
                  <Image src={item.image} mode='aspectFill' className='h-full w-full' />
                </View>
                <View className='flex-1 min-w-0'>
                  <Text className='block truncate text-sm font-bold mine-modern-text'>{item.name}</Text>
                  <Text className='mt-1 block text-xs mine-modern-subtle'>{item.specs}</Text>
                  <Text className='mt-1 block text-xs mine-modern-muted'>￥{item.price.toFixed(2)} × {item.count}</Text>
                </View>
              </View>
            ))}
            <Text className='mt-2 block text-xs mine-modern-subtle'>{order.tracking.latest}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

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
    const token = await gatewayServices.tokens.getToken()
    if (!token && runtimeEnv.isIsolatedMock) {
      return
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
  const displayName = bootstrap?.me?.displayName ?? '王小明'
  const ownerSalesDisplayName = bootstrap?.me?.ownerSalesDisplayName?.trim() || '李经理 (专属顾问)'

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
    () => [
      SALES_MENU_ITEM,
      { key: 'demand', label: '我的需求', icon: Description, action: () => setCurrentPage('demand') },
      { key: 'favorites', label: '我的收藏', icon: StarOutlined, route: ROUTES.favorites },
      { key: 'address', label: '收货地址', icon: LocationOutlined, action: () => setCurrentPage('address') },
      { key: 'import', label: 'Excel 批量导入', icon: AppsOutlined, route: ROUTES.import },
      {
        key: 'tracking',
        label: '物流追踪',
        icon: BarChartOutlined,
        action: () => {
          setInitialOrderTab('待收货')
          setCurrentPage('orders')
        }
      },
      { key: 'settings', label: '系统设置', icon: SettingOutlined, route: ROUTES.settings }
    ],
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
        <View className='mine-modern-main'>
          <View className='mine-modern-main-content'>
            <View className='mine-modern-profile-card mb-4 flex items-center gap-4 px-5 py-6'>
              <View className='mine-modern-avatar-wrap h-16 w-16 overflow-hidden rounded-full'>
                <Image src={avatarFallback} mode='aspectFill' className='h-full w-full' />
              </View>
              <View className='min-w-0 flex-1'>
                <View className='flex items-center gap-1.5'>
                  <Text className='truncate text-2xl font-bold mine-modern-text'>{displayName}</Text>
                  <ShieldOutlined className='text-lg text-green-500' />
                </View>
                <Text className='mt-1 block text-base font-medium mine-modern-subtle'>高级 B2B 客户经理</Text>
                <Text className='mt-1 block text-sm mine-modern-muted'>{ownerSalesDisplayName} · 已绑定专属渠道</Text>
              </View>
            </View>

            <View className='mine-modern-section-head mb-2 mt-1 flex items-center justify-between'>
              <Text className='text-base font-bold mine-modern-text'>订单跟踪</Text>
              <Text
                className='text-xs font-semibold mine-modern-subtle'
                onClick={() => {
                  setInitialOrderTab('全部')
                  setCurrentPage('orders')
                }}
              >
                查看全部
              </Text>
            </View>

            <View className='mine-modern-surface mb-4 rounded-3xl p-5'>
              <View className='grid grid-cols-4 gap-4'>
                {orderItems.map((item) => (
                  <OrderTrackItem key={item.key} icon={item.icon} label={item.label} badge={item.badge} onClick={item.onClick} />
                ))}
              </View>
            </View>

            <View className='mine-modern-surface mb-4 overflow-hidden rounded-3xl'>
              <View
                onClick={() => setCurrentPage('chat')}
                className='mine-modern-menu-row flex items-center justify-between px-4 py-5 border-b mine-modern-border'
              >
                <View className='flex items-center gap-3'>
                  <View className='mine-modern-menu-icon flex h-10 w-10 items-center justify-center rounded-xl'>
                    <ChatOutlined className='text-lg mine-modern-subtle' />
                  </View>
                  <View className='flex flex-col'>
                    <Text className='text-base font-semibold mine-modern-text'>专属客户经理</Text>
                    <Text className='text-xs mine-modern-subtle'>在线咨询</Text>
                  </View>
                </View>
                <View className='flex items-center gap-2'>
                  <View className='mine-modern-online-dot h-1.5 w-1.5 rounded-full'></View>
                  <ArrowRight className='text-base mine-modern-subtle' />
                </View>
              </View>
              {menuItems.map((item, index) => (
                <MenuLink
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  onClick={() => {
                    if (typeof item.action === 'function') {
                      item.action()
                      return
                    }
                    if (item.route) {
                      navigateTo(item.route)
                    }
                  }}
                  showDivider={index < menuItems.length - 1}
                />
              ))}
            </View>

          <View className='mt-4'>
            <NativeButton
              className='mine-modern-logout-btn flex w-full items-center justify-center gap-2 rounded-2xl border py-4 mine-modern-border'
              onClick={isLoggedIn ? handleLogout : () => navigateTo(ROUTES.authLogin)}
              disabled={loggingOut}
            >
              <Revoke className='text-lg mine-modern-muted' />
              <Text className='text-base font-bold mine-modern-muted'>切换账号或退出登录</Text>
            </NativeButton>
            <Text className='mine-modern-version mt-6 block text-center text-10 font-medium uppercase tracking-widest'>
              B2B Portal v2.4.0
            </Text>
          </View>
        </View>
      </View>
      ) : null}
    </View>
  )
}
