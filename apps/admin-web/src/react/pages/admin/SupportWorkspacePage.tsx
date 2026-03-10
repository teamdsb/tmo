import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Headphones,
  Image as ImageIcon,
  Package,
  RefreshCw,
  Send,
  ShoppingBag,
  UserCheck,
  UserPlus
} from 'lucide-react';

import { AdminTopbar } from '../../layout/AdminTopbar';
import { getCurrentSession } from '../../../lib/auth';
import { apiBaseUrl, isMockMode } from '../../../lib/env';
import {
  claimAdminSupportConversation,
  fetchAdminSupportConversation,
  fetchAdminSupportConversations,
  fetchOrders,
  fetchProducts,
  fetchStaffUsers,
  releaseAdminSupportConversation,
  sendSupportConversationMessage,
  transferAdminSupportConversation,
  uploadSupportConversationImage
} from '../../../lib/api';
import {
  buildOrderCardPayload,
  buildProductCardPayload,
  canTransferSupportConversation,
  createMockSupportData,
  formatSupportRelativeTime,
  formatSupportTime,
  getSupportConversationStatusClass,
  getSupportConversationStatusLabel,
  normalizeStaffOptions,
  normalizeSupportConversation,
  normalizeSupportConversationDetail,
  type StaffOption,
  type SupportConversationDetail,
  type SupportConversationSummary,
  type SupportMessage
} from './supportWorkspaceData';

const buildWsUrl = () => {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (!base) {
    return `${protocol}//${window.location.host}/ws/support`;
  }
  if (base.startsWith('http://')) {
    return `${base.replace(/^http:\/\//, 'ws://')}/ws/support`;
  }
  if (base.startsWith('https://')) {
    return `${base.replace(/^https:\/\//, 'wss://')}/ws/support`;
  }
  return `${protocol}//${window.location.host}${base}/ws/support`;
};

const normalizeConversations = (payload) => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((item) => normalizeSupportConversation(item)).filter(Boolean);
};

const getCurrentRole = () => {
  return String(getCurrentSession()?.currentRole || '').trim().toUpperCase();
};

const roleCanRelease = (conversation) => {
  const currentRole = getCurrentRole();
  if (!conversation) return false;
  if (currentRole === 'ADMIN' || currentRole === 'BOSS' || currentRole === 'CS' || currentRole === 'MANAGER') return true;
  return conversation.assigneeUserId && conversation.assigneeUserId === String(getCurrentSession()?.user?.id || '');
};

const customerDisplayLabel = (conversation) => {
  if (!conversation) return '请选择会话';
  return conversation.customerDisplayName || conversation.customerUserId.slice(0, 8);
};

const customerPhoneLabel = (conversation) => {
  if (!conversation) return '-';
  return conversation.customerPhone || '-';
};

const MessageBubble = ({ message }) => {
  const isCustomer = message.senderType === 'CUSTOMER';
  const isSystem = message.senderType === 'SYSTEM';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {message.textContent || '系统消息'}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] rounded-2xl border px-4 py-3 shadow-sm ${isCustomer ? 'border-slate-200 bg-white text-slate-900 rounded-tl-none' : 'border-blue-500 bg-blue-600 text-white rounded-tr-none'}`}>
        {message.asset?.url ? (
          <img className="mb-3 max-h-52 w-full rounded-xl object-cover" src={message.asset.url} alt={message.asset.fileName || '聊天图片'} />
        ) : null}
        {message.textContent ? <p className="text-sm leading-6">{message.textContent}</p> : null}
        {message.cardPayload ? (
          <div className={`mt-3 rounded-xl border p-3 ${isCustomer ? 'border-slate-200 bg-slate-50' : 'border-blue-300 bg-blue-500/70'}`}>
            <p className={`text-sm font-semibold ${isCustomer ? 'text-slate-900' : 'text-white'}`}>{message.cardPayload.title || '卡片消息'}</p>
            {message.cardPayload.subtitle ? (
              <p className={`mt-1 text-xs ${isCustomer ? 'text-slate-500' : 'text-blue-100'}`}>{message.cardPayload.subtitle}</p>
            ) : null}
          </div>
        ) : null}
        <div className={`mt-2 flex items-center gap-1 text-[11px] ${isCustomer ? 'text-slate-400' : 'text-blue-100'}`}>
          <span>{formatSupportTime(message.createdAt, true)}</span>
          {!isCustomer ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        </div>
      </div>
    </div>
  );
};

export const SupportWorkspacePage = () => {
  const mockSeed = useMemo(() => (isMockMode ? createMockSupportData() : null), []);
  const [scope, setScope] = useState('mine');
  const [conversations, setConversations] = useState<SupportConversationSummary[]>(mockSeed?.conversations || []);
  const [activeConversationId, setActiveConversationId] = useState(mockSeed?.conversations[0]?.id || '');
  const [conversationDetail, setConversationDetail] = useState<SupportConversationDetail | null>(mockSeed?.details?.[mockSeed.conversations[0]?.id || ''] || null);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>(mockSeed?.staff || []);
  const [productOptions, setProductOptions] = useState([]);
  const [draft, setDraft] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [loading, setLoading] = useState(!isMockMode);
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConversation = useMemo(() => {
    return conversations.find((item) => item.id === activeConversationId) || null;
  }, [activeConversationId, conversations]);

  const reloadConversations = useCallback(async () => {
    if (isMockMode) {
      return;
    }
    const response = await fetchAdminSupportConversations({ page: 1, pageSize: 50, scope });
    if (response.status !== 200) {
      throw new Error(response?.data?.message || '加载会话失败');
    }
    const items = normalizeConversations(response.data);
    setConversations(items);
    setActiveConversationId((current) => current || items[0]?.id || '');
  }, [scope]);

  const reloadConversationDetail = useCallback(async (conversationId) => {
    if (!conversationId) {
      setConversationDetail(null);
      return;
    }
    if (isMockMode) {
      setConversationDetail(mockSeed?.details?.[conversationId] || null);
      return;
    }
    const response = await fetchAdminSupportConversation(conversationId);
    if (response.status !== 200) {
      throw new Error(response?.data?.message || '加载会话详情失败');
    }
    setConversationDetail(normalizeSupportConversationDetail(response.data));
  }, [mockSeed]);

  const reloadReferenceData = useCallback(async () => {
    if (isMockMode) {
      return;
    }
    const [staffResponse, productResponse] = await Promise.all([
      fetchStaffUsers({ page: 1, pageSize: 100 }),
      fetchProducts({ page: 1, pageSize: 12 })
    ]);
    setStaffOptions(normalizeStaffOptions(staffResponse?.data));
    setProductOptions(Array.isArray(productResponse?.data?.items) ? productResponse.data.items : []);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      await Promise.all([reloadConversations(), reloadReferenceData()]);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '初始化客服工作台失败');
    } finally {
      setLoading(false);
    }
  }, [reloadConversations, reloadReferenceData]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    void reloadConversationDetail(activeConversationId);
  }, [activeConversationId, reloadConversationDetail]);

  useEffect(() => {
    if (isMockMode) {
      return undefined;
    }
    const token = String(getCurrentSession()?.accessToken || '');
    let pollTimer = null;
    if (!token) {
      pollTimer = window.setInterval(() => {
        void reloadConversations();
        if (activeConversationId) {
          void reloadConversationDetail(activeConversationId);
        }
      }, 5000);
      return () => {
        if (pollTimer) {
          window.clearInterval(pollTimer);
        }
      };
    }
    const socket = new WebSocket(buildWsUrl());
    socket.onopen = () => {
      setStatusMessage('');
    };
    socket.onerror = () => {
      setStatusMessage('实时连接中断，页面仍可手动刷新。');
      if (!pollTimer) {
        pollTimer = window.setInterval(() => {
          void reloadConversations();
          if (activeConversationId) {
            void reloadConversationDetail(activeConversationId);
          }
        }, 5000);
      }
    };
    socket.onclose = () => {
      if (!pollTimer) {
        pollTimer = window.setInterval(() => {
          void reloadConversations();
          if (activeConversationId) {
            void reloadConversationDetail(activeConversationId);
          }
        }, 5000);
      }
    };
    socket.onmessage = () => {
      void reloadConversations();
      if (activeConversationId) {
        void reloadConversationDetail(activeConversationId);
      }
    };
    return () => {
      socket.close();
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
    };
  }, [activeConversationId, reloadConversations, reloadConversationDetail]);

  const handleClaim = async () => {
    if (!activeConversationId || isMockMode) {
      return;
    }
    const response = await claimAdminSupportConversation(activeConversationId);
    if (response.status !== 200) {
      setStatusMessage(response?.data?.message || '认领失败');
      return;
    }
    await reloadConversations();
    await reloadConversationDetail(activeConversationId);
  };

  const handleRelease = async () => {
    if (!activeConversationId || isMockMode) {
      return;
    }
    const response = await releaseAdminSupportConversation(activeConversationId);
    if (response.status !== 200) {
      setStatusMessage(response?.data?.message || '释放失败');
      return;
    }
    await reloadConversations();
    await reloadConversationDetail(activeConversationId);
  };

  const handleTransfer = async () => {
    if (!activeConversationId || !transferTargetId || isMockMode) {
      return;
    }
    const target = staffOptions.find((item) => item.id === transferTargetId);
    if (!target) {
      setStatusMessage('请选择有效的转接坐席');
      return;
    }
    const nextRole = target.roles.find((role) => role === 'CS') || 'CS';
    const response = await transferAdminSupportConversation(activeConversationId, {
      toUserId: target.id,
      toRole: nextRole
    });
    if (response.status !== 200) {
      setStatusMessage(response?.data?.message || '转接失败');
      return;
    }
    setTransferTargetId('');
    await reloadConversations();
    await reloadConversationDetail(activeConversationId);
  };

  const appendMessage = (message) => {
    setConversationDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: [...current.messages, message]
      };
    });
  };

  const handleSendText = async () => {
    if (!activeConversationId || !draft.trim() || sending) {
      return;
    }
    setSending(true);
    try {
      const response = await sendSupportConversationMessage(activeConversationId, {
        messageType: 'TEXT',
        text: draft.trim()
      });
      if (response.status !== 201) {
        throw new Error(response?.data?.message || '发送失败');
      }
      const normalized = normalizeSupportMessage(response.data);
      if (normalized) {
        appendMessage(normalized);
      }
      setDraft('');
      await reloadConversations();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleUploadImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !activeConversationId) {
      return;
    }
    setSending(true);
    try {
      const uploadResponse = await uploadSupportConversationImage(activeConversationId, file);
      if (uploadResponse.status !== 201) {
        throw new Error(uploadResponse?.data?.message || '上传失败');
      }
      const messageResponse = await sendSupportConversationMessage(activeConversationId, {
        messageType: 'IMAGE',
        assetId: uploadResponse.data.id
      });
      if (messageResponse.status !== 201) {
        throw new Error(messageResponse?.data?.message || '发送失败');
      }
      const normalized = normalizeSupportMessage(messageResponse.data);
      if (normalized) {
        appendMessage(normalized);
      }
      await reloadConversations();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '图片发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSendOrderCard = async (order) => {
    if (!activeConversationId) {
      return;
    }
    const response = await sendSupportConversationMessage(activeConversationId, {
      messageType: 'ORDER_CARD',
      cardPayload: buildOrderCardPayload(order)
    });
    if (response.status !== 201) {
      setStatusMessage(response?.data?.message || '订单卡片发送失败');
      return;
    }
    const normalized = normalizeSupportMessage(response.data);
    if (normalized) {
      appendMessage(normalized);
    }
    await reloadConversations();
  };

  const handleSendProductCard = async (product) => {
    if (!activeConversationId) {
      return;
    }
    const response = await sendSupportConversationMessage(activeConversationId, {
      messageType: 'PRODUCT_CARD',
      cardPayload: buildProductCardPayload({
        title: String(product?.name || '商品卡片'),
        subtitle: '点击查看商品详情',
        productId: String(product?.id || ''),
        imageUrl: String(product?.coverImageUrl || ''),
        linkUrl: `/goods/${String(product?.id || '')}`
      })
    });
    if (response.status !== 201) {
      setStatusMessage(response?.data?.message || '商品卡片发送失败');
      return;
    }
    const normalized = normalizeSupportMessage(response.data);
    if (normalized) {
      appendMessage(normalized);
    }
    await reloadConversations();
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminTopbar
        title="在线客服工作台"
        subtitle="认领、转接并实时处理客户消息。"
        actions={(
          <button
            type="button"
            onClick={() => void initialize()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        )}
      />

      <div className="grid min-h-[calc(100vh-88px)] grid-cols-12 gap-4 p-4">
        <section className="col-span-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">会话列表</p>
                <p className="mt-1 text-xs text-slate-500">待领取 / 我的会话 / 未读</p>
              </div>
              <Headphones className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['mine', 'unassigned', 'unread'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScope(item)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${scope === item ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {item === 'mine' ? '我的会话' : item === 'unassigned' ? '待领取' : '未读'}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-6 text-sm text-slate-500">正在加载会话...</div>
            ) : conversations.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500">当前没有匹配会话</div>
            ) : conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConversationId(conversation.id)}
                className={`flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 ${conversation.id === activeConversationId ? 'bg-blue-50' : 'bg-white'}`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <Headphones className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{customerDisplayLabel(conversation)}</p>
                    <span className="text-[11px] text-slate-400">{formatSupportRelativeTime(conversation.lastMessageAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{customerPhoneLabel(conversation)}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{conversation.lastMessagePreview || '暂无消息'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getSupportConversationStatusClass(conversation.status)}`}>
                      {getSupportConversationStatusLabel(conversation.status)}
                    </span>
                    {conversation.staffUnreadCount > 0 ? (
                      <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {conversation.staffUnreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="col-span-6 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="text-base font-semibold text-slate-900">{activeConversation ? customerDisplayLabel(activeConversation) : '请选择会话'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {activeConversation ? `${customerPhoneLabel(activeConversation)} · ${activeConversation?.assigneeRole ? `当前坐席：${activeConversation.assigneeRole}` : '当前未分配坐席'}` : '当前未分配坐席'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!activeConversationId || isMockMode}
                onClick={() => void handleClaim()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4" />
                认领
              </button>
              <button
                type="button"
                disabled={!activeConversationId || !roleCanRelease(activeConversation) || isMockMode}
                onClick={() => void handleRelease()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clock3 className="h-4 w-4" />
                释放
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-6 py-5">
            {conversationDetail?.messages?.length ? conversationDetail.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            )) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                选择会话后开始处理客户消息
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white px-6 py-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!activeConversationId || sending}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
              >
                <ImageIcon className="h-4 w-4" />
                发送图片
              </button>
              {conversationDetail?.context?.recentOrders?.slice(0, 2).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  disabled={!activeConversationId || sending}
                  onClick={() => void handleSendOrderCard(order)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                >
                  <Package className="h-4 w-4" />
                  发订单卡片
                </button>
              ))}
              {productOptions.slice(0, 2).map((product) => (
                <button
                  key={String(product.id)}
                  type="button"
                  disabled={!activeConversationId || sending}
                  onClick={() => void handleSendProductCard(product)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                >
                  <ShoppingBag className="h-4 w-4" />
                  发商品卡片
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder="输入回复内容..."
                className="min-h-[88px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
              />
              <button
                type="button"
                disabled={!activeConversationId || !draft.trim() || sending}
                onClick={() => void handleSendText()}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
            {statusMessage ? <p className="mt-3 text-xs text-amber-600">{statusMessage}</p> : null}
          </div>
        </section>

        <aside className="col-span-3 flex min-h-0 flex-col gap-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-900">会话分配</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">客服沟通由 CS 负责；管理员可协助分配，但转接目标仅限 CS。</p>
            <select
              value={transferTargetId}
              onChange={(event) => setTransferTargetId(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none"
            >
              <option value="">选择目标坐席</option>
              {staffOptions
                .filter((item) => item.status === 'active' && Array.isArray(item.roles) && item.roles.includes('CS'))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} · {(item.roles || []).join('/')}
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!activeConversationId || !transferTargetId || !canTransferSupportConversation(getCurrentRole()) || isMockMode}
              onClick={() => void handleTransfer()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <UserPlus className="h-4 w-4" />
              转移会话
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">客户上下文</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">客户</dt>
                <dd className="mt-1 font-medium text-slate-900">{conversationDetail?.context?.customerUserId || '--'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">归属销售</dt>
                <dd className="mt-1 font-medium text-slate-900">{conversationDetail?.context?.ownerSalesUserId || '--'}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">最近订单</p>
            <div className="mt-3 space-y-3">
              {conversationDetail?.context?.recentOrders?.length ? conversationDetail.context.recentOrders.map((order) => (
                <div key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{order.firstItem || '订单商品'} · {order.status}</p>
                </div>
              )) : <p className="text-xs text-slate-500">暂无订单上下文</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">询价 / 售后</p>
            <div className="mt-3 space-y-3">
              {conversationDetail?.context?.recentInquiries?.slice(0, 2).map((inquiry) => (
                <div key={inquiry.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{inquiry.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{inquiry.message}</p>
                </div>
              ))}
              {conversationDetail?.context?.recentTickets?.slice(0, 2).map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{ticket.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{ticket.subject}</p>
                </div>
              ))}
              {(!conversationDetail?.context?.recentInquiries?.length && !conversationDetail?.context?.recentTickets?.length) ? (
                <p className="text-xs text-slate-500">暂无售前/售后上下文</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
};
