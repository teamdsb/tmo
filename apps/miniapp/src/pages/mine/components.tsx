import { Button as NativeButton, Image, Input, Text, View } from '@tarojs/components'
import {
  AddOutlined,
  ArrowLeft,
  ArrowRight,
  ChatOutlined,
  HomeOutlined,
  MoreOutlined,
  Revoke,
  ShieldOutlined
} from '@taroify/icons'
import UserOutlined from '@taroify/icons/UserOutlined'
import type {
  ChatMessage,
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
    <View className='mine-lite-order-item group flex flex-col items-center gap-2 text-center' onClick={onClick}>
      <View className='mine-lite-order-icon mine-modern-order-icon relative flex h-11 w-11 items-center justify-center rounded-full'>
        <Icon className='text-lg mine-lite-icon' />
        <Badge count={badge} />
      </View>
      <Text className='mine-lite-order-label text-11 font-medium leading-tight whitespace-nowrap'>{label}</Text>
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
      className={`mine-lite-menu-row flex items-center justify-between px-5 py-4 ${showDivider ? 'border-b mine-lite-divider' : ''}`}
    >
      <View className='flex items-center gap-3'>
        <View className='mine-lite-menu-icon flex h-8 w-8 items-center justify-center rounded-full'>
          <Icon className='text-base mine-lite-icon' />
        </View>
        <Text className='text-sm font-semibold mine-lite-text'>{label}</Text>
      </View>
      <ArrowRight className='text-base mine-lite-chevron' />
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

export function ChatView({ messages, isTyping, inputValue, onInput, onSend, onBack }: ChatViewProps) {
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
                  <Text className='mt-1 block text-xs mine-modern-muted'>
                    ￥{item.price.toFixed(2)} × {item.count}
                  </Text>
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
  onOpenOrders: (tab: string) => void
  onOpenChat: () => void
  onMenuItemClick: (item: MenuItem) => void
  onAuthAction: () => void
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
  onOpenOrders,
  onOpenChat,
  onMenuItemClick,
  onAuthAction
}: MineProfileViewProps) {
  return (
    <View className='mine-modern-main mine-lite-main'>
      <View className='mine-modern-main-content mine-lite-content'>
        <View className='mine-lite-entry flex items-center justify-start'>
          <View className='mine-lite-entry-icon flex h-7 w-7 items-center justify-center rounded-full'>
            <HomeOutlined className='text-sm mine-lite-icon' />
          </View>
        </View>

        <View className='mine-lite-profile flex items-center gap-3'>
          <View className='mine-lite-profile-icon flex h-10 w-10 items-center justify-center rounded-full'>
            {isLoggedIn ? (
              <View className='mine-modern-avatar-wrap mine-lite-avatar-wrap h-10 w-10 overflow-hidden rounded-full'>
                <Image src={avatarFallback} mode='aspectFill' className='h-full w-full' />
              </View>
            ) : (
              <UserOutlined className='text-lg mine-lite-icon' />
            )}
          </View>
          <View className='min-w-0 flex-1'>
            <View className='flex items-baseline gap-1'>
              <Text className='mine-lite-profile-name truncate text-xl font-bold'>
                {isLoggedIn ? displayName : '未登录'}
              </Text>
              {!isLoggedIn ? <Text className='mine-lite-profile-copy text-sm'>请先登录以查看账号信息</Text> : null}
            </View>
            {isLoggedIn ? (
              <View className='mt-1 flex items-center gap-1.5'>
                <ShieldOutlined className='text-base text-green-500' />
                <Text className='mine-lite-profile-copy text-sm'>
                  {roleLabel}
                </Text>
              </View>
            ) : null}
            {isLoggedIn ? (
              <Text className='mine-lite-profile-copy mt-1 block text-xs'>
                {ownerSalesDisplayName} · 已绑定专属渠道
              </Text>
            ) : null}
          </View>
        </View>

        {isLoggedIn ? (
          <View
            onClick={onOpenChat}
            className='mine-lite-panel mb-5 rounded-3xl px-5 py-4'
          >
            <View className='flex items-start justify-between gap-4'>
              <View className='min-w-0 flex-1'>
                <Text className='block text-xs font-semibold uppercase tracking-widest mine-lite-profile-copy'>
                  专属顾问
                </Text>
                <Text className='mt-2 block text-base font-bold mine-lite-text'>
                  {ownerSalesDisplayName}
                </Text>
                <Text className='mt-1 block text-sm mine-lite-profile-copy'>
                  {advisorFollowUpCopy}
                </Text>
              </View>
              <View className='flex items-center gap-2'>
                <View className='mine-modern-online-dot h-1.5 w-1.5 rounded-full'></View>
                <Text className='text-xs font-semibold mine-lite-section-link'>立即沟通</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View className='mine-lite-section-head mb-3 mt-6 flex items-center justify-between'>
          <Text className='mine-lite-section-title text-base font-bold'>订单跟踪</Text>
          <Text className='mine-lite-section-link text-sm font-medium' onClick={() => onOpenOrders('全部')}>
            查看全部
          </Text>
        </View>

        <View className='mine-lite-panel mb-5 rounded-3xl px-4 py-5'>
          <View className='grid grid-cols-4 gap-3'>
            {orderItems.map((item) => (
              <OrderTrackItem key={item.key} icon={item.icon} label={item.label} badge={item.badge} onClick={item.onClick} />
            ))}
          </View>
        </View>

        <View className='mine-lite-panel mb-4 overflow-hidden rounded-3xl'>
          {isLoggedIn ? (
            <View
              onClick={onOpenChat}
              className='mine-lite-menu-row flex items-center justify-between px-5 py-4 border-b mine-lite-divider'
            >
              <View className='flex items-center gap-3'>
                <View className='mine-lite-menu-icon flex h-8 w-8 items-center justify-center rounded-full'>
                  <ChatOutlined className='text-base mine-lite-icon' />
                </View>
                <View className='flex flex-col'>
                  <Text className='text-sm font-semibold mine-lite-text'>专属客户经理</Text>
                  <Text className='text-xs mine-lite-profile-copy'>在线咨询</Text>
                </View>
              </View>
              <View className='flex items-center gap-2'>
                <View className='mine-modern-online-dot h-1.5 w-1.5 rounded-full'></View>
                <ArrowRight className='text-base mine-lite-chevron' />
              </View>
            </View>
          ) : null}
          {menuItems.map((item, index) => (
            <MenuLink
              key={item.key}
              icon={item.icon}
              label={item.label}
              onClick={() => onMenuItemClick(item)}
              showDivider={index < menuItems.length - 1}
            />
          ))}
        </View>

        <View className='mt-4'>
          <NativeButton
            id='mine-logout-btn'
            className='mine-lite-logout-btn flex w-full items-center justify-center gap-2 rounded-2xl border py-3'
            onClick={onAuthAction}
            disabled={loggingOut}
          >
            <Revoke className='text-lg mine-lite-profile-copy' />
            <Text className='text-sm font-bold mine-lite-profile-copy'>
              {isLoggedIn ? '切换账号或退出登录' : '立即登录'}
            </Text>
          </NativeButton>
          <Text className='mine-modern-version mt-5 block text-center text-10 font-medium uppercase tracking-widest'>
            B2B Portal v2.4.0
          </Text>
        </View>
      </View>
    </View>
  )
}
