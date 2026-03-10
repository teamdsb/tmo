import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Tag from '@taroify/core/tag'
import { AddOutlined, ArrowLeft, ChatOutlined, PhotoOutlined } from '@taroify/icons'

import './index.scss'

import { commerceServices } from '../../../services/commerce'
import { loadBootstrap } from '../../../services/bootstrap'
import { ensureLoggedIn, isUnauthorized } from '../../../utils/auth'
import { getNavbarStyle } from '../../../utils/navbar'
import { goodsDetailRoute, orderDetailRoute, ROUTES } from '../../../routes'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { requireCommerceBaseUrl } from '../../../config/runtime-env'

type ChatMessageItem = Awaited<ReturnType<typeof commerceServices.support.sendMessage>> & {
  localId?: string
  pending?: boolean
  failed?: boolean
  retryableAction?: 'TEXT' | 'IMAGE'
  retryPayload?: string
  retryAssetPath?: string
}

type RecentOrder = Awaited<ReturnType<typeof commerceServices.orders.list>>['items'][number]
type RecentProduct = Awaited<ReturnType<typeof commerceServices.catalog.listProducts>>['items'][number]

type SupportSocketEnvelope = {
  type: string
  data?: {
    conversation?: Awaited<ReturnType<typeof commerceServices.support.getCurrentConversation>>
    message?: Awaited<ReturnType<typeof commerceServices.support.sendMessage>>
  }
}

type SocketController = {
  close: () => void
}

const buildWsUrl = (baseUrl: string, token?: string) => {
  const normalized = baseUrl.replace(/\/+$/, '')
  const query = token ? `?token=${encodeURIComponent(token)}` : ''
  if (normalized.startsWith('https://')) {
    return normalized.replace(/^https:\/\//, 'wss://') + `/ws/support${query}`
  }
  if (normalized.startsWith('http://')) {
    return normalized.replace(/^http:\/\//, 'ws://') + `/ws/support${query}`
  }
  return normalized + `/ws/support${query}`
}

const connectSupportSocket = async (
  onEnvelope: (value: SupportSocketEnvelope) => void,
  onState: (value: 'connecting' | 'connected' | 'disconnected') => void
): Promise<SocketController | null> => {
  const token = await commerceServices.tokens.getToken()
  if (!token) {
    return null
  }

  const url = buildWsUrl(requireCommerceBaseUrl(), token)
  onState('connecting')

  if (process.env.TARO_ENV === 'h5' && typeof WebSocket !== 'undefined') {
    const socket = new WebSocket(url, [])
    socket.onopen = () => onState('connected')
    socket.onclose = () => onState('disconnected')
    socket.onerror = () => onState('disconnected')
    socket.onmessage = (event) => {
      try {
        onEnvelope(JSON.parse(String(event.data)) as SupportSocketEnvelope)
      } catch {
        // ignore malformed ws payload
      }
    }
    return {
      close: () => socket.close()
    }
  }

  const task = Taro.connectSocket({
    url,
    header: {
      Authorization: `Bearer ${token}`
    }
  })

  task.onOpen(() => onState('connected'))
  task.onClose(() => onState('disconnected'))
  task.onError(() => onState('disconnected'))
  task.onMessage((event) => {
    try {
      onEnvelope(JSON.parse(String(event.data)) as SupportSocketEnvelope)
    } catch {
      // ignore malformed ws payload
    }
  })

  return {
    close: () => {
      void task.close({})
    }
  }
}

const formatTime = (value?: string) => {
  if (!value) {
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

const bubbleClassName = (message: ChatMessageItem) => {
  if (message.senderType === 'CUSTOMER') {
    return 'support-chat__bubble support-chat__bubble--customer'
  }
  if (message.senderType === 'SYSTEM') {
    return 'support-chat__system'
  }
  return 'support-chat__bubble support-chat__bubble--staff'
}

const conversationStatusLabel = (status?: string) => {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'OPEN_ASSIGNED') return '客服处理中'
  if (normalized === 'CLOSED') return '会话已关闭'
  return '待接入客服'
}

const socketStatusLabel = (state: 'connecting' | 'connected' | 'disconnected') => {
  if (state === 'connected') return '实时连接中'
  if (state === 'connecting') return '连接中'
  return '实时中断，已切换轮询'
}

export default function SupportChatPage() {
  const navbarStyle = getNavbarStyle()
  const [conversation, setConversation] = useState<Awaited<ReturnType<typeof commerceServices.support.getCurrentConversation>> | null>(null)
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [initializingConversation, setInitializingConversation] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingText, setSendingText] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [socketState, setSocketState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])
  const [pageError, setPageError] = useState('')
  const socketRef = useRef<SocketController | null>(null)

  useEffect(() => {
    if (!conversation?.id || socketState !== 'disconnected') {
      return undefined
    }
    const timer = setInterval(() => {
      void commerceServices.support.getCurrentConversation()
        .then((nextConversation) => {
          setConversation(nextConversation)
          return commerceServices.support.listMessages(nextConversation.id, { page: 1, pageSize: 100 })
        })
        .then((messageList) => {
          setMessages(messageList.items ?? [])
        })
        .catch((error) => {
          console.warn('poll support chat failed', error)
        })
    }, 5000)

    return () => clearInterval(timer)
  }, [conversation?.id, socketState])

  const title = useMemo(() => {
    if (conversation?.assigneeRole) {
      return `在线客服 · ${conversation.assigneeRole}`
    }
    return '在线客服'
  }, [conversation?.assigneeRole])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const loggedIn = await ensureLoggedIn()
      if (!loggedIn || cancelled) {
        return
      }

      setLoading(true)
      setInitializingConversation(true)
      setLoadingMessages(true)
      setPageError('')
      try {
        const bootstrap = await loadBootstrap()
        const currentConversation = await commerceServices.support.getCurrentConversation()
        if (cancelled) {
          return
        }
        setConversation(currentConversation)
        setInitializingConversation(false)

        const [messageList, orders, products] = await Promise.all([
          commerceServices.support.listMessages(currentConversation.id, { page: 1, pageSize: 100 }),
          commerceServices.orders.list({ page: 1, pageSize: 5 }),
          commerceServices.catalog.listProducts({ page: 1, pageSize: 6 })
        ])

        if (cancelled) {
          return
        }

        setMessages(messageList.items ?? [])
        setRecentOrders(orders.items ?? [])
        setRecentProducts(products.items ?? [])
        setLoadingMessages(false)
        await commerceServices.support.markRead(currentConversation.id)

        const socket = await connectSupportSocket((envelope) => {
          if (!envelope?.type) {
            return
          }
          if (envelope.data?.conversation?.id === currentConversation.id) {
            setConversation(envelope.data.conversation)
          }
          if (envelope.type === 'message.created' && envelope.data?.message?.conversationId === currentConversation.id) {
            setMessages((currentItems) => {
              const nextItems = currentItems.filter((item) => !(
                item.pending &&
                item.messageType === envelope.data?.message?.messageType &&
                item.textContent === envelope.data?.message?.textContent
              ))
              return [...nextItems, envelope.data.message]
            })
          }
        }, setSocketState)
        if (!cancelled) {
          socketRef.current = socket
          if (bootstrap?.me?.displayName) {
            void bootstrap
          }
        }
      } catch (error) {
        if (isUnauthorized(error)) {
          await Taro.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
          await navigateTo(ROUTES.authLogin)
          return
        }
        console.warn('load support chat failed', error)
        if (!cancelled) {
          setPageError('客服连接初始化失败，请下拉返回后重试。')
          setInitializingConversation(false)
          setLoadingMessages(false)
          await Taro.showToast({ title: '加载客服会话失败', icon: 'none' })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [])

  const handleBack = async () => {
    await Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))
  }

  const handleSendText = async () => {
    const text = draft.trim()
    if (!conversation || !text || sendingText || uploadingImage) {
      return
    }

    const localId = `local-${Date.now()}`
    setDraft('')
    setSendingText(true)
    setMessages((current) => [
      ...current,
      {
        id: localId,
        conversationId: conversation.id,
        senderType: 'CUSTOMER',
        messageType: 'TEXT',
        textContent: text,
        createdAt: new Date().toISOString(),
        pending: true,
        localId,
        retryableAction: 'TEXT',
        retryPayload: text
      } as ChatMessageItem
    ])

    try {
      const created = await commerceServices.support.sendMessage(conversation.id, {
        messageType: 'TEXT',
        text
      })
      setMessages((current) => current.map((item) => (item.localId === localId ? created : item)))
    } catch (error) {
      console.warn('send support text failed', error)
      setMessages((current) => current.map((item) => (
        item.localId === localId
          ? {
              ...item,
              pending: false,
              failed: true
            }
          : item
      )))
      await Taro.showToast({ title: '发送失败，可直接重试', icon: 'none' })
    } finally {
      setSendingText(false)
    }
  }

  const uploadImageWithPlaceholder = async (conversationId: string, filePath: string, localId?: string) => {
    const nextLocalId = localId || `local-image-${Date.now()}`
    if (!localId) {
      setMessages((current) => [
        ...current,
        {
          id: nextLocalId,
          localId: nextLocalId,
          conversationId,
          senderType: 'CUSTOMER',
          messageType: 'IMAGE',
          createdAt: new Date().toISOString(),
          pending: true,
          retryableAction: 'IMAGE',
          retryAssetPath: filePath
        } as ChatMessageItem
      ])
    } else {
      setMessages((current) => current.map((item) => (
        item.localId === localId
          ? {
              ...item,
              pending: true,
              failed: false
            }
          : item
      )))
    }

    try {
      const asset = await commerceServices.support.uploadImage(conversationId, filePath)
      const created = await commerceServices.support.sendMessage(conversationId, {
        messageType: 'IMAGE',
        assetId: asset.id
      })
      setMessages((current) => current.map((item) => (item.localId === nextLocalId ? created : item)))
    } catch (error) {
      setMessages((current) => current.map((item) => (
        item.localId === nextLocalId
          ? {
              ...item,
              pending: false,
              failed: true,
              retryableAction: 'IMAGE',
              retryAssetPath: filePath
            }
          : item
      )))
      throw error
    }
  }

  const handleUploadImage = async () => {
    if (!conversation || uploadingImage || sendingText) {
      return
    }
    setUploadingImage(true)
    let filePath = ''
    try {
      const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed', 'original'] })
      filePath = selected.tempFilePaths?.[0] || ''
      if (!filePath) {
        return
      }
      await uploadImageWithPlaceholder(conversation.id, filePath)
    } catch (error) {
      console.warn('upload support image failed', error)
      if (!(error instanceof Error && error.message === 'cancel')) {
        await Taro.showToast({ title: '图片发送失败，可重试', icon: 'none' })
      }
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRetryMessage = async (message: ChatMessageItem) => {
    if (!conversation || !message.failed) {
      return
    }
    if (message.retryableAction === 'TEXT' && message.retryPayload) {
      setSendingText(true)
      try {
        const created = await commerceServices.support.sendMessage(conversation.id, {
          messageType: 'TEXT',
          text: message.retryPayload
        })
        setMessages((current) => current.map((item) => (item.localId === message.localId ? created : item)))
      } catch (error) {
        console.warn('retry support text failed', error)
        await Taro.showToast({ title: '重试失败，请稍后再试', icon: 'none' })
      } finally {
        setSendingText(false)
      }
      return
    }
    if (message.retryableAction === 'IMAGE' && message.retryAssetPath) {
      setUploadingImage(true)
      try {
        await uploadImageWithPlaceholder(conversation.id, message.retryAssetPath, message.localId)
      } catch (error) {
        console.warn('retry support image failed', error)
        setMessages((current) => current.map((item) => (
          item.localId === message.localId
            ? { ...item, pending: false, failed: true }
            : item
        )))
        await Taro.showToast({ title: '图片重试失败', icon: 'none' })
      } finally {
        setUploadingImage(false)
      }
    }
  }

  const handleSendOrderCard = async () => {
    if (!conversation || recentOrders.length === 0) {
      return
    }
    const itemList = recentOrders.map((item) => `订单 ${String(item.id).slice(0, 8)} · ${item.status}`)
    const result = await Taro.showActionSheet({ itemList }).catch(() => null)
    if (!result || typeof result.tapIndex !== 'number') {
      return
    }
    const selected = recentOrders[result.tapIndex]
    if (!selected) {
      return
    }
    const firstItem = selected.items?.[0]?.name || '查看订单详情'
    const created = await commerceServices.support.sendMessage(conversation.id, {
      messageType: 'ORDER_CARD',
      cardPayload: {
        title: `订单 ${String(selected.id).slice(0, 8)}`,
        subtitle: `${selected.status} · ${firstItem}`,
        route: orderDetailRoute(selected.id),
        orderId: selected.id
      }
    })
    setMessages((current) => [...current, created])
  }

  const handleSendProductCard = async () => {
    if (!conversation || recentProducts.length === 0) {
      return
    }
    const itemList = recentProducts.map((item) => item.name)
    const result = await Taro.showActionSheet({ itemList }).catch(() => null)
    if (!result || typeof result.tapIndex !== 'number') {
      return
    }
    const selected = recentProducts[result.tapIndex]
    if (!selected) {
      return
    }
    const created = await commerceServices.support.sendMessage(conversation.id, {
      messageType: 'PRODUCT_CARD',
      cardPayload: {
        title: selected.name,
        subtitle: '点击查看商品详情',
        route: goodsDetailRoute(selected.id),
        productId: selected.id,
        imageUrl: selected.coverImageUrl
      }
    })
    setMessages((current) => [...current, created])
  }

  const handleMoreAction = async () => {
    const result = await Taro.showActionSheet({
      itemList: ['发送图片', '发送订单卡片', '发送商品卡片', '去支持中心']
    }).catch(() => null)

    if (!result || typeof result.tapIndex !== 'number') {
      return
    }

    if (result.tapIndex === 0) {
      await handleUploadImage()
      return
    }
    if (result.tapIndex === 1) {
      await handleSendOrderCard()
      return
    }
    if (result.tapIndex === 2) {
      await handleSendProductCard()
      return
    }
    await navigateTo(ROUTES.support)
  }

  const handleCardClick = async (payload?: Record<string, unknown>) => {
    const route = typeof payload?.route === 'string' ? payload.route : ''
    if (!route) {
      return
    }
    await navigateTo(route)
  }

  return (
    <View className='page support-chat'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={handleBack}>
          <ArrowLeft />
        </Navbar.NavLeft>
        <Navbar.Title>{title}</Navbar.Title>
      </Navbar>

      <View className='support-chat__topbar'>
        <View>
          <Text className='support-chat__heading'>{conversationStatusLabel(conversation?.status)}</Text>
          <Text className='support-chat__subheading'>
            {conversation?.assigneeRole ? `当前由 ${conversation.assigneeRole} 接待` : '已进入在线客服通道，支持文字、图片、订单卡片和商品卡片'}
          </Text>
        </View>
        <Tag color={socketState === 'connected' ? 'success' : socketState === 'connecting' ? 'warning' : 'danger'}>
          {socketStatusLabel(socketState)}
        </Tag>
      </View>

      {pageError ? (
        <View className='support-chat__notice support-chat__notice--error'>
          <Text>{pageError}</Text>
        </View>
      ) : null}

      {initializingConversation ? (
        <View className='support-chat__notice'>
          <Text>正在建立客服会话，请稍候…</Text>
        </View>
      ) : null}

      <View className='support-chat__quickbar'>
        <View className={`support-chat__chip ${!conversation ? 'support-chat__chip--disabled' : ''}`} onClick={() => conversation ? void handleSendOrderCard() : undefined}>
          <Text>发送订单</Text>
        </View>
        <View className={`support-chat__chip ${!conversation ? 'support-chat__chip--disabled' : ''}`} onClick={() => conversation ? void handleSendProductCard() : undefined}>
          <Text>发送商品</Text>
        </View>
        <View className='support-chat__chip' onClick={() => void navigateTo(ROUTES.supportCreate)}>
          <Text>售后工单</Text>
        </View>
      </View>

      <ScrollView scrollY className='support-chat__messages'>
        {loading || initializingConversation || loadingMessages ? (
          <View className='support-chat__empty'>
            <Text>{initializingConversation ? '正在建立会话...' : '正在加载消息...'}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View className='support-chat__empty'>
            <Text>客服通道已就绪，发送第一条消息开始沟通。</Text>
          </View>
        ) : (
          messages.map((message) => {
            const cardPayload = message.cardPayload
            return (
              <View
                key={message.localId || message.id}
                className={`support-chat__row ${
                  message.senderType === 'CUSTOMER'
                    ? 'support-chat__row--customer'
                    : message.senderType === 'SYSTEM'
                      ? 'support-chat__row--system'
                      : 'support-chat__row--staff'
                }`}
              >
                <View className={bubbleClassName(message)}>
                  {message.messageType === 'IMAGE' && message.asset?.url ? (
                    <Image
                      className='support-chat__image'
                      src={message.asset.url}
                      mode='aspectFill'
                      onClick={() => {
                        void Taro.previewImage({ current: message.asset?.url, urls: [message.asset.url] })
                      }}
                    />
                  ) : null}
                  {message.textContent ? (
                    <Text className='support-chat__text'>{message.textContent}</Text>
                  ) : null}
                  {message.messageType === 'IMAGE' && !message.asset?.url ? (
                    <Text className='support-chat__text'>{message.pending ? '图片上传中…' : message.failed ? '图片发送失败' : '图片消息'}</Text>
                  ) : null}
                  {(message.messageType === 'ORDER_CARD' || message.messageType === 'PRODUCT_CARD') && cardPayload ? (
                    <View className='support-chat__card' onClick={() => void handleCardClick(cardPayload)}>
                      {typeof cardPayload.imageUrl === 'string' ? (
                        <Image className='support-chat__card-image' src={cardPayload.imageUrl} mode='aspectFill' />
                      ) : null}
                      <View className='support-chat__card-content'>
                        <Text className='support-chat__card-title'>{String(cardPayload.title || '卡片消息')}</Text>
                        {typeof cardPayload.subtitle === 'string' ? (
                          <Text className='support-chat__card-subtitle'>{cardPayload.subtitle}</Text>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                  {message.senderType !== 'SYSTEM' ? (
                    <Text className='support-chat__meta'>
                      {formatTime(message.createdAt)}
                      {message.pending ? ' · 发送中' : ''}
                      {message.failed ? ' · 发送失败' : ''}
                    </Text>
                  ) : null}
                  {message.failed ? (
                    <View className='support-chat__retry' onClick={() => void handleRetryMessage(message)}>
                      <Text>重试</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      <View className='support-chat__composer'>
        <View className={`support-chat__tool ${!conversation ? 'support-chat__tool--disabled' : ''}`} onClick={() => conversation ? void handleMoreAction() : undefined}>
          <AddOutlined />
        </View>
        <View className='support-chat__input-wrap'>
          <Input
            value={draft}
            maxlength={500}
            placeholder='请输入您要咨询的内容...'
            onInput={(event) => setDraft(event.detail.value)}
            onConfirm={() => void handleSendText()}
            className='support-chat__input'
            confirmType='send'
            disabled={!conversation}
          />
        </View>
        <Button className='support-chat__send' loading={sendingText || uploadingImage} onClick={() => void handleSendText()} disabled={!conversation}>
          {uploadingImage ? <PhotoOutlined /> : <ChatOutlined />}
        </Button>
      </View>
    </View>
  )
}
