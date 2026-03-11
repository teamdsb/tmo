import { useEffect, useSyncExternalStore } from 'react';

import { getCurrentSession } from '../../lib/auth';
import { apiBaseUrl, isMockMode } from '../../lib/env';
import { fetchAdminSupportConversations } from '../../lib/api';
import {
  createMockSupportData,
  normalizeSupportConversation,
  type SupportConversationSummary
} from '../pages/admin/supportWorkspaceData';

type AdminSupportToast = {
  key: string;
  conversationId: string;
  title: string;
  preview: string;
};

type AdminSupportNotificationState = {
  enabled: boolean;
  initialized: boolean;
  unreadCount: number;
  items: SupportConversationSummary[];
  latestToast: AdminSupportToast | null;
  revision: number;
};

type ApplyOptions = {
  emitToast?: boolean;
};

const MOCK_UPDATE_EVENT = 'tmo:admin-support:mock-update';
const POLL_INTERVAL_MS = 5000;
const SUPPORT_NOTIFICATION_ROLES = new Set(['CS', 'MANAGER', 'BOSS', 'ADMIN']);

const EMPTY_STATE: AdminSupportNotificationState = {
  enabled: false,
  initialized: false,
  unreadCount: 0,
  items: [],
  latestToast: null,
  revision: 0
};

const sortConversations = (items: SupportConversationSummary[]) => {
  return [...items].sort((left, right) => {
    const rightTime = Date.parse(right.lastMessageAt || '') || 0;
    const leftTime = Date.parse(left.lastMessageAt || '') || 0;
    return rightTime - leftTime;
  });
};

const buildStateFromItems = (
  items: SupportConversationSummary[],
  previous: AdminSupportNotificationState,
  latestToast: AdminSupportToast | null
): AdminSupportNotificationState => {
  const sortedItems = sortConversations(items.filter((item) => item.staffUnreadCount > 0));
  const unreadCount = sortedItems.reduce((total, item) => total + Math.max(0, Number(item.staffUnreadCount) || 0), 0);
  return {
    enabled: previous.enabled,
    initialized: true,
    unreadCount,
    items: sortedItems,
    latestToast,
    revision: previous.revision + 1
  };
};

const buildWsUrl = (token: string) => {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  if (!base) {
    return `${protocol}//${window.location.host}/ws/support${query}`;
  }
  if (base.startsWith('http://')) {
    return `${base.replace(/^http:\/\//, 'ws://')}/ws/support${query}`;
  }
  if (base.startsWith('https://')) {
    return `${base.replace(/^https:\/\//, 'wss://')}/ws/support${query}`;
  }
  return `${protocol}//${window.location.host}${base}/ws/support${query}`;
};

const canUseSupportNotifications = () => {
  const currentRole = String(getCurrentSession()?.currentRole || '').trim().toUpperCase();
  return SUPPORT_NOTIFICATION_ROLES.has(currentRole);
};

const getToastCandidate = (previousItems: SupportConversationSummary[], nextItems: SupportConversationSummary[]) => {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const candidates = nextItems.filter((item) => {
    const previous = previousById.get(item.id);
    if (!previous) {
      return item.staffUnreadCount > 0;
    }
    return item.staffUnreadCount > previous.staffUnreadCount;
  });
  if (candidates.length === 0) {
    return null;
  }
  const [latest] = sortConversations(candidates);
  const title = latest.customerDisplayName || `客户 ${latest.customerUserId.slice(0, 8)}`;
  const preview = latest.lastMessagePreview || '你有一条新的客服消息';
  return {
    key: `${latest.id}:${latest.staffUnreadCount}:${latest.lastMessageAt}`,
    conversationId: latest.id,
    title,
    preview
  };
};

const normalizeConversationItems = (payload: unknown) => {
  const rawItems = Array.isArray((payload as { items?: unknown[] } | null)?.items)
    ? ((payload as { items?: unknown[] }).items as unknown[])
    : Array.isArray(payload)
      ? payload as unknown[]
      : [];
  return rawItems
    .map((item) => normalizeSupportConversation(item))
    .filter((item): item is SupportConversationSummary => Boolean(item));
};

const createStore = () => {
  let state = EMPTY_STATE;
  const subscribers = new Set<() => void>();
  let socket: WebSocket | null = null;
  let pollTimer: number | null = null;
  let started = false;
  let mockCleanup: (() => void) | null = null;

  const emit = () => {
    subscribers.forEach((subscriber) => subscriber());
  };

  const setState = (nextState: AdminSupportNotificationState) => {
    state = nextState;
    emit();
  };

  const updateDebugBridge = () => {
    const globalWindow = window as typeof window & {
      __TMO_ADMIN_SUPPORT_NOTIFICATIONS__?: {
        getSnapshot: () => AdminSupportNotificationState;
        dispatchMockUpdate: (items: unknown[]) => void;
      };
    };
    globalWindow.__TMO_ADMIN_SUPPORT_NOTIFICATIONS__ = {
      getSnapshot: () => state,
      dispatchMockUpdate: (items: unknown[]) => {
        applyItems(normalizeConversationItems(items), { emitToast: true });
      }
    };
  };

  const clearTransport = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
    if (mockCleanup) {
      mockCleanup();
      mockCleanup = null;
    }
    started = false;
  };

  const startPolling = () => {
    if (pollTimer) {
      return;
    }
    pollTimer = window.setInterval(() => {
      void store.refresh({ emitToast: true });
    }, POLL_INTERVAL_MS);
  };

  const applyItems = (items: SupportConversationSummary[], options: ApplyOptions = {}) => {
    const emitToast = options.emitToast !== false;
    const nextToast = state.initialized && emitToast ? getToastCandidate(state.items, items) : null;
    setState(buildStateFromItems(items, state, nextToast));
    updateDebugBridge();
  };

  const loadUnreadItems = async () => {
    const response = await fetchAdminSupportConversations({
      page: 1,
      pageSize: 50,
      scope: 'unread'
    });
    if (response.status !== 200) {
      throw new Error(response?.data?.message || '加载客服通知失败');
    }
    return normalizeConversationItems(response.data);
  };

  const startMockMode = () => {
    applyItems(createMockSupportData().conversations, { emitToast: false });
    const handleMockUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ conversations?: unknown[] }>).detail;
      if (!detail) {
        return;
      }
      applyItems(normalizeConversationItems(detail.conversations || []), { emitToast: true });
    };
    window.addEventListener(MOCK_UPDATE_EVENT, handleMockUpdate as EventListener);
    mockCleanup = () => {
      window.removeEventListener(MOCK_UPDATE_EVENT, handleMockUpdate as EventListener);
    };
  };

  const startRealtime = () => {
    const token = String(getCurrentSession()?.accessToken || '');
    if (!token) {
      startPolling();
      return;
    }
    socket = new WebSocket(buildWsUrl(token));
    socket.onopen = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    socket.onmessage = () => {
      void store.refresh({ emitToast: true });
    };
    socket.onerror = () => {
      startPolling();
    };
    socket.onclose = () => {
      startPolling();
    };
  };

  const store = {
    subscribe(callback: () => void) {
      subscribers.add(callback);
      if (subscribers.size === 1) {
        store.start();
      }
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          clearTransport();
          setState({ ...EMPTY_STATE });
        }
      };
    },
    getSnapshot() {
      return state;
    },
    start() {
      if (started) {
        return;
      }
      if (!canUseSupportNotifications()) {
      setState({
        ...EMPTY_STATE,
        enabled: false,
        initialized: true,
        revision: state.revision + 1
      });
      updateDebugBridge();
      started = true;
      return;
    }
      started = true;
      setState({
        ...state,
        enabled: true
      });
      if (isMockMode) {
        startMockMode();
        return;
      }
      void store.refresh({ emitToast: false });
      startRealtime();
    },
    async refresh(options: ApplyOptions = {}) {
      if (!canUseSupportNotifications()) {
        if (state.enabled || !state.initialized) {
      setState({
        ...EMPTY_STATE,
        enabled: false,
        initialized: true,
        revision: state.revision + 1
      });
      updateDebugBridge();
    }
    return;
  }
      const items = isMockMode ? state.items : await loadUnreadItems();
      applyItems(items, options);
    },
    dismissToast() {
      if (!state.latestToast) {
        return;
      }
      setState({
        ...state,
        latestToast: null,
        revision: state.revision + 1
      });
    },
    syncConversation(conversation: SupportConversationSummary | null | undefined) {
      if (!conversation || !canUseSupportNotifications()) {
        return;
      }
      const nextItems = state.items.filter((item) => item.id !== conversation.id);
      if (conversation.staffUnreadCount > 0) {
        nextItems.push(conversation);
      }
      applyItems(nextItems, { emitToast: false });
    }
  };

  return store;
};

const adminSupportNotificationStore = createStore();

export const useAdminSupportNotifications = () => {
  const snapshot = useSyncExternalStore(
    adminSupportNotificationStore.subscribe,
    adminSupportNotificationStore.getSnapshot,
    adminSupportNotificationStore.getSnapshot
  );

  useEffect(() => {
    adminSupportNotificationStore.start();
  }, []);

  return snapshot;
};

export const refreshAdminSupportNotifications = async (options: ApplyOptions = {}) => {
  await adminSupportNotificationStore.refresh(options);
};

export const dismissAdminSupportToast = () => {
  adminSupportNotificationStore.dismissToast();
};

export const syncAdminSupportNotificationConversation = (conversation: SupportConversationSummary | null | undefined) => {
  adminSupportNotificationStore.syncConversation(conversation);
};

export const adminSupportNotificationMockEventName = MOCK_UPDATE_EVENT;
