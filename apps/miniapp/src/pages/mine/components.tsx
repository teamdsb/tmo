import { Button as NativeButton, Image, Input, Text, Textarea, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import {
  AddOutlined,
  AppsOutlined,
  ArrowLeft,
  ArrowRight,
  ChatOutlined,
  Description,
  Exchange,
  MoreOutlined,
  RecordsOutlined,
  Revoke
} from '@taroify/icons'
import type { CreateProductRequest, ProductRequest } from '@tmo/api-client'
import { orderTrackingRoute } from '../../routes'
import { navigateTo } from '../../utils/navigation'
import type {
  IconComponent,
  MenuItem,
  MockAddress,
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
  demands: ProductRequest[]
  onBack: () => void
  onCreateDemand: (payload: CreateProductRequest) => Promise<void>
}

const formatDemandDate = (value?: string) => {
  if (!value) {
    return '刚刚创建'
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Date(timestamp).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  })
}

export function DemandView({ demands, onBack, onCreateDemand }: DemandViewProps) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const closeComposer = () => {
    if (submitting) {
      return
    }
    setComposerOpen(false)
  }

  const resetComposer = () => {
    setName('')
    setQty('')
    setNote('')
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedQty = qty.trim()
    const trimmedNote = note.trim()

    if (!trimmedName) {
      await Taro.showToast({ title: '请输入产品名称', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      await onCreateDemand({
        name: trimmedName,
        qty: trimmedQty || undefined,
        note: trimmedNote || undefined
      })
      resetComposer()
      setComposerOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='mine-modern-subview'>
      <SubviewHeader title='我的需求' onBack={onBack} />
      <View className='mine-modern-subview-scroll no-scrollbar'>
        <View className='mine-demand-toolbar mb-4 flex items-center justify-between gap-3'>
          <View className='min-w-0 flex-1'>
            <Text className='mine-demand-toolbar-title block text-base font-bold mine-modern-text'>需求池</Text>
            <Text className='mine-demand-toolbar-copy mt-1 block text-xs mine-modern-subtle'>
              缺规格、缺 SKU 或需代采时，可直接在这里补充新需求。
            </Text>
          </View>
          <NativeButton
            className='mine-demand-create-btn flex items-center justify-center rounded-full'
            onClick={() => setComposerOpen(true)}
          >
            <Text className='text-sm font-bold text-white'>新增需求</Text>
          </NativeButton>
        </View>

        {demands.length > 0 ? demands.map((demand) => (
          <View key={demand.id} className='mine-modern-card mine-demand-card mb-3 rounded-2xl p-4'>
            <View className='mb-2 flex items-start justify-between gap-3'>
              <View className='min-w-0 flex-1'>
                <Text className='block text-sm font-bold mine-modern-text'>{demand.name}</Text>
                <Text className='mt-1 block text-xs mine-modern-subtle'>创建于 {formatDemandDate(demand.createdAt)}</Text>
              </View>
              <View className='mine-demand-status-pill'>
                <Text className='text-10 font-bold mine-modern-primary'>已提交</Text>
              </View>
            </View>
            <Text className='text-xs mine-modern-subtle'>数量: {demand.qty?.trim() || '待确认'}</Text>
            {demand.note?.trim() ? (
              <Text className='mine-demand-note mt-2 block text-xs mine-modern-muted'>{demand.note.trim()}</Text>
            ) : null}
          </View>
        )) : (
          <View className='mine-demand-empty rounded-3xl p-6 text-center'>
            <Description className='mine-demand-empty-icon text-2xl' />
            <Text className='mine-demand-empty-title mt-3 block text-sm font-semibold'>还没有需求记录</Text>
            <Text className='mine-demand-empty-copy mt-1 block text-xs'>点击右上角新增需求，先把要找的商品告诉我们。</Text>
          </View>
        )}
      </View>

      {composerOpen ? (
        <View className='mine-demand-popup' onClick={closeComposer}>
          <View className='mine-demand-popup-panel' onClick={(event) => event.stopPropagation()}>
            <View className='mine-demand-popup-handle'></View>
            <View className='mine-demand-popup-head flex items-start justify-between gap-4'>
              <View className='min-w-0 flex-1'>
                <Text className='block text-lg font-bold mine-modern-text'>新增需求</Text>
                <Text className='mine-demand-popup-copy mt-2 block text-sm mine-modern-subtle'>
                  先填写核心信息，后续由顾问继续补齐规格、图片和交期。
                </Text>
              </View>
              <View className='mine-demand-popup-badge'>
                <Text className='text-10 font-bold mine-modern-primary'>速填</Text>
              </View>
            </View>

            <View className='mine-demand-form mt-5 flex flex-col gap-3'>
              <View className='mine-demand-field'>
                <Text className='mine-demand-field-label mb-2 block text-xs font-semibold mine-modern-subtle'>产品名称</Text>
                <Input
                  value={name}
                  className='mine-demand-field-input'
                  placeholder='例如：工业级轴承 / 定制办公椅'
                  onInput={(event) => setName(event.detail.value)}
                />
              </View>

              <View className='mine-demand-field'>
                <Text className='mine-demand-field-label mb-2 block text-xs font-semibold mine-modern-subtle'>需求数量</Text>
                <Input
                  value={qty}
                  className='mine-demand-field-input'
                  placeholder='例如：200 件 / 10 箱'
                  onInput={(event) => setQty(event.detail.value)}
                />
              </View>

              <View className='mine-demand-field'>
                <Text className='mine-demand-field-label mb-2 block text-xs font-semibold mine-modern-subtle'>补充说明</Text>
                <Textarea
                  value={note}
                  className='mine-demand-field-textarea'
                  placeholder='补充规格、材质、品牌倾向或交期要求'
                  onInput={(event) => setNote(event.detail.value)}
                />
              </View>
            </View>

            <View className='mine-demand-popup-actions mt-5 flex gap-3'>
              <NativeButton className='mine-demand-secondary-btn flex-1 rounded-2xl' onClick={closeComposer}>
                <Text className='text-sm font-semibold mine-modern-muted'>取消</Text>
              </NativeButton>
              <NativeButton className='mine-demand-primary-btn flex-1 rounded-2xl' onClick={() => void handleSubmit()}>
                <Text className='text-sm font-bold text-white'>{submitting ? '提交中...' : '提交需求'}</Text>
              </NativeButton>
            </View>
          </View>
        </View>
      ) : null}
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
  onMenuItemClick: (item: MenuItem) => void
  onAuthAction: () => void
  onOpenAuth: () => void
  onSwitchRole: (role: string) => void
}

function MineHeroDecoration({
  isLoggedIn,
  avatarFallback,
  welcomeCopy
}: {
  isLoggedIn: boolean
  avatarFallback: string
  welcomeCopy: string
}) {
  return (
    <View className='mine-hero-visual'>
      {!isLoggedIn ? <View className='mine-hero-orbit mine-hero-orbit--outer'></View> : null}
      {!isLoggedIn ? <View className='mine-hero-orbit mine-hero-orbit--inner'></View> : null}
      <View className='mine-hero-center'>
        {isLoggedIn ? (
          <View className='mine-hero-user-center'>
            <View className='mine-hero-user-avatar'>
              <Image src={avatarFallback} mode='aspectFill' className='h-full w-full' />
            </View>
            <Text className='mine-hero-user-copy'>{welcomeCopy}</Text>
          </View>
        ) : (
          <AppsOutlined className='mine-hero-symbol' />
        )}
      </View>
      {!isLoggedIn ? (
        <View className='mine-hero-float mine-hero-float--top'>
          <Description className='mine-hero-float-icon' />
        </View>
      ) : null}
      {!isLoggedIn ? (
        <View className='mine-hero-float mine-hero-float--bottom'>
          <Exchange className='mine-hero-float-icon' />
        </View>
      ) : null}
    </View>
  )
}

export function MineProfileView({
  avatarFallback,
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
  onMenuItemClick,
  onAuthAction,
  onOpenAuth,
  onSwitchRole
}: MineProfileViewProps) {
  const settingsItem = menuItems.find((item) => item.key === 'settings')
  const priorityMenuItems = menuItems.filter((item) => ['demand', 'favorites', 'support'].includes(item.key))
  const extendedMenuItems = menuItems.filter((item) => !['demand', 'favorites', 'support'].includes(item.key))
  const guestMenuItems = menuItems.filter((item) => item.key === 'support' || item.key === 'settings')
  const guestHeroTitle = '开启您的专属购物之旅'
  const guestHeroCopy = '登录后即可享受个性化推荐、专属会员权益及实时物流追踪'
  const heroTitle = isLoggedIn ? displayName : guestHeroTitle
  const heroCopy = isLoggedIn ? `${roleLabel} · ${ownerSalesDisplayName} · 已绑定专属渠道` : guestHeroCopy
  const heroCtaLabel = isLoggedIn ? '管理账户' : '立即登录 / 注册'
  const heroMetaItems = isLoggedIn
    ? ['专属顾问在线', '订单动态同步', '收藏与地址云端保存']
    : ['独家优惠', '订单同步', '收藏同步']
  const heroWelcomeCopy = `欢迎回来，${displayName}用户`

  const handleHeroCta = () => {
    if (isLoggedIn) {
      if (settingsItem) {
        onMenuItemClick(settingsItem)
      }
      return
    }
    onOpenAuth()
  }

  return (
    <View className='mine-modern-main mine-dashboard-main'>
      <View className='mine-modern-main-content mine-dashboard-content'>
        <View className='mine-hero-card'>
          <MineHeroDecoration isLoggedIn={isLoggedIn} avatarFallback={avatarFallback} welcomeCopy={heroWelcomeCopy} />

          {!isLoggedIn ? <Text className='mine-hero-headline block text-center text-xl font-bold'>{heroTitle}</Text> : null}
          {!isLoggedIn ? <Text className='mine-hero-supporting block text-center text-sm'>{heroCopy}</Text> : null}

          <NativeButton className='mine-hero-cta mt-6 flex w-full items-center justify-center rounded-2xl' onClick={handleHeroCta}>
            <Text className='text-base font-bold text-white'>{heroCtaLabel}</Text>
          </NativeButton>

          {!isLoggedIn ? (
            <View className='mine-hero-meta mt-5 flex items-center justify-center'>
              {heroMetaItems.map((item) => (
                <View key={item} className='mine-hero-meta-chip flex items-center gap-1.5'>
                  <View className='mine-hero-meta-dot'></View>
                  <Text className='text-10 mine-hero-meta-text'>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {isLoggedIn ? (
            <View className='mine-hero-embedded-order-panel'>
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
        </View>

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

        {isLoggedIn ? (
          <>
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
          </>
        ) : (
          <View className='mine-dashboard-discovery'>
            <Text className='mine-dashboard-discovery-title block text-xs font-bold uppercase'>帮助与支持</Text>
            <View className='mine-dashboard-discovery-list'>
              {guestMenuItems.map((item) => (
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
        )}

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
