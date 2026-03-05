import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchAdminInquiryRequirementProfile,
  fetchInquiries,
  fetchInquiryById,
  fetchInquiryMessages,
  postInquiryMessage
} from '../../../lib/api';
import { isMockMode } from '../../../lib/env';
import { AdminTopbar } from '../../layout/AdminTopbar';

type InquiryStatus = 'OPEN' | 'RESPONDED' | 'CLOSED';
type InquiryStatusFilter = 'ALL' | InquiryStatus;
type SenderType = 'customer' | 'staff' | 'ai';

type InquiryItem = {
  id: string;
  createdByUserId: string;
  assignedSalesUserId: string;
  orderId: string;
  skuId: string;
  message: string;
  status: InquiryStatus;
  responseNote: string;
  createdAt: string;
  updatedAt: string;
};

type InquiryMessageItem = {
  id: string;
  inquiryId: string;
  senderType: SenderType;
  senderUserId: string;
  content: string;
  createdAt: string;
};

type RequirementOrderProfile = {
  requirementNo: string;
  title: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  expectedQty: string;
  targetUnitPrice: string;
  priority: string;
  source: string;
  summary: string;
  attachments: string[];
};

const STATUS_OPTIONS: Array<{ status: InquiryStatusFilter; label: string }> = [
  { status: 'ALL', label: '全部' },
  { status: 'OPEN', label: '进行中' },
  { status: 'RESPONDED', label: '待客户' },
  { status: 'CLOSED', label: '已关闭' }
];

const MOCK_INQUIRIES: InquiryItem[] = [
  {
    id: '6b35a359-8633-48c7-b694-c4fdbb4e1519',
    createdByUserId: '2e5f2acc-fd3a-481a-8d5f-977762d16657',
    assignedSalesUserId: 'f09c98a5-a6cc-43b2-b076-f4e84d18e5a2',
    orderId: '9ea88595-8d4d-4bb9-b9c9-6b9efbbf3c7a',
    skuId: '8a0cf5fa-15f4-46aa-ac2d-4b0d8606d4ed',
    message: '我们有一批工位椅需求，想确认批量价格和交付周期。',
    status: 'OPEN',
    responseNote: '客服已接入，等待补充参数。',
    createdAt: '2026-03-03T09:20:00Z',
    updatedAt: '2026-03-04T07:10:00Z'
  },
  {
    id: 'cc5f0ae0-e5b9-44ce-b8d4-8c6f9a9f8b03',
    createdByUserId: 'ae8e8c9e-4c6f-41d8-bad7-f9a160ad23c1',
    assignedSalesUserId: 'a2dc5d6f-1283-4bf0-b9c0-a22e5d2f9e5b',
    orderId: '',
    skuId: '',
    message: '客户希望对比两款机械键盘的起订量折扣，需尽快回复。',
    status: 'RESPONDED',
    responseNote: '已发首轮报价，等待客户确认。',
    createdAt: '2026-03-02T03:40:00Z',
    updatedAt: '2026-03-04T01:05:00Z'
  },
  {
    id: 'da911f23-0f96-4a38-bca7-13ef4d6ad5e6',
    createdByUserId: '126d541a-2f13-4211-93bb-2f509cba1f9c',
    assignedSalesUserId: '24b40335-0cc5-42ff-8363-8a455f6e59e5',
    orderId: '085c0562-20b7-47f0-af54-d6af61e801f2',
    skuId: 'ae54e009-6f65-41b6-8522-9629e5f0f3ba',
    message: '这条需求已完成沟通，客户转入正式下单。',
    status: 'CLOSED',
    responseNote: '已关闭会话。',
    createdAt: '2026-03-01T05:10:00Z',
    updatedAt: '2026-03-03T12:32:00Z'
  }
];

const MOCK_MESSAGES: Record<string, InquiryMessageItem[]> = {
  '6b35a359-8633-48c7-b694-c4fdbb4e1519': [
    {
      id: '9ed0e580-7119-46af-8f00-6f0de4acc33c',
      inquiryId: '6b35a359-8633-48c7-b694-c4fdbb4e1519',
      senderType: 'customer',
      senderUserId: '2e5f2acc-fd3a-481a-8d5f-977762d16657',
      content: '我们计划采购 300 把工位椅，想看下批量价格。',
      createdAt: '2026-03-04T06:43:00Z'
    },
    {
      id: '77e3c104-2b5a-4a6a-94f0-4eeec877d200',
      inquiryId: '6b35a359-8633-48c7-b694-c4fdbb4e1519',
      senderType: 'staff',
      senderUserId: 'f09c98a5-a6cc-43b2-b076-f4e84d18e5a2',
      content: '收到，我这边先帮您确认不同材质版本的阶梯报价。',
      createdAt: '2026-03-04T06:47:00Z'
    }
  ],
  'cc5f0ae0-e5b9-44ce-b8d4-8c6f9a9f8b03': [
    {
      id: '68d06756-7237-49fe-9681-a2c7a1f2abf5',
      inquiryId: 'cc5f0ae0-e5b9-44ce-b8d4-8c6f9a9f8b03',
      senderType: 'staff',
      senderUserId: 'a2dc5d6f-1283-4bf0-b9c0-a22e5d2f9e5b',
      content: '已给您发送两档报价，辛苦确认预算区间。',
      createdAt: '2026-03-04T01:01:00Z'
    }
  ],
  'da911f23-0f96-4a38-bca7-13ef4d6ad5e6': [
    {
      id: 'f43e2e4a-f7af-4aab-b47e-18507a7bc712',
      inquiryId: 'da911f23-0f96-4a38-bca7-13ef4d6ad5e6',
      senderType: 'customer',
      senderUserId: '126d541a-2f13-4211-93bb-2f509cba1f9c',
      content: '报价确认，我们已经在系统提交订单了。',
      createdAt: '2026-03-03T12:30:00Z'
    },
    {
      id: '75b5aeed-abde-4f77-930a-db9a2d04e4f6',
      inquiryId: 'da911f23-0f96-4a38-bca7-13ef4d6ad5e6',
      senderType: 'staff',
      senderUserId: '24b40335-0cc5-42ff-8363-8a455f6e59e5',
      content: '好的，后续物流节点我们会在订单详情同步。',
      createdAt: '2026-03-03T12:32:00Z'
    }
  ]
};

const MOCK_REQUIREMENT_PROFILES: Record<string, RequirementOrderProfile> = {
  '6b35a359-8633-48c7-b694-c4fdbb4e1519': {
    requirementNo: 'REQ-20260304-001',
    title: '人体工学工位椅批量采购',
    companyName: '华东联合办公科技有限公司',
    contactName: '王女士',
    contactPhone: '138-0013-8000',
    expectedQty: '300 把',
    targetUnitPrice: '¥ 460 / 把',
    priority: '高',
    source: '小程序需求链接',
    summary: '客户要求网布靠背 + 铝合金底盘，4 月 15 日前首批交付 100 把。',
    attachments: ['工位布局图.pdf', '颜色偏好说明.docx']
  },
  'cc5f0ae0-e5b9-44ce-b8d4-8c6f9a9f8b03': {
    requirementNo: 'REQ-20260303-018',
    title: '机械键盘起订量折扣咨询',
    companyName: '北方智能制造集团',
    contactName: '刘先生',
    contactPhone: '139-0013-9000',
    expectedQty: '500 套',
    targetUnitPrice: '¥ 280 / 套',
    priority: '中',
    source: '客户自助提交',
    summary: '关注轴体寿命与售后政策，要求两档报价（300/500 套）。',
    attachments: ['规格清单.xlsx']
  },
  'da911f23-0f96-4a38-bca7-13ef4d6ad5e6': {
    requirementNo: 'REQ-20260301-006',
    title: '扩展坞补货需求',
    companyName: '明悦数字科技',
    contactName: '陈女士',
    contactPhone: '137-0013-7000',
    expectedQty: '1000 台',
    targetUnitPrice: '¥ 95 / 台',
    priority: '低',
    source: '订单售后衍生',
    summary: '会话已关闭，客户转入正式下单流程。',
    attachments: []
  }
};

// 安全读取字符串并去空白，统一前端容错行为。
const safeText = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

// 将后端状态值归一化到页面识别的状态集合。
const normalizeStatus = (value: unknown): InquiryStatus => {
  const status = String(value || '').toUpperCase();
  if (status === 'RESPONDED') return 'RESPONDED';
  if (status === 'CLOSED') return 'CLOSED';
  return 'OPEN';
};

// 归一化单条询价会话。
const normalizeInquiry = (input: unknown): InquiryItem | null => {
  const item = input as {
    id?: string;
    createdByUserId?: string;
    assignedSalesUserId?: string | null;
    orderId?: string | null;
    skuId?: string | null;
    message?: string;
    status?: string;
    responseNote?: string | null;
    createdAt?: string;
    updatedAt?: string | null;
  };

  if (!item?.id) {
    return null;
  }

  return {
    id: item.id,
    createdByUserId: safeText(item.createdByUserId, '-'),
    assignedSalesUserId: safeText(item.assignedSalesUserId, '-'),
    orderId: safeText(item.orderId, '-'),
    skuId: safeText(item.skuId, '-'),
    message: safeText(item.message, '无消息内容'),
    status: normalizeStatus(item.status),
    responseNote: safeText(item.responseNote, ''),
    createdAt: safeText(item.createdAt),
    updatedAt: safeText(item.updatedAt)
  };
};

// 归一化询价列表响应。
const normalizeInquiryList = (payload: unknown): InquiryItem[] => {
  const items = Array.isArray((payload as { items?: unknown[] })?.items)
    ? ((payload as { items?: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => normalizeInquiry(item))
    .filter(Boolean) as InquiryItem[];
};

// 归一化单条消息。
const normalizeInquiryMessage = (input: unknown): InquiryMessageItem | null => {
  const item = input as {
    id?: string;
    inquiryId?: string;
    senderType?: string;
    senderUserId?: string | null;
    content?: string;
    createdAt?: string;
  };

  if (!item?.id || !item?.inquiryId) {
    return null;
  }

  const rawSenderType = String(item.senderType || '').toLowerCase();
  let senderType: SenderType = 'staff';
  if (rawSenderType === 'customer' || rawSenderType === 'staff' || rawSenderType === 'ai') {
    senderType = rawSenderType;
  }

  return {
    id: item.id,
    inquiryId: item.inquiryId,
    senderType,
    senderUserId: safeText(item.senderUserId, '-'),
    content: safeText(item.content, ''),
    createdAt: safeText(item.createdAt)
  };
};

// 归一化消息列表并按时间升序排列。
const normalizeMessageList = (payload: unknown): InquiryMessageItem[] => {
  const items = Array.isArray((payload as { items?: unknown[] })?.items)
    ? ((payload as { items?: unknown[] }).items as unknown[])
    : [];

  return items
    .map((item) => normalizeInquiryMessage(item))
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) as InquiryMessageItem[];
};

// 统一时间展示格式。
const formatDateTime = (value: string) => {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// 展示短 ID，提升列表可读性。
const formatShortId = (id: string) => {
  if (!id || id.length < 8) {
    return id || '-';
  }
  return id.slice(0, 8);
};

// 将状态 code 映射到中文标签。
const getStatusLabel = (status: InquiryStatus) => {
  const matched = STATUS_OPTIONS.find((item) => item.status === status);
  return matched?.label || status;
};

// 根据状态返回标签样式。
const getStatusClassName = (status: InquiryStatus) => {
  if (status === 'OPEN') {
    return 'bg-blue-100 text-blue-700 border border-blue-200';
  }
  if (status === 'RESPONDED') {
    return 'bg-amber-100 text-amber-700 border border-amber-200';
  }
  return 'bg-slate-100 text-slate-600 border border-slate-200';
};

// 渲染消息发送方显示名。
const getSenderLabel = (message: InquiryMessageItem) => {
  if (message.senderType === 'customer') {
    return '客户';
  }
  if (message.senderType === 'ai') {
    return 'AI 助手';
  }
  return '客服';
};

// 构建可复制的询价深链 URL。
const buildInquiryLink = (inquiryId: string) => {
  if (typeof window === 'undefined') {
    return `/inquiries.html?inquiryId=${encodeURIComponent(inquiryId)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('inquiryId', inquiryId);
  return url.toString();
};

// 读取首次进入页面时的 inquiryId 参数。
const readInitialInquiryId = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  const raw = new URLSearchParams(window.location.search).get('inquiryId');
  return safeText(raw);
};

// 构建右侧“需求订单信息”视图模型（无后端详情接口时提供兜底）。
const buildRequirementOrderProfile = (inquiry: InquiryItem | null): RequirementOrderProfile | null => {
  if (!inquiry) {
    return null;
  }

  const mock = MOCK_REQUIREMENT_PROFILES[inquiry.id];
  if (mock) {
    return mock;
  }

  // TODO: replace with real requirement-order detail API when backend provides it.
  return {
    requirementNo: `REQ-${formatShortId(inquiry.id)}`,
    title: '待补充需求主题',
    companyName: `客户 ${formatShortId(inquiry.createdByUserId)}`,
    contactName: '未提供',
    contactPhone: '未提供',
    expectedQty: '待确认',
    targetUnitPrice: '待确认',
    priority: inquiry.status === 'OPEN' ? '高' : inquiry.status === 'RESPONDED' ? '中' : '低',
    source: '需求链接',
    summary: inquiry.message,
    attachments: []
  };
};

const normalizeRequirementOrderProfile = (payload: unknown, inquiry: InquiryItem | null): RequirementOrderProfile | null => {
  if (!payload || typeof payload !== 'object') {
    return buildRequirementOrderProfile(inquiry);
  }
  const record = payload as {
    requirementNo?: string;
    title?: string;
    companyName?: string;
    contactName?: string;
    contactPhone?: string;
    expectedQty?: string;
    targetUnitPrice?: string;
    priority?: string;
    source?: string;
    summary?: string;
    attachments?: unknown[];
  };

  return {
    requirementNo: safeText(record.requirementNo, inquiry ? `REQ-${formatShortId(inquiry.id)}` : 'REQ-未知'),
    title: safeText(record.title, '待补充需求主题'),
    companyName: safeText(record.companyName, inquiry ? `客户 ${formatShortId(inquiry.createdByUserId)}` : '客户信息待补充'),
    contactName: safeText(record.contactName, '未提供'),
    contactPhone: safeText(record.contactPhone, '未提供'),
    expectedQty: safeText(record.expectedQty, '待确认'),
    targetUnitPrice: safeText(record.targetUnitPrice, '待确认'),
    priority: safeText(record.priority, '中'),
    source: safeText(record.source, '需求链接'),
    summary: safeText(record.summary, inquiry?.message || '暂无补充说明'),
    attachments: Array.isArray(record.attachments)
      ? record.attachments.filter((item): item is string => typeof item === 'string')
      : []
  };
};

// 在线客服页：管理询价会话列表、线程消息和快捷回复。
export const InquiriesPage = () => {
  const [statusFilter, setStatusFilter] = useState<InquiryStatusFilter>('ALL');
  const [keyword, setKeyword] = useState('');
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const [activeInquiryId, setActiveInquiryId] = useState<string>('');
  const [activeInquiry, setActiveInquiry] = useState<InquiryItem | null>(null);
  const [requirementProfile, setRequirementProfile] = useState<RequirementOrderProfile | null>(null);

  const [messages, setMessages] = useState<InquiryMessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');

  const [inputContent, setInputContent] = useState('');
  const [sending, setSending] = useState(false);
  const [copyTip, setCopyTip] = useState('');

  const initialInquiryIdRef = useRef(readInitialInquiryId());
  const copyTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 关键词过滤列表（基于会话ID/消息/客户ID/业务员ID）。
  const filteredInquiries = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) {
      return inquiries;
    }

    return inquiries.filter((item) => {
      return (
        item.id.toLowerCase().includes(value) ||
        item.message.toLowerCase().includes(value) ||
        item.createdByUserId.toLowerCase().includes(value) ||
        item.assignedSalesUserId.toLowerCase().includes(value)
      );
    });
  }, [inquiries, keyword]);

  // 当前会话对应的可分享链接。
  const activeInquiryLink = useMemo(() => {
    if (!activeInquiryId) {
      return '';
    }
    return buildInquiryLink(activeInquiryId);
  }, [activeInquiryId]);

  // 加载询价列表（按状态过滤，mock/dev 双模式）。
  const loadInquiries = useCallback(async () => {
    setListLoading(true);
    setListError('');

    try {
      if (isMockMode) {
        const mockItems = statusFilter === 'ALL'
          ? MOCK_INQUIRIES
          : MOCK_INQUIRIES.filter((item) => item.status === statusFilter);
        setInquiries(mockItems);
        return;
      }

      const params: { page: number; pageSize: number; status?: InquiryStatus } = {
        page: 1,
        pageSize: 100
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await fetchInquiries(params);

      if (response.status !== 200 || !response.data) {
        throw new Error('加载需求列表失败');
      }

      setInquiries(normalizeInquiryList(response.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载需求列表失败';
      setListError(message || '加载需求列表失败');
      setInquiries([]);
    } finally {
      setListLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

  useEffect(() => {
    if (filteredInquiries.length === 0) {
      setActiveInquiryId('');
      return;
    }

    if (activeInquiryId && filteredInquiries.some((item) => item.id === activeInquiryId)) {
      return;
    }

    const initialInquiryId = initialInquiryIdRef.current;
    if (initialInquiryId) {
      const initialMatch = filteredInquiries.find((item) => item.id === initialInquiryId);
      if (initialMatch) {
        setActiveInquiryId(initialMatch.id);
        initialInquiryIdRef.current = '';
        return;
      }
    }

    setActiveInquiryId(filteredInquiries[0].id);
  }, [activeInquiryId, filteredInquiries]);

  useEffect(() => {
    if (!activeInquiryId) {
      setActiveInquiry(null);
      setRequirementProfile(null);
      setMessages([]);
      setMessagesError('');
      return;
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('inquiryId', activeInquiryId);
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }

    let cancelled = false;

    const loadThread = async () => {
      setMessagesLoading(true);
      setMessagesError('');

      try {
        if (isMockMode) {
          const mockInquiry = MOCK_INQUIRIES.find((item) => item.id === activeInquiryId) || null;
          const mockMessages = MOCK_MESSAGES[activeInquiryId] || [];
          if (!cancelled) {
            setActiveInquiry(mockInquiry);
            setRequirementProfile(buildRequirementOrderProfile(mockInquiry));
            setMessages(mockMessages);
          }
          return;
        }

        const [inquiryResponse, messageResponse, profileResponse] = await Promise.all([
          fetchInquiryById(activeInquiryId),
          fetchInquiryMessages(activeInquiryId, { page: 1, pageSize: 200 }),
          fetchAdminInquiryRequirementProfile(activeInquiryId)
        ]);

        if (cancelled) {
          return;
        }

        const detail = inquiryResponse.status === 200 ? normalizeInquiry(inquiryResponse.data) : null;
        const resolvedInquiry = detail || inquiries.find((item) => item.id === activeInquiryId) || null;
        setActiveInquiry(resolvedInquiry);
        if (profileResponse.status === 200) {
          setRequirementProfile(normalizeRequirementOrderProfile(profileResponse.data, resolvedInquiry));
        } else {
          setRequirementProfile(buildRequirementOrderProfile(resolvedInquiry));
        }

        if (messageResponse.status !== 200 || !messageResponse.data) {
          setMessages([]);
          setMessagesError('加载会话消息失败。');
          return;
        }

        setMessages(normalizeMessageList(messageResponse.data));
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : '加载会话消息失败';
        setMessages([]);
        setRequirementProfile(buildRequirementOrderProfile(inquiries.find((item) => item.id === activeInquiryId) || null));
        setMessagesError(message || '加载会话消息失败');
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    };

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [activeInquiryId, inquiries]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messagesLoading]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // 复制当前询价深链。
  const handleCopyLink = useCallback(async (inquiryId: string) => {
    if (!inquiryId) {
      return;
    }
    const link = buildInquiryLink(inquiryId);

    try {
      await navigator.clipboard.writeText(link);
      setCopyTip('需求链接已复制。');
    } catch {
      window.prompt('复制需求链接：', link);
      setCopyTip('已打开复制弹窗。');
    }

    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyTip('');
    }, 2000);
  }, []);

  // 发送客服消息。
  const handleSendMessage = useCallback(
    async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      const content = inputContent.trim();
      if (!activeInquiryId || !content || sending) {
        return;
      }

      setMessagesError('');
      setSending(true);

      try {
        if (isMockMode) {
          const createdAt = new Date().toISOString();
          const created: InquiryMessageItem = {
            id: `mock-${Date.now()}`,
            inquiryId: activeInquiryId,
            senderType: 'staff',
            senderUserId: 'mock-support',
            content,
            createdAt
          };
          setMessages((prev) => [...prev, created]);
          setInputContent('');
          return;
        }

        const response = await postInquiryMessage(activeInquiryId, { content });
        if (response.status !== 201 || !response.data) {
          throw new Error('发送消息失败');
        }

        const created = normalizeInquiryMessage(response.data);
        if (!created) {
          throw new Error('消息返回格式错误');
        }

        setMessages((prev) => [...prev, created]);
        setInputContent('');
      } catch (error) {
        const message = error instanceof Error ? error.message : '发送消息失败';
        setMessagesError(message || '发送消息失败');
      } finally {
        setSending(false);
      }
    },
    [activeInquiryId, inputContent, sending]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <AdminTopbar
        searchPlaceholder="搜索需求链接、客户或会话..."
        leftSlot={
          <div className="flex items-center gap-3 text-primary dark:text-blue-400">
            <span className="material-symbols-outlined text-3xl">support_agent</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">在线客服工作台</h1>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex h-full min-h-0 flex-1 overflow-hidden bg-background-light dark:bg-background-dark lg:flex">
          <aside className="flex h-full w-full shrink-0 flex-col border-r border-border-color bg-surface-light dark:bg-surface-dark lg:w-72 xl:w-80 2xl:w-96">
            <div className="border-b border-border-color p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">需求列表</h2>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{inquiries.length} 条</span>
              </div>
              <div className="mb-3 flex gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const active = option.status === statusFilter;
                  return (
                    <button
                      key={option.status}
                      type="button"
                      className={
                        active
                          ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm'
                          : 'rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }
                      onClick={() => setStatusFilter(option.status)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <label className="relative block">
                <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-2.5 text-base text-slate-400">search</span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  placeholder="按需求链接或客户ID搜索"
                  value={keyword}
                  onChange={(event) => setKeyword(event.currentTarget.value)}
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto">
              {listLoading ? <div className="px-4 py-8 text-sm text-slate-500">正在加载需求列表...</div> : null}
              {!listLoading && listError ? <div className="px-4 py-8 text-sm text-red-600">{listError}</div> : null}
              {!listLoading && !listError && filteredInquiries.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">当前筛选条件下暂无需求会话。</div>
              ) : null}

              {!listLoading &&
                !listError &&
                filteredInquiries.map((item) => {
                  const active = item.id === activeInquiryId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveInquiryId(item.id)}
                      className={
                        active
                          ? 'w-full border-b border-border-color border-l-4 border-l-primary bg-primary/5 px-4 py-3 text-left'
                          : 'w-full border-b border-border-color border-l-4 border-l-transparent px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className={active ? 'text-xs font-bold text-primary' : 'text-xs font-semibold text-slate-500'}>#{formatShortId(item.id)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getStatusClassName(item.status)}`}>{getStatusLabel(item.status)}</span>
                      </div>
                      <p className={`mb-2 line-clamp-2 text-xs ${active ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>{item.message}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>客户: {formatShortId(item.createdByUserId)}</span>
                        <span>{formatDateTime(item.updatedAt || item.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900/40 lg:flex-[1.4] xl:flex-[1.8]">
            {activeInquiry ? (
              <>
                <div className="sticky top-0 z-10 border-b border-border-color bg-white/95 px-5 py-4 backdrop-blur-sm dark:bg-slate-900/95">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">需求链接 #{formatShortId(activeInquiry.id)}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClassName(activeInquiry.status)}`}>{getStatusLabel(activeInquiry.status)}</span>
                      </div>
                      <p className="text-xs text-slate-500">最近更新时间：{formatDateTime(activeInquiry.updatedAt || activeInquiry.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyLink(activeInquiry.id)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                    >
                      复制需求链接
                    </button>
                  </div>
                  {copyTip ? <div className="text-xs text-emerald-600">{copyTip}</div> : null}
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5 dark:bg-slate-900/20">
                  {messagesLoading ? <div className="text-sm text-slate-500">正在加载会话消息...</div> : null}
                  {!messagesLoading && messagesError ? <div className="text-sm text-red-600">{messagesError}</div> : null}
                  {!messagesLoading && !messagesError && messages.length === 0 ? (
                    <div className="text-sm text-slate-500">当前会话暂无消息，客服可直接发起沟通。</div>
                  ) : null}

                  {!messagesLoading &&
                    !messagesError &&
                    messages.map((message) => {
                      const fromCustomer = message.senderType === 'customer';
                      return (
                        <div key={message.id} className={fromCustomer ? 'flex items-start gap-3' : 'flex items-start gap-3 justify-end'}>
                          {fromCustomer ? <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200" /> : null}
                          <div className={fromCustomer ? 'max-w-[85%]' : 'max-w-[85%] text-right'}>
                            <div className={`mb-1 text-[11px] text-slate-500 ${fromCustomer ? '' : 'text-right'}`}>{getSenderLabel(message)}</div>
                            <div
                              className={
                                fromCustomer
                                  ? 'rounded-2xl rounded-tl-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : 'rounded-2xl rounded-tr-none bg-primary px-4 py-3 text-sm text-white shadow-sm'
                              }
                            >
                              {message.content}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-400">{formatDateTime(message.createdAt)}</div>
                          </div>
                          {!fromCustomer ? <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15" /> : null}
                        </div>
                      );
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <form className="border-t border-border-color bg-white p-4 dark:bg-surface-dark" onSubmit={(event) => void handleSendMessage(event)}>
                  <textarea
                    className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    rows={4}
                    placeholder="输入消息并发送给客户..."
                    value={inputContent}
                    onChange={(event) => setInputContent(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Enter 发送，Shift + Enter 换行</span>
                    <button
                      type="submit"
                      disabled={sending || !inputContent.trim()}
                      className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? '发送中...' : '发送'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">请先从左侧选择一条需求会话。</div>
            )}
          </section>

          <aside className="hidden h-full w-72 shrink-0 border-l border-border-color bg-surface-light px-4 py-5 dark:bg-surface-dark xl:block 2xl:w-80">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">需求订单信息</h3>
            {activeInquiry && requirementProfile ? (
              <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">需求单号</p>
                  <p className="mt-0.5 font-semibold">{requirementProfile.requirementNo}</p>
                  <p className="mt-2 text-xs text-slate-500">需求主题</p>
                  <p className="mt-0.5 text-sm font-medium leading-5">{requirementProfile.title}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">公司 / 联系人</p>
                  <p className="mt-0.5 font-medium">{requirementProfile.companyName}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{requirementProfile.contactName} · {requirementProfile.contactPhone}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">需求数量</p>
                      <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{requirementProfile.expectedQty}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">目标单价</p>
                      <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{requirementProfile.targetUnitPrice}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">优先级</p>
                      <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{requirementProfile.priority}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">来源</p>
                      <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{requirementProfile.source}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs text-slate-500">需求说明</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{requirementProfile.summary}</p>
                  <p className="mt-3 text-xs text-slate-500">附件</p>
                  {requirementProfile.attachments.length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {requirementProfile.attachments.map((name) => (
                        <li key={name}>- {name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">暂无附件</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-1 text-xs text-slate-500">需求链接</p>
                  <div className="flex gap-2">
                    <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" readOnly value={activeInquiryLink} />
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      onClick={() => void handleCopyLink(activeInquiry.id)}
                    >
                      复制
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">客户ID: {formatShortId(activeInquiry.createdByUserId)} · 业务员ID: {formatShortId(activeInquiry.assignedSalesUserId)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">暂无已选需求会话。</p>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
};
