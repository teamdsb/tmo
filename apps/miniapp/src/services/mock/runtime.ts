import type {
  AfterSalesMessage,
  AfterSalesTicket,
  InquiryMessage,
  Order,
  PriceInquiry,
  ProductRequest,
  TrackingInfo,
  UserAddress
} from '@tmo/api-client'
import type { BootstrapResponse, PermissionList, User } from '@tmo/gateway-api-client'
import { UserStatus } from '@tmo/gateway-api-client'
import type { PaymentChannel, PaymentSession } from '@tmo/payment-services'
import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'
import { buildPermissionListForRole, resolveMiniMockIdentityFixture } from '../../../../../packages/shared/src/mock-data/auth.js'
import { buildSeedOrders, buildSeedTrackingByOrderId } from '../mocks/orders'

const isolatedMockStorageKey = 'tmo:isolated:mock-state'
const isolatedMockAuthContextStorageKey = 'tmo:isolated:auth-context'
const authTokenStorageKey = 'tmo:auth:token'
const legacyAuthTokenStorageKey = 'tmo:commerce:token'

const mockCreatedAt = '2026-01-01T00:00:00Z'

type MockRole = 'CUSTOMER' | 'SALES'

export type IsolatedMockAuthContext = {
  code: string
  userId: string
  displayName: string
  userType: 'customer' | 'staff' | 'admin'
  roles: string[]
  currentRole: MockRole
  ownerSalesDisplayName?: string
}

export type MockCartEntry = {
  skuId: string
  qty: number
}

export type MockPaymentSession = PaymentSession & {
  orderId: string
  channel: PaymentChannel
}

export type IsolatedMockState = {
  wishlistSkuIds: string[]
  cartEntries: MockCartEntry[]
  addresses: UserAddress[]
  orders: Order[]
  paymentSessionsByOrderId: Record<string, MockPaymentSession>
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

const createDefaultState = (): IsolatedMockState => ({
  wishlistSkuIds: [],
  cartEntries: [],
  addresses: [],
  orders: buildSeedOrders(),
  paymentSessionsByOrderId: {},
  trackingByOrderId: buildSeedTrackingByOrderId(),
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
  const normalizedOrders = Array.isArray(state.orders) && state.orders.length > 0 ? state.orders : fallback.orders
  const normalizedTrackingByOrderId = isRecord(state.trackingByOrderId)
    && Object.keys(state.trackingByOrderId).length > 0
    ? (state.trackingByOrderId as Record<string, TrackingInfo>)
    : fallback.trackingByOrderId

  return {
    wishlistSkuIds: normalizeStringArray(state.wishlistSkuIds),
    cartEntries: normalizeCartEntries(state.cartEntries),
    addresses: Array.isArray(state.addresses) ? state.addresses : [],
    orders: normalizedOrders,
    paymentSessionsByOrderId: isRecord(state.paymentSessionsByOrderId)
      ? (state.paymentSessionsByOrderId as Record<string, MockPaymentSession>)
      : {},
    trackingByOrderId: normalizedTrackingByOrderId,
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

const normalizeAuthContext = (value: unknown): IsolatedMockAuthContext | null => {
  if (!isRecord(value)) {
    return null
  }
  if (typeof value.code !== 'string' || typeof value.userId !== 'string' || typeof value.displayName !== 'string') {
    return null
  }
  if (!Array.isArray(value.roles)) {
    return null
  }
  const roles = value.roles
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().toUpperCase())
  if (roles.length === 0) {
    return null
  }
  const currentRoleRaw = typeof value.currentRole === 'string' ? value.currentRole.trim().toUpperCase() : ''
  const currentRole = (currentRoleRaw === 'SALES' ? 'SALES' : 'CUSTOMER') as MockRole
  if (!roles.includes(currentRole)) {
    return null
  }
  const userTypeRaw = typeof value.userType === 'string' ? value.userType.trim().toLowerCase() : ''
  const userType = (userTypeRaw === 'staff' || userTypeRaw === 'admin' ? userTypeRaw : 'customer') as IsolatedMockAuthContext['userType']
  const ownerSalesDisplayName = typeof value.ownerSalesDisplayName === 'string' && value.ownerSalesDisplayName.trim()
    ? value.ownerSalesDisplayName.trim()
    : undefined
  return {
    code: value.code.trim(),
    userId: value.userId.trim(),
    displayName: value.displayName.trim(),
    userType,
    roles,
    currentRole,
    ownerSalesDisplayName
  }
}

export const buildMockAuthContext = (code: string, role?: string): IsolatedMockAuthContext => {
  const fixture = resolveMiniMockIdentityFixture(code)
  const roles = fixture.roles.map((item) => String(item).toUpperCase())
  const requestedRole = String(role || '').trim().toUpperCase()
  const currentRole = (requestedRole === 'SALES' ? 'SALES' : 'CUSTOMER') as MockRole
  const selectedRole = roles.includes(currentRole) ? currentRole : (roles.includes('CUSTOMER') ? 'CUSTOMER' : 'SALES')
  return {
    code: String(code || '').trim() || 'mock_customer_001',
    userId: String(fixture.userId),
    displayName: String(fixture.displayName),
    userType: fixture.userType === 'staff' ? 'staff' : fixture.userType === 'admin' ? 'admin' : 'customer',
    roles,
    currentRole: selectedRole,
    ownerSalesDisplayName: typeof fixture.ownerSalesDisplayName === 'string'
      ? fixture.ownerSalesDisplayName
      : undefined
  }
}

export const saveIsolatedMockAuthContext = async (context: IsolatedMockAuthContext | null): Promise<void> => {
  try {
    if (!context) {
      await removeStorage(isolatedMockAuthContextStorageKey)
      setLocalStorage(isolatedMockAuthContextStorageKey, null)
      return
    }
    await setStorage(isolatedMockAuthContextStorageKey, context)
    setLocalStorage(isolatedMockAuthContextStorageKey, JSON.stringify(context))
  } catch {
    // ignore storage errors
  }
}

export const loadIsolatedMockAuthContext = async (): Promise<IsolatedMockAuthContext | null> => {
  try {
    const result = await getStorage<IsolatedMockAuthContext>(isolatedMockAuthContextStorageKey)
    const normalized = normalizeAuthContext(result.data)
    if (normalized) {
      return normalized
    }
  } catch {
    // ignore storage errors
  }

  const raw = getLocalStorage(isolatedMockAuthContextStorageKey)
  if (!raw) {
    return null
  }
  try {
    return normalizeAuthContext(JSON.parse(raw))
  } catch {
    return null
  }
}

export const getMockUser = (context: IsolatedMockAuthContext): User => ({
  id: context.userId,
  currentRole: context.currentRole,
  userType: context.userType,
  status: UserStatus.active,
  displayName: context.displayName,
  roles: [...context.roles],
  ownerSalesDisplayName: context.ownerSalesDisplayName,
  disabledAt: null,
  disabledReason: null,
  createdAt: mockCreatedAt
})

export const getMockPermissions = (context: IsolatedMockAuthContext): PermissionList => {
  return buildPermissionListForRole(context.currentRole)
}

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
    await saveIsolatedMockAuthContext(null)
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

export const buildIsolatedMockBootstrap = async (token: string | null): Promise<BootstrapResponse> => {
  const context = token ? await loadIsolatedMockAuthContext() : null
  return {
    me: token && context ? getMockUser(context) : undefined,
    permissions: context ? getMockPermissions(context) : { items: [] },
    featureFlags: {
      paymentEnabled: true,
      wechatPayEnabled: true,
      alipayPayEnabled: true
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
  try {
    await removeStorage(isolatedMockAuthContextStorageKey)
  } catch {
    // ignore storage errors
  }
  setLocalStorage(isolatedMockAuthContextStorageKey, null)
  await setIsolatedMockToken(null)
}

export const buildMockPaymentSession = (
  orderId: string,
  options?: {
    paymentId?: string
    channel?: PaymentChannel
    status?: PaymentSession['status']
    paidAt?: string | null
    createdAt?: string
    updatedAt?: string
  }
): MockPaymentSession => {
  const createdAt = options?.createdAt ?? nowIso()
  const updatedAt = options?.updatedAt ?? createdAt
  const status = options?.status ?? 'PAY_PENDING'
  const paidAt = options?.paidAt === undefined
    ? (status === 'PAID' ? updatedAt : null)
    : options.paidAt

  return {
    id: options?.paymentId ?? `pay_mock_${orderId}`,
    orderId,
    channel: options?.channel ?? 'wechat',
    status,
    amountFen: 0,
    currency: 'CNY',
    createdAt,
    updatedAt,
    paidAt
  }
}

const paymentStatusToOrderStatus = (status: string): Order['status'] => {
  switch (String(status).toUpperCase()) {
    case 'PAID':
      return 'PAID'
    case 'PAY_FAILED':
    case 'FAILED':
      return 'PAY_FAILED'
    case 'CREATED':
    case 'PENDING':
    case 'PAY_PENDING':
      return 'PAY_PENDING'
    default:
      return 'SUBMITTED'
  }
}

const normalizeOrderPaymentStatus = (status: string): Order['paymentStatus'] => {
  switch (String(status).toUpperCase()) {
    case 'PAID':
      return 'PAID'
    case 'PAY_FAILED':
    case 'FAILED':
      return 'PAY_FAILED'
    case 'CREATED':
    case 'PENDING':
    case 'PAY_PENDING':
      return 'PAY_PENDING'
    default:
      return 'UNPAID'
  }
}

export const applyPaymentSessionToOrder = (order: Order, session: MockPaymentSession): Order => {
  const paymentStatus = normalizeOrderPaymentStatus(session.status)
  const nextStatus = paymentStatus === 'UNPAID' ? order.status : paymentStatusToOrderStatus(session.status)

  return {
    ...order,
    status: nextStatus,
    paymentStatus,
    latestPaymentId: session.id,
    paymentChannel: session.channel,
    paidAt: session.paidAt ?? undefined,
    updatedAt: session.updatedAt ?? nowIso()
  } as Order
}
