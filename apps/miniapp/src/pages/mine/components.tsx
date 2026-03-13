import { Button as NativeButton, Image, Input, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import {
  AddOutlined,
  AppsOutlined,
  ArrowLeft,
  ArrowRight,
  ChatOutlined,
  Description,
  Exchange,
  Logistics,
  MoreOutlined,
  RecordsOutlined,
  Revoke,
  SettingOutlined,
  ShieldOutlined
} from '@taroify/icons'
import { orderTrackingRoute } from '../../routes'
import { navigateTo } from '../../utils/navigation'
import type {
  IconComponent,
  MenuItem,
  MockAddress,
  MockDemand,
  MockOrder,
  OrderItem
} from './types'

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
    <View className='mine-hero-order-item flex flex-col items-center gap-2 text-center' onClick={onClick}>
      <View className='mine-hero-order-icon mine-modern-order-icon relative flex h-11 w-11 items-center justify-center rounded-full'>
        <Icon className='text-lg mine-hero-order-glyph' />
        <Badge count={badge} />
      </View>
      <Text className='mine-hero-order-label text-11 font-medium leading-tight whitespace-nowrap'>{label}</Text>
    </View>
  )
}

const MENU_ACCENT_CLASS_MAP: Record<string, { tile: string; icon: string }> = {
  demand: { tile: 'mine-menu-accent--indigo', icon: 'mine-menu-icon--indigo' },
  favorites: { tile: 'mine-menu-accent--rose', icon: 'mine-menu-icon--rose' },
  address: { tile: 'mine-menu-accent--sky', icon: 'mine-menu-icon--sky' },
  support: { tile: 'mine-menu-accent--amber', icon: 'mine-menu-icon--amber' },
  tracking: { tile: 'mine-menu-accent--emerald', icon: 'mine-menu-icon--emerald' },
  import: { tile: 'mine-menu-accent--violet', icon: 'mine-menu-icon--violet' },
  settings: { tile: 'mine-menu-accent--slate', icon: 'mine-menu-icon--slate' }
}

type MenuLinkProps = {
  item: MenuItem
  compact?: boolean
  titleOverride?: string
  descriptionOverride?: string
  icon: IconComponent
  label: string
  onClick: () => void
}

function MenuLink({ item, compact = false, titleOverride, descriptionOverride, icon: Icon, label, onClick }: MenuLinkProps) {
  const accent = MENU_ACCENT_CLASS_MAP[item.key] ?? MENU_ACCENT_CLASS_MAP.settings
  const title = titleOverride ?? label
  const description = descriptionOverride ?? item.description
  return (
    <View
      onClick={onClick}
      className={`mine-menu-card ${compact ? 'mine-menu-card--compact' : ''} ${accent.tile} flex items-center justify-between`}
    >
      <View className='flex items-center gap-3'>
        <View className={`mine-menu-card-icon ${accent.icon} flex h-8 w-8 items-center justify-center rounded-full`}>
          <Icon className='text-base mine-menu-card-glyph' />
        </View>
        <View className='flex flex-col'>
          <Text className='text-sm font-semibold mine-menu-card-title'>{title}</Text>
          {description ? <Text className='text-xs mine-menu-card-copy'>{description}</Text> : null}
        </View>
      </View>
      <ArrowRight className='text-base mine-menu-card-chevron' />
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

type ChatMessage = {
  id: string
  sender: 'user' | 'agent'
  text: string
  hasActions?: boolean
}

type ChatViewProps = {
  messages: ChatMessage[]
  isTyping: boolean
  inputValue: string
  inputFocusKey: number
  onInput: (value: string) => void
  onSend: () => void
  onBack: () => void
}

export function ChatView({ messages, isTyping, inputValue, inputFocusKey, onInput, onSend, onBack }: ChatViewProps) {
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
            key={`chat-input-${inputFocusKey}`}
            value={inputValue}
            onInput={(event: { detail: { value: string } }) => onInput(event.detail.value)}
            onConfirm={onSend}
            className='mine-modern-chat-input h-10 flex-1 rounded-xl px-3 text-sm'
            placeholder='请输入...'
            autoFocus
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

export function AddressView({ addresses, onBack }: AddressViewProps) {
  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='收货地址' onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        {addresses.map((addr) => (
          <View key={addr.id} className='mine-modern-card mb-3 rounded-2xl p-4'>
            <View className='mb-2 flex items-center justify-between'>
              <Text className='text-sm font-bold mine-modern-text'>
                {addr.name} {addr.phone}
              </Text>
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

export function DemandView({ demands, onBack }: DemandViewProps) {
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

type OrderManagementViewProps = {
  orders: MockOrder[]
  initialTab: string
  onBack: () => void
}

export function OrderManagementView({ orders, initialTab, onBack }: OrderManagementViewProps) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const orderTabs = ['全部', '待处理', '已发货', '已送达', '退换货']
  const filteredOrders = useMemo(() => {
    if (activeTab === '全部') {
      return orders
    }
    if (activeTab === '待处理') {
      return orders.filter((order) => order.status === '待处理' || order.status === '待收货')
    }
    return orders.filter((order) => order.status === activeTab)
  }, [activeTab, orders])

  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='订单列表' onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        <View className='mine-order-tabs mb-4'>
          {orderTabs.map((tab) => (
            <View
              key={tab}
              className={`mine-order-tab ${activeTab === tab ? 'mine-order-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <Text className={`mine-order-tab-text ${activeTab === tab ? 'mine-order-tab-text--active' : ''}`}>{tab}</Text>
            </View>
          ))}
        </View>

        {filteredOrders.length > 0 ? filteredOrders.map((order) => (
          <View
            key={order.id}
            className='mine-order-card mb-3 rounded-3xl p-4'
            data-testid={`mine-order-card-${order.id}`}
            onClick={() => navigateTo(orderTrackingRoute(order.id))}
          >
            <View className='mb-3 flex items-start justify-between gap-3'>
              <View className='min-w-0 flex-1'>
                <Text className='mine-order-id block text-sm font-bold'>{order.id}</Text>
                <Text className='mine-order-date mt-1 block text-xs'>{order.date}</Text>
              </View>
              <View className='mine-order-status'>
                <Text className='mine-order-status-text'>{order.status}</Text>
              </View>
            </View>
            {order.items.map((item, index) => (
              <View key={`${order.id}-${index}`} className='mine-order-row mb-3 flex gap-3'>
                <View className='mine-modern-order-thumb mine-order-thumb h-16 w-16 overflow-hidden rounded-2xl'>
                  <Image src={item.image} mode='aspectFill' className='h-full w-full' />
                </View>
                <View className='min-w-0 flex-1'>
                  <Text className='mine-order-name block truncate text-sm font-bold'>{item.name}</Text>
                  <Text className='mine-order-spec mt-1 block text-xs'>{item.specs}</Text>
                  <Text className='mine-order-price mt-2 block text-xs'>
                    ￥{item.price.toFixed(2)} × {item.count}
                  </Text>
                </View>
              </View>
            ))}
            <View className='mine-order-footer mt-2 flex items-end justify-between gap-3'>
              <View className='min-w-0 flex-1'>
                <Text className='mine-order-track-label block text-xs'>物流进度</Text>
                <Text className='mine-order-track mt-1 block text-xs'>{order.tracking.latest}</Text>
              </View>
              <View className='text-right'>
                <Text className='mine-order-total-label block text-xs'>订单金额</Text>
                <Text className='mine-order-total mt-1 block text-base font-bold'>￥{order.totalPrice.toFixed(2)}</Text>
                <Text className='block mt-2 text-xs mine-modern-primary'>点击查看物流</Text>
              </View>
            </View>
          </View>
        )) : (
          <View className='mine-order-empty rounded-3xl p-6 text-center'>
            <RecordsOutlined className='mine-order-empty-icon text-2xl' />
            <Text className='mine-order-empty-title mt-3 block text-sm font-semibold'>当前状态下暂无订单</Text>
            <Text className='mine-order-empty-copy mt-1 block text-xs'>切换其他状态或返回首页继续浏览商品</Text>
          </View>
        )}
      </View>
    </View>
  )
}

type MineProfileViewProps = {
  avatarFallback: string
  advisorFollowUpCopy: string
  displayName: string
  isLoggedIn: boolean
  roleLabel: string
  ownerSalesDisplayName: string
  orderItems: OrderItem[]
  menuItems: MenuItem[]
  loggingOut: boolean
  debugRoleChoices: string[]
  currentRole: string
  switchingRole: string | null
  onOpenOrders: (tab: string) => void
  onOpenChat: () => void
  onMenuItemClick: (item: MenuItem) => void
  onAuthAction: () => void
  onOpenAuth: () => void
  onSwitchRole: (role: string) => void
}

function MineHeroDecoration({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <View className='mine-hero-visual'>
      <View className='mine-hero-orbit mine-hero-orbit--outer'></View>
      <View className='mine-hero-orbit mine-hero-orbit--inner'></View>
      <View className='mine-hero-center'>
        {isLoggedIn ? <ShieldOutlined className='mine-hero-symbol mine-hero-symbol--filled' /> : <AppsOutlined className='mine-hero-symbol' />}
      </View>
      <View className='mine-hero-float mine-hero-float--top'>
        <Description className='mine-hero-float-icon' />
      </View>
      <View className='mine-hero-float mine-hero-float--bottom'>
        {isLoggedIn ? <Logistics className='mine-hero-float-icon' /> : <Exchange className='mine-hero-float-icon' />}
      </View>
    </View>
  )
}

export function MineProfileView({
  avatarFallback,
  advisorFollowUpCopy,
  displayName,
  isLoggedIn,
  roleLabel,
  ownerSalesDisplayName,
  orderItems,
  menuItems,
  loggingOut,
  debugRoleChoices,
  currentRole,
  switchingRole,
  onOpenOrders,
  onOpenChat,
  onMenuItemClick,
  onAuthAction,
  onOpenAuth,
  onSwitchRole
}: MineProfileViewProps) {
  const settingsItem = menuItems.find((item) => item.key === 'settings')
  const supportItem = menuItems.find((item) => item.key === 'support')
  const priorityMenuItems = menuItems.filter((item) => ['demand', 'favorites', 'support'].includes(item.key))
  const extendedMenuItems = menuItems.filter((item) => !['demand', 'favorites', 'support'].includes(item.key))
  const guestHeroTitle = '开启您的专属购物之旅'
  const guestHeroCopy = '登录后即可享受个性化推荐、专属会员权益及实时物流追踪'
  const heroTitle = isLoggedIn ? displayName : guestHeroTitle
  const heroCopy = isLoggedIn ? `${roleLabel} · ${ownerSalesDisplayName} · 已绑定专属渠道` : guestHeroCopy
  const heroCtaLabel = isLoggedIn ? '立即沟通' : '立即登录 / 注册'
  const heroMetaItems = isLoggedIn
    ? ['专属顾问在线', '订单动态同步', '收藏与地址云端保存']
    : ['独家优惠', '订单同步', '收藏同步']

  const handleHeroCta = () => {
    if (isLoggedIn) {
      onOpenChat()
      return
    }
    onOpenAuth()
  }

  return (
    <View className='mine-modern-main mine-dashboard-main'>
      <View className='mine-modern-main-content mine-dashboard-content'>
        <View className='mine-dashboard-topbar'>
          <View
            className='mine-dashboard-action flex h-10 w-10 items-center justify-center rounded-full'
            onClick={settingsItem ? () => onMenuItemClick(settingsItem) : undefined}
          >
            <SettingOutlined className='text-lg mine-dashboard-action-icon' />
          </View>
          <Text className='mine-dashboard-title text-base font-bold'>我的</Text>
          <View
            className='mine-dashboard-action flex h-10 w-10 items-center justify-center rounded-full'
            onClick={isLoggedIn ? onOpenChat : onOpenAuth}
          >
            <ChatOutlined className='text-lg mine-dashboard-action-icon' />
          </View>
        </View>

        <View className='mine-hero-card'>
          <MineHeroDecoration isLoggedIn={isLoggedIn} />

          {isLoggedIn ? (
            <View className='mine-hero-profile flex items-center gap-3'>
              <View className='mine-hero-avatar-shell flex h-11 w-11 items-center justify-center rounded-full'>
                <View className='mine-modern-avatar-wrap mine-hero-avatar-wrap h-11 w-11 overflow-hidden rounded-full'>
                  <Image src={avatarFallback} mode='aspectFill' className='h-full w-full' />
                </View>
              </View>
              <View className='min-w-0 flex-1'>
                <Text className='mine-hero-eyebrow block text-xs font-semibold'>欢迎回来</Text>
                <Text className='mine-hero-title block truncate text-xl font-bold'>{heroTitle}</Text>
                <View className='mt-1 flex items-center gap-1.5'>
                  <ShieldOutlined className='text-base mine-hero-role-icon' />
                  <Text className='mine-hero-copy text-sm'>{roleLabel}</Text>
                </View>
              </View>
            </View>
          ) : null}

          <Text className='mine-hero-headline block text-center text-xl font-bold'>{heroTitle}</Text>
          <Text className='mine-hero-supporting block text-center text-sm'>{heroCopy}</Text>

          <NativeButton className='mine-hero-cta mt-6 flex w-full items-center justify-center rounded-2xl' onClick={handleHeroCta}>
            <Text className='text-base font-bold text-white'>{heroCtaLabel}</Text>
          </NativeButton>

          <View className='mine-hero-meta mt-5 flex items-center justify-center'>
            {heroMetaItems.map((item) => (
              <View key={item} className='mine-hero-meta-chip flex items-center gap-1.5'>
                <View className='mine-hero-meta-dot'></View>
                <Text className='text-10 mine-hero-meta-text'>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='mine-hero-summary-card' onClick={() => onOpenOrders('全部')}>
          <View className='flex items-center justify-between gap-3'>
            <View className='flex min-w-0 flex-1 items-center gap-3'>
              <View className='mine-hero-summary-icon flex h-10 w-10 items-center justify-center rounded-full'>
                <Logistics className='text-lg mine-dashboard-primary-icon' />
              </View>
              <View className='min-w-0 flex-1'>
                <Text className='mine-hero-summary-title block text-sm font-bold'>追踪您的包裹</Text>
                <Text className='mine-hero-summary-copy block text-xs'>
                  {isLoggedIn ? '登录订单实时同步，点击查看所有配送动态' : '登录后实时查看所有订单动态'}
                </Text>
              </View>
            </View>
            <View className='mine-hero-summary-action'>
              <Text className='text-xs font-bold mine-dashboard-primary-text'>去查看</Text>
            </View>
          </View>
        </View>

        {isLoggedIn ? (
          <View className='mine-dashboard-order-panel'>
            <View className='mine-dashboard-section-head flex items-center justify-between'>
              <Text className='mine-dashboard-section-title text-base font-bold'>订单跟踪</Text>
              <Text className='mine-dashboard-section-link text-sm font-medium' onClick={() => onOpenOrders('全部')}>
                查看全部
              </Text>
            </View>
            <View className='mine-dashboard-order-grid'>
              {orderItems.map((item) => (
                <OrderTrackItem key={item.key} icon={item.icon} label={item.label} badge={item.badge} onClick={item.onClick} />
              ))}
            </View>
          </View>
        ) : null}

        {isLoggedIn ? (
          <View className='mine-dashboard-advisor-card' onClick={onOpenChat}>
            <View className='flex items-start justify-between gap-4'>
              <View className='min-w-0 flex-1'>
                <Text className='mine-dashboard-card-eyebrow block text-xs font-semibold uppercase tracking-widest'>专属顾问</Text>
                <Text className='mine-dashboard-card-title mt-2 block text-base font-bold'>{ownerSalesDisplayName}</Text>
                <Text className='mine-dashboard-card-copy mt-1 block text-sm'>{advisorFollowUpCopy}</Text>
              </View>
              <View className='flex items-center gap-2'>
                <View className='mine-modern-online-dot h-1.5 w-1.5 rounded-full'></View>
                <Text className='text-xs font-semibold mine-dashboard-primary-text'>立即沟通</Text>
              </View>
            </View>
          </View>
        ) : null}

        {isLoggedIn && debugRoleChoices.length > 1 ? (
          <View className='mine-dashboard-debug-card'>
            <Text className='mine-dashboard-card-eyebrow block text-xs font-semibold uppercase tracking-widest'>调试角色</Text>
            <Text className='mine-dashboard-card-copy mt-2 block text-sm'>
              当前身份 {currentRole || roleLabel}，可快速切换当前会话角色。
            </Text>
            <View className='mt-3 flex flex-wrap gap-2'>
              {debugRoleChoices.map((role) => {
                const active = role === currentRole
                return (
                  <NativeButton
                    key={role}
                    className={`mine-dashboard-role-chip rounded-full border px-4 py-2 text-xs ${active ? 'mine-dashboard-role-chip--active' : ''}`}
                    disabled={Boolean(switchingRole)}
                    onClick={() => onSwitchRole(role)}
                  >
                    <Text className='text-xs font-bold'>{switchingRole === role ? '切换中...' : role}</Text>
                  </NativeButton>
                )
              })}
            </View>
          </View>
        ) : null}

        <View className='mine-dashboard-discovery'>
          <Text className='mine-dashboard-discovery-title block text-xs font-bold uppercase'>发现更多</Text>
          <View className='mine-dashboard-discovery-list'>
            {priorityMenuItems.map((item) => (
              <MenuLink
                key={item.key}
                item={item}
                icon={item.icon}
                label={item.label}
                onClick={() => onMenuItemClick(item)}
              />
            ))}
          </View>
        </View>

        <View className='mine-dashboard-secondary-list'>
          {supportItem && isLoggedIn ? (
            <MenuLink
              item={supportItem}
              compact
              titleOverride='专属客户经理'
              descriptionOverride='在线咨询'
              icon={ChatOutlined}
              label='专属客户经理'
              onClick={onOpenChat}
            />
          ) : null}
          {extendedMenuItems.map((item) => (
            <MenuLink
              key={item.key}
              item={item}
              compact
              icon={item.icon}
              label={item.label}
              onClick={() => onMenuItemClick(item)}
            />
          ))}
        </View>

        {isLoggedIn ? (
          <View className='mt-4'>
            <NativeButton
              id='mine-logout-btn'
              className='mine-dashboard-logout-btn flex w-full items-center justify-center gap-2 rounded-2xl border py-3'
              onClick={onAuthAction}
              disabled={loggingOut}
            >
              <Revoke className='text-lg mine-dashboard-logout-icon' />
              <Text className='text-sm font-bold mine-dashboard-logout-text'>切换账号或退出登录</Text>
            </NativeButton>
            <Text className='mine-modern-version mt-5 block text-center text-10 font-medium uppercase tracking-widest'>
              B2B Portal v2.4.0
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
