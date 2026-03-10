export type SupportConversationSummary = {
  id: string;
  customerUserId: string;
  customerDisplayName: string;
  customerPhone: string;
  ownerSalesUserId: string;
  assigneeUserId: string;
  assigneeRole: string;
  status: string;
  lastMessageType: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  customerUnreadCount: number;
  staffUnreadCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
};

export type SupportMessageAsset = {
  id: string;
  contentType: string;
  fileName: string;
  fileSize: number;
  url: string;
  createdAt: string;
};

export type SupportMessageCard = {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  orderId: string;
  productId: string;
  status: string;
  remark: string;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderType: string;
  senderUserId: string;
  senderRole: string;
  messageType: string;
  textContent: string;
  asset: SupportMessageAsset | null;
  cardPayload: SupportMessageCard | null;
  createdAt: string;
};

export type SupportOrderContext = {
  id: string;
  status: string;
  createdAt: string;
  remark: string;
  firstItem: string;
  totalItems: number;
};

export type SupportInquiryContext = {
  id: string;
  status: string;
  message: string;
  createdAt: string;
};

export type SupportTicketContext = {
  id: string;
  status: string;
  subject: string;
  createdAt: string;
};

export type SupportConversationContext = {
  customerUserId: string;
  ownerSalesUserId: string;
  recentOrders: SupportOrderContext[];
  recentInquiries: SupportInquiryContext[];
  recentTickets: SupportTicketContext[];
};

export type SupportConversationDetail = {
  conversation: SupportConversationSummary;
  messages: SupportMessage[];
  context: SupportConversationContext;
};

export type StaffOption = {
  id: string;
  displayName: string;
  roles: string[];
  status: string;
};

const MOCK_NOW = '2026-03-10T10:30:00Z';

const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCardPayload = (value: unknown): SupportMessageCard | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    title: safeText(record.title),
    subtitle: safeText(record.subtitle),
    imageUrl: safeText(record.imageUrl),
    linkUrl: safeText(record.linkUrl),
    orderId: safeText(record.orderId),
    productId: safeText(record.productId),
    status: safeText(record.status),
    remark: safeText(record.remark)
  };
};

export const normalizeSupportConversation = (input: unknown): SupportConversationSummary | null => {
  const item = input as Record<string, unknown> | null;
  const id = safeText(item?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    customerUserId: safeText(item?.customerUserId),
    customerDisplayName: safeText(item?.customerDisplayName, `客户 ${id.slice(0, 8)}`),
    customerPhone: safeText(item?.customerPhone, '-'),
    ownerSalesUserId: safeText(item?.ownerSalesUserId),
    assigneeUserId: safeText(item?.assigneeUserId),
    assigneeRole: safeText(item?.assigneeRole),
    status: safeText(item?.status, 'OPEN_UNASSIGNED'),
    lastMessageType: safeText(item?.lastMessageType),
    lastMessagePreview: safeText(item?.lastMessagePreview, '暂无消息'),
    lastMessageAt: safeText(item?.lastMessageAt, safeText(item?.createdAt, MOCK_NOW)),
    customerUnreadCount: toNumber(item?.customerUnreadCount),
    staffUnreadCount: toNumber(item?.staffUnreadCount),
    createdAt: safeText(item?.createdAt, MOCK_NOW),
    updatedAt: safeText(item?.updatedAt, safeText(item?.createdAt, MOCK_NOW)),
    closedAt: safeText(item?.closedAt)
  };
};

export const normalizeSupportMessage = (input: unknown): SupportMessage | null => {
  const item = input as Record<string, unknown> | null;
  const id = safeText(item?.id);
  if (!id) {
    return null;
  }
  const assetValue = item?.asset as Record<string, unknown> | null | undefined;
  return {
    id,
    conversationId: safeText(item?.conversationId),
    senderType: safeText(item?.senderType, 'SYSTEM'),
    senderUserId: safeText(item?.senderUserId),
    senderRole: safeText(item?.senderRole),
    messageType: safeText(item?.messageType, 'TEXT'),
    textContent: safeText(item?.textContent),
    asset: assetValue
      ? {
          id: safeText(assetValue.id),
          contentType: safeText(assetValue.contentType),
          fileName: safeText(assetValue.fileName),
          fileSize: toNumber(assetValue.fileSize),
          url: safeText(assetValue.url),
          createdAt: safeText(assetValue.createdAt, MOCK_NOW)
        }
      : null,
    cardPayload: normalizeCardPayload(item?.cardPayload),
    createdAt: safeText(item?.createdAt, MOCK_NOW)
  };
};

const normalizeOrderContext = (input: unknown): SupportOrderContext | null => {
  const item = input as Record<string, unknown> | null;
  const id = safeText(item?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    status: safeText(item?.status),
    createdAt: safeText(item?.createdAt, MOCK_NOW),
    remark: safeText(item?.remark),
    firstItem: safeText(item?.firstItem),
    totalItems: toNumber(item?.totalItems)
  };
};

const normalizeInquiryContext = (input: unknown): SupportInquiryContext | null => {
  const item = input as Record<string, unknown> | null;
  const id = safeText(item?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    status: safeText(item?.status),
    message: safeText(item?.message),
    createdAt: safeText(item?.createdAt, MOCK_NOW)
  };
};

const normalizeTicketContext = (input: unknown): SupportTicketContext | null => {
  const item = input as Record<string, unknown> | null;
  const id = safeText(item?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    status: safeText(item?.status),
    subject: safeText(item?.subject),
    createdAt: safeText(item?.createdAt, MOCK_NOW)
  };
};

export const normalizeSupportConversationDetail = (input: unknown): SupportConversationDetail | null => {
  const payload = input as Record<string, unknown> | null;
  const conversation = normalizeSupportConversation(payload?.conversation);
  if (!conversation) {
    return null;
  }
  const contextValue = payload?.context as Record<string, unknown> | null | undefined;
  return {
    conversation,
    messages: Array.isArray(payload?.messages)
      ? payload.messages.map((item) => normalizeSupportMessage(item)).filter(Boolean) as SupportMessage[]
      : [],
    context: {
      customerUserId: safeText(contextValue?.customerUserId, conversation.customerUserId),
      ownerSalesUserId: safeText(contextValue?.ownerSalesUserId, conversation.ownerSalesUserId),
      recentOrders: Array.isArray(contextValue?.recentOrders)
        ? contextValue.recentOrders.map((item) => normalizeOrderContext(item)).filter(Boolean) as SupportOrderContext[]
        : [],
      recentInquiries: Array.isArray(contextValue?.recentInquiries)
        ? contextValue.recentInquiries.map((item) => normalizeInquiryContext(item)).filter(Boolean) as SupportInquiryContext[]
        : [],
      recentTickets: Array.isArray(contextValue?.recentTickets)
        ? contextValue.recentTickets.map((item) => normalizeTicketContext(item)).filter(Boolean) as SupportTicketContext[]
        : []
    }
  };
};

export const normalizeStaffOptions = (input: unknown): StaffOption[] => {
  const items = Array.isArray((input as { items?: unknown[] } | null)?.items)
    ? ((input as { items?: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => {
      const record = item as Record<string, unknown>;
      const id = safeText(record.id);
      if (!id) {
        return null;
      }
      const roles = Array.isArray(record.roles) ? record.roles.filter((role): role is string => typeof role === 'string') : [];
      return {
        id,
        displayName: safeText(record.displayName, `员工 ${id.slice(0, 8)}`),
        roles,
        status: safeText(record.status, 'active').toLowerCase()
      };
    })
    .filter((item): item is StaffOption => Boolean(item));
};

export const formatSupportTime = (value: string, withDate = false) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', withDate
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const formatSupportRelativeTime = (value: string) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

export const getSupportConversationStatusLabel = (status: string) => {
  const normalized = safeText(status).toUpperCase();
  if (normalized === 'OPEN_ASSIGNED') return '已接单';
  if (normalized === 'CLOSED') return '已关闭';
  return '待领取';
};

export const getSupportConversationStatusClass = (status: string) => {
  const normalized = safeText(status).toUpperCase();
  if (normalized === 'OPEN_ASSIGNED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized === 'CLOSED') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export const getSupportMessageTypeLabel = (type: string) => {
  const normalized = safeText(type).toUpperCase();
  if (normalized === 'IMAGE') return '图片';
  if (normalized === 'ORDER_CARD') return '订单卡片';
  if (normalized === 'PRODUCT_CARD') return '商品卡片';
  if (normalized === 'SYSTEM') return '系统消息';
  return '文本';
};

export const getUserShortLabel = (userId: string, fallback = '客户') => {
  const normalized = safeText(userId);
  if (!normalized) {
    return fallback;
  }
  return `${fallback} ${normalized.slice(0, 8)}`;
};

export const canTransferSupportConversation = (role: string) => {
  const normalized = safeText(role).toUpperCase();
  return normalized === 'ADMIN' || normalized === 'BOSS' || normalized === 'MANAGER' || normalized === 'CS';
};

export const buildOrderCardPayload = (order: SupportOrderContext): Record<string, unknown> => {
  return {
    title: order.id,
    subtitle: `${order.firstItem || '订单商品'} · ${order.totalItems || 0} 件`,
    orderId: order.id,
    status: order.status,
    remark: order.remark
  };
};

export const buildProductCardPayload = (draft: { title: string; subtitle: string; productId: string; imageUrl: string; linkUrl: string }) => {
  return {
    title: safeText(draft.title, safeText(draft.productId, '商品卡片')),
    subtitle: safeText(draft.subtitle),
    productId: safeText(draft.productId),
    imageUrl: safeText(draft.imageUrl),
    linkUrl: safeText(draft.linkUrl)
  };
};

export const createMockSupportData = (): { conversations: SupportConversationSummary[]; details: Record<string, SupportConversationDetail>; staff: StaffOption[] } => {
  const conversation: SupportConversationSummary = {
    id: '5dcb2d0d-a284-4538-a395-02a7a9025a10',
    customerUserId: '1dcb2d0d-a284-4538-a395-02a7a9025a11',
    customerDisplayName: '宁波远航供应链',
    customerPhone: '13700137000',
    ownerSalesUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    assigneeUserId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    assigneeRole: 'CS',
    status: 'OPEN_ASSIGNED',
    lastMessageType: 'TEXT',
    lastMessagePreview: '请帮我确认这笔订单什么时候发出。',
    lastMessageAt: MOCK_NOW,
    customerUnreadCount: 1,
    staffUnreadCount: 0,
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: MOCK_NOW,
    closedAt: ''
  };

  return {
    conversations: [conversation],
    details: {
      [conversation.id]: {
        conversation,
        messages: [
          {
            id: 'm-1',
            conversationId: conversation.id,
            senderType: 'CUSTOMER',
            senderUserId: conversation.customerUserId,
            senderRole: 'CUSTOMER',
            messageType: 'TEXT',
            textContent: '请帮我确认这笔订单什么时候发出。',
            asset: null,
            cardPayload: null,
            createdAt: '2026-03-10T09:58:00Z'
          }
        ],
        context: {
          customerUserId: conversation.customerUserId,
          ownerSalesUserId: conversation.ownerSalesUserId,
          recentOrders: [
            {
              id: 'ORD-20260310-001',
              status: 'SUBMITTED',
              createdAt: '2026-03-09T10:00:00Z',
              remark: '客户要求尽快发货',
              firstItem: '人体工学椅',
              totalItems: 2
            }
          ],
          recentInquiries: [
            {
              id: 'INQ-20260308-002',
              status: 'OPEN',
              message: '想确认大货起订量和打样周期。',
              createdAt: '2026-03-08T05:20:00Z'
            }
          ],
          recentTickets: [
            {
              id: 'TIC-20260307-004',
              status: 'OPEN',
              subject: '运输中包装破损',
              createdAt: '2026-03-07T07:30:00Z'
            }
          ]
        }
      }
    },
    staff: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        displayName: '张销售',
        roles: ['SALES'],
        status: 'active'
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        displayName: '客服小刘',
        roles: ['CS'],
        status: 'active'
      }
    ]
  };
};
