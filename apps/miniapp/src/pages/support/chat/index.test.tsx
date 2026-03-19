import { act, fireEvent, render, screen } from '@testing-library/react'
import Taro from '@tarojs/taro'
import fs from 'node:fs'
import path from 'node:path'

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

import { commerceServices } from '../../../services/commerce'
import SupportChatPage from './index'

const flushPromises = () => new Promise((resolve) => process.nextTick(resolve))

const waitForConversationReady = async () => {
  await screen.findByText('待接入客服')
  await screen.findByText('客服通道已就绪，发送第一条消息开始沟通。')
}

describe('SupportChatPage', () => {
  const supportService = {
    getCurrentConversation: jest.fn(),
    listMessages: jest.fn(),
    sendMessage: jest.fn(),
    uploadImage: jest.fn(),
    markRead: jest.fn()
  }

  beforeEach(() => {
    ;(commerceServices as any).support = supportService
    ;(commerceServices.tokens.getToken as jest.Mock).mockResolvedValue('commerce-token')
    ;(commerceServices.orders.list as jest.Mock).mockResolvedValue({ items: [] })
    ;(commerceServices.catalog.listProducts as jest.Mock).mockResolvedValue({ items: [] })

    supportService.getCurrentConversation.mockResolvedValue({
      id: 'conv-1',
      status: 'OPEN_UNASSIGNED',
      assigneeRole: '',
      customerDisplayName: '客户A',
      customerPhone: '+15550000003'
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

  it('keeps composer visible above bottom safe area', () => {
    const stylesheet = fs.readFileSync(path.resolve(__dirname, './index.scss'), 'utf8')

    expect(stylesheet).toContain('.support-chat__composer')
    expect(stylesheet).toContain('padding-bottom: calc(28px + env(safe-area-inset-bottom));')
    expect(stylesheet).toContain('padding-bottom: calc(28px + constant(safe-area-inset-bottom));')
    expect(stylesheet).toContain('.support-chat__messages')
    expect(stylesheet).toContain('padding-bottom: calc(20px + env(safe-area-inset-bottom));')
    expect(stylesheet).toContain('.support-chat__row--customer')
    expect(stylesheet).toContain('margin-left: auto;')
    expect(stylesheet).toContain('overflow-wrap: anywhere;')
  })
})
