import { createCommerceServices, type CommerceServices } from '@tmo/commerce-services'
import type {
  Cart,
  Category,
  CreateCatalogProductRequest,
  CreateCategoryRequest,
  PriceTier,
  ProductDetail,
  ProductSummary,
  Sku,
  UpdateCatalogProductRequest,
  UpdateCategoryRequest,
  WishlistItem
} from '@tmo/api-client'
import { getStorage, setStorage } from '@tmo/platform-adapter'
import { buildMockProductDetail, mockCategories, mockProductDetails, mockProducts } from './mocks/catalog'
import { requireCommerceBaseUrl, runtimeEnv } from '../config/runtime-env'
import { createMockCommerceServices } from './mock/commerce'

const shouldFallbackToMock = (): boolean => {
  return runtimeEnv.commerceMockFallback && !runtimeEnv.isIsolatedMock
}

const mockCommerceStorageKey = 'tmo:commerce:mock-state'
const mockCartItemIdPrefix = 'mock-cart-'

type MockCartEntry = {
  skuId: string
  qty: number
}

type MockCommerceState = {
  wishlistSkuIds: string[]
  cartEntries: MockCartEntry[]
  skuPriceTiersBySkuId: Record<string, PriceTier[]>
  updatedAt: string
}

const nowIso = (): string => new Date().toISOString()

const createDefaultMockCommerceState = (): MockCommerceState => ({
  wishlistSkuIds: [],
  cartEntries: [],
  skuPriceTiersBySkuId: {},
  updatedAt: nowIso()
})

const normalizeQty = (qty: number): number => {
  if (!Number.isFinite(qty)) {
    return 1
  }
  const value = Math.floor(qty)
  if (value <= 0) {
    return 1
  }
  return value
}

const normalizePriceTier = (value: unknown): PriceTier | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const tier = value as Partial<PriceTier>
  if (typeof tier.minQty !== 'number' || !Number.isFinite(tier.minQty)) {
    return null
  }
  if (typeof tier.unitPriceFen !== 'number' || !Number.isFinite(tier.unitPriceFen)) {
    return null
  }
  if (tier.maxQty !== null && tier.maxQty !== undefined && (typeof tier.maxQty !== 'number' || !Number.isFinite(tier.maxQty))) {
    return null
  }

  const minQty = Math.max(1, Math.floor(tier.minQty))
  const unitPriceFen = Math.max(1, Math.floor(tier.unitPriceFen))
  const maxQty = tier.maxQty === null || tier.maxQty === undefined
    ? null
    : Math.max(minQty, Math.floor(tier.maxQty))

  return {
    minQty,
    maxQty,
    unitPriceFen
  }
}

const normalizeSkuPriceTiersBySkuId = (value: unknown): Record<string, PriceTier[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

const normalizeMockCommerceState = (value: unknown): MockCommerceState => {
  if (!value || typeof value !== 'object') {
    return createDefaultMockCommerceState()
  }

  const state = value as Partial<MockCommerceState>
  const wishlistSkuIds = Array.isArray(state.wishlistSkuIds)
    ? state.wishlistSkuIds.filter((skuId): skuId is string => typeof skuId === 'string' && skuId.trim().length > 0)
    : []

  const cartEntries = Array.isArray(state.cartEntries)
    ? state.cartEntries
      .filter((entry): entry is MockCartEntry => {
        return typeof entry === 'object'
          && entry !== null
          && typeof (entry as { skuId?: unknown }).skuId === 'string'
      })
      .map((entry) => ({
        skuId: entry.skuId,
        qty: normalizeQty(entry.qty)
      }))
    : []

  const updatedAt = typeof state.updatedAt === 'string' && state.updatedAt.trim().length > 0
    ? state.updatedAt
    : nowIso()

  return {
    wishlistSkuIds,
    cartEntries,
    skuPriceTiersBySkuId: normalizeSkuPriceTiersBySkuId(state.skuPriceTiersBySkuId),
    updatedAt
  }
}

const loadMockCommerceState = async (): Promise<MockCommerceState> => {
  try {
    const result = await getStorage<MockCommerceState>(mockCommerceStorageKey)
    return normalizeMockCommerceState(result.data)
  } catch {
    return createDefaultMockCommerceState()
  }
}

const saveMockCommerceState = async (state: MockCommerceState): Promise<void> => {
  try {
    await setStorage(mockCommerceStorageKey, state)
  } catch {
    // ignore storage errors
  }
}

const inferSpuIdFromSkuId = (skuId: string): string => {
  const marker = '-sku-'
  const markerIndex = skuId.indexOf(marker)
  if (markerIndex > 0) {
    return skuId.slice(0, markerIndex)
  }
  if (skuId.startsWith('sku-')) {
    return `spu-${skuId.slice(4)}`
  }
  return `spu-${skuId}`
}

const clonePriceTier = (tier: PriceTier): PriceTier => ({
  minQty: tier.minQty,
  maxQty: tier.maxQty ?? null,
  unitPriceFen: tier.unitPriceFen
})

const applySkuPriceTierOverride = (
  sku: Sku,
  skuPriceTiersBySkuId?: Record<string, PriceTier[]>
): Sku => {
  const tiers = skuPriceTiersBySkuId?.[sku.id]
  if (!tiers || tiers.length === 0) {
    return sku
  }
  return {
    ...sku,
    priceTiers: tiers.map(clonePriceTier)
  }
}

const getMockSkuById = (skuId: string, skuPriceTiersBySkuId?: Record<string, PriceTier[]>): Sku => {
  for (const detail of Object.values(mockProductDetails)) {
    const found = detail.skus.find((sku) => sku.id === skuId)
    if (found) {
      return applySkuPriceTierOverride(found, skuPriceTiersBySkuId)
    }
  }

  const guessedSpuId = inferSpuIdFromSkuId(skuId)
  const guessedDetail = buildMockProductDetail(guessedSpuId)
  const guessedSku = guessedDetail?.skus.find((sku) => sku.id === skuId)
  if (guessedSku) {
    return applySkuPriceTierOverride(guessedSku, skuPriceTiersBySkuId)
  }

  return applySkuPriceTierOverride({
    id: skuId,
    spuId: guessedSpuId,
    name: `示例规格 ${skuId.slice(0, 8)}`,
    spec: '默认规格',
    priceTiers: [
      { minQty: 1, maxQty: null, unitPriceFen: 9800 }
    ],
    isActive: true
  }, skuPriceTiersBySkuId)
}

const toMockCartItemId = (skuId: string): string => `${mockCartItemIdPrefix}${skuId}`

const toSkuIdFromCartItemId = (itemId: string): string => {
  if (itemId.startsWith(mockCartItemIdPrefix)) {
    return itemId.slice(mockCartItemIdPrefix.length)
  }
  return itemId
}

const toMockWishlist = (state: MockCommerceState): WishlistItem[] => {
  return state.wishlistSkuIds.map((skuId) => ({
    sku: getMockSkuById(skuId, state.skuPriceTiersBySkuId),
    createdAt: state.updatedAt
  }))
}

const toMockCart = (state: MockCommerceState): Cart => {
  return {
    items: state.cartEntries.map((entry) => ({
      id: toMockCartItemId(entry.skuId),
      sku: getMockSkuById(entry.skuId, state.skuPriceTiersBySkuId),
      qty: normalizeQty(entry.qty)
    })),
    updatedAt: state.updatedAt
  }
}

const buildSkuPriceTiersBySkuId = (skus: Sku[]): Record<string, PriceTier[]> => {
  const result: Record<string, PriceTier[]> = {}
  skus.forEach((sku) => {
    if (!sku.priceTiers || sku.priceTiers.length === 0) {
      return
    }
    result[sku.id] = sku.priceTiers.map(clonePriceTier)
  })
  return result
}

const applyProductDetailPriceTierOverrides = (
  detail: ProductDetail,
  skuPriceTiersBySkuId: Record<string, PriceTier[]>
): ProductDetail => {
  if (!detail.skus.length) {
    return detail
  }
  return {
    ...detail,
    skus: detail.skus.map((sku) => applySkuPriceTierOverride(sku, skuPriceTiersBySkuId))
  }
}

const ensureStateIncludesSkuPriceTiers = (
  state: MockCommerceState,
  detail: ProductDetail
): MockCommerceState => {
  const incomingMap = buildSkuPriceTiersBySkuId(detail.skus)
  const incomingEntries = Object.entries(incomingMap)
  if (incomingEntries.length === 0) {
    return state
  }

  const nextMap = { ...state.skuPriceTiersBySkuId }
  let changed = false
  incomingEntries.forEach(([skuId, tiers]) => {
    if (nextMap[skuId]) {
      return
    }
    nextMap[skuId] = tiers.map(clonePriceTier)
    changed = true
  })

  if (!changed) {
    return state
  }
  return {
    ...state,
    skuPriceTiersBySkuId: nextMap,
    updatedAt: nowIso()
  }
}

const getPersistedMockProductDetail = async (spuId: string): Promise<ProductDetail> => {
  const state = await loadMockCommerceState()
  const detail = applyProductDetailPriceTierOverrides(
    buildFallbackProductDetail(spuId),
    state.skuPriceTiersBySkuId
  )
  const nextState = ensureStateIncludesSkuPriceTiers(state, detail)
  if (nextState !== state) {
    await saveMockCommerceState(nextState)
  }
  return detail
}

const applyQuery = (items: ProductSummary[], query?: string) => {
  if (!query) return items
  const keyword = query.trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) => item.name.toLowerCase().includes(keyword)
    || item.id.toLowerCase().includes(keyword))
}

const paginate = (items: ProductSummary[], page?: number, pageSize?: number) => {
  const safePage = page && page > 0 ? page : 1
  const safeSize = pageSize && pageSize > 0 ? pageSize : items.length || 1
  const start = (safePage - 1) * safeSize
  return {
    items: items.slice(start, start + safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize
  }
}

const buildFallbackProductDetail = (spuId: string): ProductDetail => {
  const detail = mockProductDetails[spuId] ?? buildMockProductDetail(spuId)
  if (detail) {
    return detail
  }
  return {
    product: {
      id: spuId,
      name: '离线商品',
      categoryId: mockCategories[0]?.id ?? 'mock-category',
      images: [],
      description: '离线预览数据'
    },
    skus: []
  }
}

const createMockedCatalog = (catalog: CommerceServices['catalog']) => ({
  listCategories: async (): Promise<{ items: Category[] }> => {
    if (shouldFallbackToMock()) {
      return { items: mockCategories }
    }
    try {
      return await catalog.listCategories()
    } catch (error) {
      console.warn('catalog listCategories failed, fallback to mock', error)
      return { items: mockCategories }
    }
  },
  getCategory: async (categoryId: string): Promise<Category> => {
    if (shouldFallbackToMock()) {
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw new Error(`category not found: ${categoryId}`)
      }
      return found
    }
    try {
      return await catalog.getCategory(categoryId)
    } catch (error) {
      console.warn('catalog getCategory failed, fallback to mock', error)
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw error
      }
      return found
    }
  },
  createCategory: async (payload: CreateCategoryRequest): Promise<Category> => {
    if (shouldFallbackToMock()) {
      return {
        id: `mock-${Date.now()}`,
        name: payload.name,
        parentId: payload.parentId ?? null,
        sort: payload.sort ?? 0
      }
    }
    try {
      return await catalog.createCategory(payload)
    } catch (error) {
      console.warn('catalog createCategory failed, fallback to mock', error)
      return {
        id: `mock-${Date.now()}`,
        name: payload.name,
        parentId: payload.parentId ?? null,
        sort: payload.sort ?? 0
      }
    }
  },
  updateCategory: async (categoryId: string, payload: UpdateCategoryRequest): Promise<Category> => {
    if (shouldFallbackToMock()) {
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw new Error(`category not found: ${categoryId}`)
      }
      return {
        id: found.id,
        name: payload.name ?? found.name,
        parentId: payload.parentId === undefined ? (found.parentId ?? null) : payload.parentId,
        sort: payload.sort ?? found.sort
      }
    }
    try {
      return await catalog.updateCategory(categoryId, payload)
    } catch (error) {
      console.warn('catalog updateCategory failed, fallback to mock', error)
      const found = mockCategories.find((item) => item.id === categoryId)
      if (!found) {
        throw error
      }
      return {
        id: found.id,
        name: payload.name ?? found.name,
        parentId: payload.parentId === undefined ? (found.parentId ?? null) : payload.parentId,
        sort: payload.sort ?? found.sort
      }
    }
  },
  deleteCategory: async (categoryId: string): Promise<void> => {
    if (shouldFallbackToMock()) {
      return
    }
    try {
      await catalog.deleteCategory(categoryId)
    } catch (error) {
      console.warn('catalog deleteCategory failed, fallback to mock', error)
    }
  },
  listProducts: async (params?: { q?: string; categoryId?: string; page?: number; pageSize?: number }) => {
    if (shouldFallbackToMock()) {
      const filtered = applyQuery(
        params?.categoryId
          ? mockProducts.filter((item) => item.categoryId === params.categoryId)
          : mockProducts,
        params?.q
      )
      return paginate(filtered, params?.page, params?.pageSize)
    }
    try {
      return await catalog.listProducts(params)
    } catch (error) {
      console.warn('catalog listProducts failed, fallback to mock', error)
      const filtered = applyQuery(
        params?.categoryId
          ? mockProducts.filter((item) => item.categoryId === params.categoryId)
          : mockProducts,
        params?.q
      )
      return paginate(filtered, params?.page, params?.pageSize)
    }
  },
  createProduct: async (payload: CreateCatalogProductRequest): Promise<ProductDetail> => {
    if (shouldFallbackToMock()) {
      const detail = buildFallbackProductDetail(`mock-${Date.now()}`)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name,
          categoryId: payload.categoryId,
          description: payload.description ?? detail.product.description,
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
    try {
      return await catalog.createProduct(payload)
    } catch (error) {
      console.warn('catalog createProduct failed, fallback to mock', error)
      const detail = buildFallbackProductDetail(`mock-${Date.now()}`)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name,
          categoryId: payload.categoryId,
          description: payload.description ?? detail.product.description,
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
  },
  updateProduct: async (spuId: string, payload: UpdateCatalogProductRequest): Promise<ProductDetail> => {
    if (shouldFallbackToMock()) {
      const detail = buildFallbackProductDetail(spuId)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name ?? detail.product.name,
          categoryId: payload.categoryId ?? detail.product.categoryId,
          description: payload.description === undefined ? detail.product.description : (payload.description ?? undefined),
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
    try {
      return await catalog.updateProduct(spuId, payload)
    } catch (error) {
      console.warn('catalog updateProduct failed, fallback to mock', error)
      const detail = buildFallbackProductDetail(spuId)
      return {
        ...detail,
        product: {
          ...detail.product,
          name: payload.name ?? detail.product.name,
          categoryId: payload.categoryId ?? detail.product.categoryId,
          description: payload.description === undefined ? detail.product.description : (payload.description ?? undefined),
          images: payload.images ?? detail.product.images,
          filterDimensions: payload.filterDimensions ?? detail.product.filterDimensions
        }
      }
    }
  },
  deleteProduct: async (spuId: string): Promise<void> => {
    if (shouldFallbackToMock()) {
      return
    }
    try {
      await catalog.deleteProduct(spuId)
    } catch (error) {
      console.warn('catalog deleteProduct failed, fallback to mock', error)
    }
  },
  getProductDetail: async (spuId: string): Promise<ProductDetail> => {
    if (shouldFallbackToMock()) {
      return getPersistedMockProductDetail(spuId)
    }
    try {
      return await catalog.getProductDetail(spuId)
    } catch (error) {
      console.warn('catalog getProductDetail failed, fallback to mock', error)
      return getPersistedMockProductDetail(spuId)
    }
  }
})

const createMockedWishlist = (wishlist: CommerceServices['wishlist']): CommerceServices['wishlist'] => ({
  list: async (): Promise<WishlistItem[]> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      return toMockWishlist(state)
    }
    try {
      return await wishlist.list()
    } catch (error) {
      console.warn('wishlist list failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      return toMockWishlist(state)
    }
  },
  add: async (skuId: string): Promise<void> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      if (state.wishlistSkuIds.includes(skuId)) {
        return
      }
      const nextState: MockCommerceState = {
        ...state,
        wishlistSkuIds: [...state.wishlistSkuIds, skuId],
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return
    }
    try {
      await wishlist.add(skuId)
    } catch (error) {
      console.warn('wishlist add failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      if (state.wishlistSkuIds.includes(skuId)) {
        return
      }
      const nextState: MockCommerceState = {
        ...state,
        wishlistSkuIds: [...state.wishlistSkuIds, skuId],
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
    }
  },
  remove: async (skuId: string): Promise<void> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      const nextState: MockCommerceState = {
        ...state,
        wishlistSkuIds: state.wishlistSkuIds.filter((id) => id !== skuId),
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return
    }
    try {
      await wishlist.remove(skuId)
    } catch (error) {
      console.warn('wishlist remove failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      const nextState: MockCommerceState = {
        ...state,
        wishlistSkuIds: state.wishlistSkuIds.filter((id) => id !== skuId),
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
    }
  }
})

const createMockedCart = (cart: CommerceServices['cart']): CommerceServices['cart'] => ({
  ...cart,
  getCart: async (): Promise<Cart> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      return toMockCart(state)
    }
    try {
      return await cart.getCart()
    } catch (error) {
      console.warn('cart getCart failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      return toMockCart(state)
    }
  },
  addItem: async (skuId: string, qty: number): Promise<Cart> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      const safeQty = normalizeQty(qty)
      const existing = state.cartEntries.find((entry) => entry.skuId === skuId)
      const nextEntries = existing
        ? state.cartEntries.map((entry) => {
          if (entry.skuId !== skuId) return entry
          return {
            ...entry,
            qty: normalizeQty(entry.qty + safeQty)
          }
        })
        : [...state.cartEntries, { skuId, qty: safeQty }]
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: nextEntries,
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return toMockCart(nextState)
    }
    try {
      return await cart.addItem(skuId, qty)
    } catch (error) {
      console.warn('cart addItem failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      const safeQty = normalizeQty(qty)
      const existing = state.cartEntries.find((entry) => entry.skuId === skuId)
      const nextEntries = existing
        ? state.cartEntries.map((entry) => {
          if (entry.skuId !== skuId) return entry
          return {
            ...entry,
            qty: normalizeQty(entry.qty + safeQty)
          }
        })
        : [...state.cartEntries, { skuId, qty: safeQty }]
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: nextEntries,
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return toMockCart(nextState)
    }
  },
  updateItemQty: async (itemId: string, qty: number): Promise<Cart> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      const skuId = toSkuIdFromCartItemId(itemId)
      const safeQty = normalizeQty(qty)
      const exists = state.cartEntries.some((entry) => entry.skuId === skuId)
      const nextEntries = exists
        ? state.cartEntries.map((entry) => {
          if (entry.skuId !== skuId) return entry
          return { ...entry, qty: safeQty }
        })
        : [...state.cartEntries, { skuId, qty: safeQty }]
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: nextEntries,
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return toMockCart(nextState)
    }
    try {
      return await cart.updateItemQty(itemId, qty)
    } catch (error) {
      console.warn('cart updateItemQty failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      const skuId = toSkuIdFromCartItemId(itemId)
      const safeQty = normalizeQty(qty)
      const exists = state.cartEntries.some((entry) => entry.skuId === skuId)
      const nextEntries = exists
        ? state.cartEntries.map((entry) => {
          if (entry.skuId !== skuId) return entry
          return { ...entry, qty: safeQty }
        })
        : [...state.cartEntries, { skuId, qty: safeQty }]
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: nextEntries,
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return toMockCart(nextState)
    }
  },
  removeItem: async (itemId: string): Promise<void> => {
    if (shouldFallbackToMock()) {
      const state = await loadMockCommerceState()
      const skuId = toSkuIdFromCartItemId(itemId)
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: state.cartEntries.filter((entry) => entry.skuId !== skuId),
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
      return
    }
    try {
      await cart.removeItem(itemId)
    } catch (error) {
      console.warn('cart removeItem failed, fallback to mock', error)
      const state = await loadMockCommerceState()
      const skuId = toSkuIdFromCartItemId(itemId)
      const nextState: MockCommerceState = {
        ...state,
        cartEntries: state.cartEntries.filter((entry) => entry.skuId !== skuId),
        updatedAt: nowIso()
      }
      await saveMockCommerceState(nextState)
    }
  }
})

const createCommerceServicesWithFallback = (): CommerceServices => {
  const services = createCommerceServices({
    baseUrl: requireCommerceBaseUrl(),
    devToken: runtimeEnv.commerceDevToken
  })
  if (!shouldFallbackToMock()) {
    return services
  }
  return {
    ...services,
    catalog: createMockedCatalog(services.catalog),
    cart: createMockedCart(services.cart),
    wishlist: createMockedWishlist(services.wishlist)
  }
}

const createCommerceServicesRuntime = (): CommerceServices => {
  if (runtimeEnv.isIsolatedMock) {
    return createMockCommerceServices()
  }
  return createCommerceServicesWithFallback()
}

export const commerceServices = createCommerceServicesRuntime()
