import type {
  AfterSalesMessage,
  AfterSalesTicket,
  InquiryMessage,
  Order,
  PriceTier,
  PriceInquiry,
  ProductRequest,
  TrackingInfo,
  User
} from '@tmo/api-client'
import type { BootstrapResponse, PermissionList } from '@tmo/gateway-api-client'
import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'

const isolatedMockStorageKey = 'tmo:isolated:mock-state'
const authTokenStorageKey = 'tmo:auth:token'
const legacyAuthTokenStorageKey = 'tmo:commerce:token'

const mockUser: User = Object.freeze({
  id: 'mock-user-id',
  userType: 'staff',
  status: 'active',
  displayName: '测试账号',
  phone: null,
  roles: ['TEST'],
  disabledAt: null,
  disabledReason: null,
  createdAt: '2026-01-01T00:00:00Z'
})

const mockPermissions: PermissionList = Object.freeze({
  items: []
})

export type MockCartEntry = {
  skuId: string
  qty: number
}

export type IsolatedMockState = {
  wishlistSkuIds: string[]
  cartEntries: MockCartEntry[]
  skuPriceTiersBySkuId: Record<string, PriceTier[]>
  orders: Order[]
  trackingByOrderId: Record<string, TrackingInfo>
  productRequests: ProductRequest[]
  afterSalesTickets: AfterSalesTicket[]
  afterSalesMessagesByTicketId: Record<string, AfterSalesMessage[]>
  inquiries: PriceInquiry[]
  inquiryMessagesByInquiryId: Record<string, InquiryMessage[]>
  updatedAt: string
}

const hasLocalStorage = (): boolean => {
  return typeof localStorage !== 'undefined'
}

const getLocalStorage = (key: string): string | null => {
  if (!hasLocalStorage()) {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const setLocalStorage = (key: string, value: string | null): void => {
  if (!hasLocalStorage()) {
    return
  }
  try {
    if (value === null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, value)
  } catch {
    // ignore storage errors
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeQty = (qty: number): number => {
  if (!Number.isFinite(qty)) {
    return 1
  }
  const normalized = Math.floor(qty)
  if (normalized <= 0) {
    return 1
  }
  return normalized
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

const normalizeCartEntries = (value: unknown): MockCartEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((entry): entry is { skuId: string; qty?: number } => {
      return isRecord(entry) && typeof entry.skuId === 'string'
    })
    .map((entry) => ({
      skuId: entry.skuId,
      qty: normalizeQty(typeof entry.qty === 'number' ? entry.qty : 1)
    }))
}

const normalizePriceTier = (value: unknown): PriceTier | null => {
  if (!isRecord(value)) {
    return null
  }
  if (typeof value.minQty !== 'number' || !Number.isFinite(value.minQty)) {
    return null
  }
  if (typeof value.unitPriceFen !== 'number' || !Number.isFinite(value.unitPriceFen)) {
    return null
  }
  if (value.maxQty !== null && value.maxQty !== undefined && (typeof value.maxQty !== 'number' || !Number.isFinite(value.maxQty))) {
    return null
  }

  const minQty = Math.max(1, Math.floor(value.minQty))
  const unitPriceFen = Math.max(1, Math.floor(value.unitPriceFen))
  const maxQty = value.maxQty === null || value.maxQty === undefined
    ? null
    : Math.max(minQty, Math.floor(value.maxQty))

  return {
    minQty,
    maxQty,
    unitPriceFen
  }
}

const normalizeSkuPriceTiersBySkuId = (value: unknown): Record<string, PriceTier[]> => {
  if (!isRecord(value)) {
    return {}
  }

  const result: Record<string, PriceTier[]> = {}
  Object.entries(value).forEach(([skuId, tiers]) => {
    if (!skuId || !Array.isArray(tiers)) {
      return
    }
    const normalizedTiers = tiers
      .map((tier) => normalizePriceTier(tier))
      .filter((tier): tier is PriceTier => tier !== null)

    if (normalizedTiers.length > 0) {
      result[skuId] = normalizedTiers
    }
  })

  return result
}

const createDefaultState = (): IsolatedMockState => ({
  wishlistSkuIds: [],
  cartEntries: [],
  skuPriceTiersBySkuId: {},
  orders: [],
  trackingByOrderId: {},
  productRequests: [],
  afterSalesTickets: [],
  afterSalesMessagesByTicketId: {},
  inquiries: [],
  inquiryMessagesByInquiryId: {},
  updatedAt: nowIso()
})

const normalizeState = (value: unknown): IsolatedMockState => {
  if (!isRecord(value)) {
    return createDefaultState()
  }

  const state = value as Partial<IsolatedMockState>
  const fallback = createDefaultState()
  return {
    wishlistSkuIds: normalizeStringArray(state.wishlistSkuIds),
    cartEntries: normalizeCartEntries(state.cartEntries),
    skuPriceTiersBySkuId: normalizeSkuPriceTiersBySkuId(state.skuPriceTiersBySkuId),
    orders: Array.isArray(state.orders) ? state.orders : [],
    trackingByOrderId: isRecord(state.trackingByOrderId)
      ? (state.trackingByOrderId as Record<string, TrackingInfo>)
      : {},
    productRequests: Array.isArray(state.productRequests) ? state.productRequests : [],
    afterSalesTickets: Array.isArray(state.afterSalesTickets) ? state.afterSalesTickets : [],
    afterSalesMessagesByTicketId: isRecord(state.afterSalesMessagesByTicketId)
      ? (state.afterSalesMessagesByTicketId as Record<string, AfterSalesMessage[]>)
      : {},
    inquiries: Array.isArray(state.inquiries) ? state.inquiries : [],
    inquiryMessagesByInquiryId: isRecord(state.inquiryMessagesByInquiryId)
      ? (state.inquiryMessagesByInquiryId as Record<string, InquiryMessage[]>)
      : {},
    updatedAt: typeof state.updatedAt === 'string' && state.updatedAt.trim().length > 0
      ? state.updatedAt
      : fallback.updatedAt
  }
}

const readTokenFromStorage = async (storageKey: string): Promise<string | null> => {
  try {
    const result = await getStorage<string>(storageKey)
    if (result.data && result.data.trim().length > 0) {
      return result.data
    }
  } catch {
    // ignore storage errors
  }
  const localValue = getLocalStorage(storageKey)
  if (typeof localValue === 'string' && localValue.trim().length > 0) {
    return localValue
  }
  return null
}

export const nowIso = (): string => new Date().toISOString()

export const getMockUser = (): User => ({
  ...mockUser,
  roles: [...mockUser.roles]
})

export const getMockPermissions = (): PermissionList => ({
  items: [...mockPermissions.items]
})

export const createIsolatedMockAccessToken = (): string => {
  const random = Math.random().toString(36).slice(2, 10)
  return `mock-token-${Date.now().toString(36)}-${random}`
}

export const getIsolatedMockToken = async (): Promise<string | null> => {
  const primary = await readTokenFromStorage(authTokenStorageKey)
  if (primary) {
    return primary
  }
  return readTokenFromStorage(legacyAuthTokenStorageKey)
}

export const setIsolatedMockToken = async (token: string | null): Promise<void> => {
  try {
    if (token === null) {
      await removeStorage(authTokenStorageKey)
      await removeStorage(legacyAuthTokenStorageKey)
    } else {
      await setStorage(authTokenStorageKey, token)
    }
  } catch {
    // ignore storage errors
  }
  setLocalStorage(authTokenStorageKey, token)
  if (token === null) {
    setLocalStorage(legacyAuthTokenStorageKey, null)
  }
}

export const createIsolatedTokenStore = (devToken?: string) => {
  return {
    getToken: async (): Promise<string | null> => {
      const token = await getIsolatedMockToken()
      if (token) {
        return token
      }
      return devToken ?? null
    },
    setToken: async (token: string | null): Promise<void> => {
      await setIsolatedMockToken(token)
    }
  }
}

export const buildIsolatedMockBootstrap = (token: string | null): BootstrapResponse => {
  return {
    me: token ? getMockUser() : undefined,
    permissions: getMockPermissions(),
    featureFlags: {
      paymentEnabled: false,
      wechatPayEnabled: false,
      alipayPayEnabled: false
    }
  }
}

export const loadIsolatedMockState = async (): Promise<IsolatedMockState> => {
  try {
    const result = await getStorage<IsolatedMockState>(isolatedMockStorageKey)
    return normalizeState(result.data)
  } catch {
    return createDefaultState()
  }
}

export const saveIsolatedMockState = async (state: IsolatedMockState): Promise<void> => {
  try {
    await setStorage(isolatedMockStorageKey, state)
  } catch {
    // ignore storage errors
  }
}

export const updateIsolatedMockState = async (
  updater: (state: IsolatedMockState) => IsolatedMockState
): Promise<IsolatedMockState> => {
  const current = await loadIsolatedMockState()
  const next = normalizeState(updater(current))
  await saveIsolatedMockState({
    ...next,
    updatedAt: nowIso()
  })
  return loadIsolatedMockState()
}

export const resetIsolatedMockState = async (): Promise<void> => {
  try {
    await removeStorage(isolatedMockStorageKey)
  } catch {
    // ignore storage errors
  }
  await setIsolatedMockToken(null)
}
