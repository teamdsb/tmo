import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Taro from '@tarojs/taro'
import fs from 'node:fs'
import path from 'node:path'
import { commerceServices } from '../../../services/commerce'
import SupportChatPage, { connectSupportSocket, mergeIncomingSupportMessage } from './index'

jest.mock('../../../services/bootstrap', () => ({
  loadBootstrap: jest.fn(async () => ({
    me: {
      userType: 'customer',
      roles: ['CUSTOMER'],
      currentRole: 'CUSTOMER',
      displayName: '测试客户'
    }
  }))
}))

jest.mock('../../../utils/auth', () => ({
  ensureLoggedIn: jest.fn(async () => true),
  isUnauthorized: jest.fn(() => false)
}))

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const waitForConversationReady = async () => {
  await screen.findByText('待接入客服')
  await screen.findByText('客服通道已就绪，发送第一条消息开始沟通。')
}

describe('SupportChatPage', () => {
  let socket: { onmessage: null | ((event: { data: string }) => void) } | null = null
  const supportService = {
    getCurrentConversation: jest.fn(),
    listMessages: jest.fn(),
    sendMessage: jest.fn(),
    uploadImage: jest.fn(),
    markRead: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    Object.values(supportService).forEach((method) => method.mockReset())
    ;(Taro.showActionSheet as jest.Mock).mockReset().mockResolvedValue({ tapIndex: 0 })
    ;(Taro.chooseImage as jest.Mock).mockReset()
    socket = null
    ;(commerceServices as any).support = supportService
    ;(commerceServices.tokens.getToken as jest.Mock).mockResolvedValue('commerce-token')
    ;(commerceServices.orders.list as jest.Mock).mockResolvedValue({ items: [] })
    ;(commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({ items: [] })

    supportService.getCurrentConversation.mockResolvedValue({
      id: 'conv-1',
      status: 'OPEN_UNASSIGNED',
      assigneeRole: '',
      customerDisplayName: '客户A',
      customerPhone: '+15550000003',
      queuedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    })
    supportService.listMessages.mockResolvedValue({ items: [] })
    supportService.markRead.mockResolvedValue({})
    supportService.sendMessage.mockResolvedValue({
      id: 'msg-1',
      conversationId: 'conv-1',
      senderType: 'CUSTOMER',
      messageType: 'TEXT',
      textContent: '你好',
      createdAt: '2026-03-10T10:00:00Z'
    })
    supportService.uploadImage.mockResolvedValue({ id: 'asset-1' })

    ;(globalThis as any).WebSocket = class {
      onopen: null | (() => void) = null
      onclose: null | (() => void) = null
      onerror: null | (() => void) = null
      onmessage: null | ((event: { data: string }) => void) = null
      constructor() {
        socket = this
        setTimeout(() => this.onopen?.(), 0)
      }
      close() {}
    }
  })

  it('shows conversation status after initialization', async () => {
    render(<SupportChatPage />)

    await waitForConversationReady()

    expect(screen.getByText('待接入客服')).toBeInTheDocument()
    expect(screen.getByText(/连接中/)).toBeInTheDocument()
    expect(screen.getByText('客服通道已就绪，发送第一条消息开始沟通。')).toBeInTheDocument()
  })

  it('does not append a websocket message already confirmed by the send response', () => {
    const confirmedMessage = {
      id: 'msg-confirmed',
      conversationId: 'conv-1',
      senderType: 'CUSTOMER',
      messageType: 'TEXT',
      textContent: 'hello',
      createdAt: '2026-03-10T10:00:00Z'
    }

    expect(mergeIncomingSupportMessage([confirmedMessage], confirmedMessage)).toEqual([confirmedMessage])

    const distinctMessage = { ...confirmedMessage, id: 'msg-distinct' }
    expect(mergeIncomingSupportMessage([confirmedMessage], distinctMessage)).toEqual([confirmedMessage, distinctMessage])
  })

  it.each([
    ['ORDER_CARD', '发送订单', '订单 order-1', 'websocket-first'],
    ['ORDER_CARD', '发送订单', '订单 order-1', 'response-first'],
    ['PRODUCT_CARD', '发送商品', '示例商品卡片', 'websocket-first'],
    ['PRODUCT_CARD', '发送商品', '示例商品卡片', 'response-first']
  ])('renders one %s when sending via %s and receiving the same ID (%s, %s)', async (messageType, action, title, deliveryOrder) => {
    ;(commerceServices.orders.list as jest.Mock).mockResolvedValue({ items: [{ id: 'order-1', status: 'SUBMITTED', items: [] }] })
    ;(commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({ items: [{ id: 'spu-1', name: '示例商品卡片' }] })
    ;(Taro.showActionSheet as jest.Mock).mockResolvedValueOnce({ tapIndex: 0 })
    const message = {
      id: `msg-${messageType}`, conversationId: 'conv-1', senderType: 'CUSTOMER',
      messageType, cardPayload: { title }, createdAt: '2026-03-10T10:00:00Z'
    }
    let finishSend: (value: typeof message) => void = () => {}
    supportService.sendMessage.mockReturnValueOnce(new Promise((resolve) => { finishSend = resolve }))
    render(<SupportChatPage />)
    await waitForConversationReady()
    await waitFor(() => expect(socket?.onmessage).toEqual(expect.any(Function)))
    await act(async () => { fireEvent.click(screen.getByText(action)); await flushPromises() })
    expect(supportService.sendMessage).toHaveBeenCalledWith('conv-1', expect.objectContaining({ messageType }))

    const receive = () => socket?.onmessage?.({ data: JSON.stringify({ type: 'message.created', data: { message } }) })
    await act(async () => {
      if (deliveryOrder === 'websocket-first') receive()
      else finishSend(message)
      await flushPromises()
    })
    expect(screen.getAllByText(title)).toHaveLength(1)
    await act(async () => {
      if (deliveryOrder === 'websocket-first') finishSend(message)
      else receive()
      await flushPromises()
    })
    expect(screen.getAllByText(title)).toHaveLength(1)
  })

  it.each([
    [0, 'IMAGE'], [1, 'ORDER_CARD'], [2, 'PRODUCT_CARD']
  ])('offers message actions and dispatches selection %s as %s', async (tapIndex, messageType) => {
    ;(commerceServices.orders.list as jest.Mock).mockResolvedValue({ items: [{ id: 'order-1', status: 'SUBMITTED', items: [] }] })
    ;(commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({ items: [{ id: 'spu-1', name: '示例商品卡片' }] })
    ;(Taro.showActionSheet as jest.Mock).mockResolvedValueOnce({ tapIndex }).mockResolvedValueOnce({ tapIndex: 0 })
    ;(Taro.chooseImage as jest.Mock).mockResolvedValueOnce({ tempFilePaths: ['/tmp/menu.png'] })
    const { container } = render(<SupportChatPage />)
    await waitForConversationReady()
    await act(async () => {
      fireEvent.click(container.querySelector('.support-chat__tool') as Element)
      await flushPromises()
    })
    expect(Taro.showActionSheet).toHaveBeenNthCalledWith(1, { itemList: ['发送图片', '发送订单卡片', '发送商品卡片'] })
    expect(supportService.sendMessage).toHaveBeenCalledWith('conv-1', expect.objectContaining({ messageType }))
    if (messageType === 'IMAGE') {
      expect(supportService.uploadImage).toHaveBeenCalledWith('conv-1', '/tmp/menu.png')
    } else {
      expect(supportService.sendMessage).toHaveBeenCalledWith('conv-1', expect.objectContaining({
        cardPayload: expect.objectContaining(messageType === 'ORDER_CARD' ? { orderId: 'order-1' } : { productId: 'spu-1' })
      }))
    }
    expect(Taro.navigateTo).not.toHaveBeenCalled()
  })

  it('allows chatting while optional support data is still loading', async () => {
    ;(commerceServices.orders.list as jest.Mock).mockReturnValue(new Promise(() => {}))
    ;(commerceServices.catalog.listProducts as jest.Mock).mockReturnValue(new Promise(() => {}))

    render(<SupportChatPage />)

    await screen.findByText('待接入客服')
    expect(screen.queryByText('正在建立会话...')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入您要咨询的内容...')).not.toBeDisabled()
  })

  it('shows the busy fallback after the conversation waits over 30 seconds', async () => {
    supportService.getCurrentConversation.mockResolvedValue({
      id: 'conv-1',
      status: 'OPEN_UNASSIGNED',
      assigneeRole: '',
      customerDisplayName: '客户A',
      customerPhone: '+15550000003',
      queuedAt: new Date(Date.now() - 31_000).toISOString(),
      createdAt: new Date(Date.now() - 31_000).toISOString()
    })

    render(<SupportChatPage />)

    expect(await screen.findByText('客服繁忙，您可以继续留言，客服接入后会回复。')).toBeInTheDocument()
    expect(screen.getByText('创建售后工单')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入您要咨询的内容...')).not.toBeDisabled()
  })

  it('falls back when the realtime socket does not open before the deadline', async () => {
    ;(globalThis as any).WebSocket = class {
      onopen: null | (() => void) = null
      onclose: null | (() => void) = null
      onerror: null | (() => void) = null
      onmessage: null | ((event: { data: string }) => void) = null
      close() {}
    }
    const states: string[] = []

    const controller = await connectSupportSocket(() => {}, (state) => states.push(state), 1)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(states).toEqual(['connecting', 'disconnected'])
    controller?.close()
  })

  it('keeps failed text message and retries in place', async () => {
    supportService.sendMessage
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        id: 'msg-2',
        conversationId: 'conv-1',
        senderType: 'CUSTOMER',
        messageType: 'TEXT',
        textContent: '重试消息',
        createdAt: '2026-03-10T10:01:00Z'
      })

    const { container } = render(<SupportChatPage />)
    await waitForConversationReady()

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('请输入您要咨询的内容...'), { target: { value: '重试消息' } })
      fireEvent.click(container.querySelector('.support-chat__send') as Element)
      await flushPromises()
    })

    expect(await screen.findByText(/发送失败/)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('重试'))
      await flushPromises()
    })

    expect(await screen.findByText('重试消息')).toBeInTheDocument()
    expect(screen.queryByText(/发送失败/)).not.toBeInTheDocument()
  })

  it('shows upload failure placeholder and retry action', async () => {
    supportService.uploadImage
      .mockRejectedValueOnce(new Error('upload failed'))
      .mockResolvedValueOnce({ id: 'asset-2' })
    supportService.sendMessage.mockResolvedValueOnce({
      id: 'msg-image',
      conversationId: 'conv-1',
      senderType: 'CUSTOMER',
      messageType: 'IMAGE',
      asset: { id: 'asset-2', url: 'https://example.com/support.png', fileName: 'support.png', fileSize: 12, contentType: 'image/png', createdAt: '2026-03-10T10:02:00Z' },
      createdAt: '2026-03-10T10:02:00Z'
    })
    ;(Taro.showActionSheet as jest.Mock).mockResolvedValueOnce({ tapIndex: 0 })
    ;(Taro.chooseImage as jest.Mock).mockResolvedValueOnce({ tempFilePaths: ['/tmp/support.png'] })

    const { container } = render(<SupportChatPage />)
    await waitForConversationReady()

    await act(async () => {
      fireEvent.click(container.querySelector('.support-chat__tool') as Element)
      await flushPromises()
    })

    expect(await screen.findByText('图片发送失败')).toBeInTheDocument()
    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  it('keeps the shared navbar and bottom safe-area integration', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, './index.scss'), 'utf8')
    const source = fs.readFileSync(path.resolve(__dirname, './index.tsx'), 'utf8')

    expect(stylesheet).not.toContain('.support-chat__navbar .taroify-navbar__content')
    expect(source).toContain("<AppSafeAreaBottom className='support-chat__safe-area' />")
  })
})
