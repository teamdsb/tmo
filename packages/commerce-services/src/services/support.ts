import { joinUrl } from '@tmo/openapi-client'
import { getApiClientConfig, type ApiClientResponse } from '@tmo/api-client'

import type { UploadClient } from '../uploads'

export interface SupportConversation {
  id: string
  customerUserId: string
  customerDisplayName?: string
  customerPhone?: string
  ownerSalesUserId?: string
  assigneeUserId?: string
  assigneeRole?: string
  status: string
  lastMessageType?: string
  lastMessagePreview?: string
  lastMessageAt: string
  customerUnreadCount: number
  staffUnreadCount: number
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export interface SupportMessageAsset {
  id: string
  contentType: string
  fileName: string
  fileSize: number
  url: string
  createdAt: string
}

export interface SupportMessage {
  id: string
  conversationId: string
  senderType: string
  senderUserId?: string
  senderRole?: string
  messageType: string
  textContent?: string
  asset?: SupportMessageAsset
  cardPayload?: Record<string, unknown>
  createdAt: string
}

export interface SupportConversationContext {
  customerUserId: string
  ownerSalesUserId?: string
  recentOrders: Array<Record<string, unknown>>
  recentInquiries: Array<Record<string, unknown>>
  recentTickets: Array<Record<string, unknown>>
}

export interface SupportConversationDetail {
  conversation: SupportConversation
  messages: SupportMessage[]
  context: SupportConversationContext
}

export interface SupportConversationList {
  items: SupportConversation[]
  page: number
  pageSize: number
  total: number
}

export interface SupportMessageList {
  items: SupportMessage[]
  page: number
  pageSize: number
  total: number
}

export interface CreateSupportMessagePayload {
  messageType?: 'TEXT' | 'IMAGE' | 'ORDER_CARD' | 'PRODUCT_CARD'
  text?: string
  assetId?: string
  cardPayload?: Record<string, unknown>
}

export interface TransferSupportConversationPayload {
  toUserId: string
  toRole: string
  note?: string
}

export interface SupportService {
  getCurrentConversation: () => Promise<SupportConversation>
  listMessages: (conversationId: string, params?: { page?: number; pageSize?: number }) => Promise<SupportMessageList>
  sendMessage: (conversationId: string, payload: CreateSupportMessagePayload) => Promise<SupportMessage>
  uploadImage: (conversationId: string, filePath: string) => Promise<SupportMessageAsset>
  markRead: (conversationId: string) => Promise<SupportConversation>
  listAdminConversations: (params?: { page?: number; pageSize?: number; scope?: string; status?: string }) => Promise<SupportConversationList>
  getAdminConversation: (conversationId: string) => Promise<SupportConversationDetail>
  claimConversation: (conversationId: string) => Promise<SupportConversation>
  releaseConversation: (conversationId: string) => Promise<SupportConversation>
  transferConversation: (conversationId: string, payload: TransferSupportConversationPayload) => Promise<SupportConversation>
}

const request = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  const { baseUrl, requester } = getApiClientConfig()
  const response = await requester<T>({
    url: joinUrl(baseUrl, path),
    method,
    body
  })
  return unwrapResponse(response)
}

const unwrapResponse = <T>(response: ApiClientResponse<T>): T => {
  return response.data
}

const buildQuery = (params?: Record<string, string | number | undefined>) => {
  if (!params) {
    return ''
  }
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return query ? `?${query}` : ''
}

export const createSupportService = (uploadClient: UploadClient): SupportService => {
  return {
    getCurrentConversation: async () => request<SupportConversation>('/support/conversations/current'),
    listMessages: async (conversationId, params) => {
      return request<SupportMessageList>(
        `/support/conversations/${conversationId}/messages${buildQuery({
          page: params?.page,
          pageSize: params?.pageSize
        })}`
      )
    },
    sendMessage: async (conversationId, payload) => {
      return request<SupportMessage>(`/support/conversations/${conversationId}/messages`, 'POST', payload)
    },
    uploadImage: async (conversationId, filePath) => {
      return uploadClient.upload<SupportMessageAsset>(`/support/conversations/${conversationId}/messages/image`, filePath, 'file')
    },
    markRead: async (conversationId) => {
      return request<SupportConversation>(`/support/conversations/${conversationId}/read`, 'POST')
    },
    listAdminConversations: async (params) => {
      return request<SupportConversationList>(
        `/admin/support/conversations${buildQuery({
          page: params?.page,
          pageSize: params?.pageSize,
          scope: params?.scope,
          status: params?.status
        })}`
      )
    },
    getAdminConversation: async (conversationId) => {
      return request<SupportConversationDetail>(`/admin/support/conversations/${conversationId}`)
    },
    claimConversation: async (conversationId) => {
      return request<SupportConversation>(`/admin/support/conversations/${conversationId}/claim`, 'POST')
    },
    releaseConversation: async (conversationId) => {
      return request<SupportConversation>(`/admin/support/conversations/${conversationId}/release`, 'POST')
    },
    transferConversation: async (conversationId, payload) => {
      return request<SupportConversation>(`/admin/support/conversations/${conversationId}/transfer`, 'POST', payload)
    }
  }
}
