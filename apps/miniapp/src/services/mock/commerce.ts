import type { CommerceServices } from '@tmo/commerce-services'
import {
  ImportJobType,
  JobStatus,
  MessageSenderType,
  OrderStatus,
  PriceInquiryStatus,
  TicketStatus,
  type AfterSalesMessage,
  type AfterSalesTicket,
  type Cart,
  type CartImportJob,
  type CartImportSelection,
  type Category,
  type ImportJob,
  type Order,
  type PriceTier,
  type PriceInquiry,
  type ProductDetail,
  type ProductRequest,
  type ProductRequestAsset,
  type ProductSummary,
  type Sku,
  type TrackingInfo,
  type WishlistItem
} from '@tmo/api-client'
import type { ChooseFile } from '@tmo/platform-adapter'
import { runtimeEnv } from '../../config/runtime-env'
import { buildMockProductDetail, mockCategories, mockProductDetails, mockProducts } from '../mocks/catalog'
import {
  createIsolatedTokenStore,
  getMockUser,
  loadIsolatedMockState,
  nowIso,
  type IsolatedMockState,
  type MockCartEntry,
  updateIsolatedMockState
} from './runtime'

const mockCartItemIdPrefix = 'mock-cart-'
const mockExcelMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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

const getMockSkuById = (
  skuId: string,
  skuPriceTiersBySkuId?: Record<string, PriceTier[]>
): Sku => {
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

const toMockWishlist = (state: IsolatedMockState): WishlistItem[] => {
  return state.wishlistSkuIds.map((skuId) => ({
    sku: getMockSkuById(skuId, state.skuPriceTiersBySkuId),
    createdAt: state.updatedAt
  }))
}

const toMockCart = (state: IsolatedMockState): Cart => {
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
  state: IsolatedMockState,
  detail: ProductDetail
): IsolatedMockState => {
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
    skuPriceTiersBySkuId: nextMap
  }
}

const applyQuery = (items: ProductSummary[], query?: string) => {
  if (!query) return items
  const keyword = query.trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) => item.name.toLowerCase().includes(keyword)
    || item.id.toLowerCase().includes(keyword))
}

const paginate = <T>(items: T[], page?: number, pageSize?: number) => {
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

const ensureCategory = (categoryId: string): Category => {
  const category = mockCategories.find((item) => item.id === categoryId)
  if (!category) {
    throw new Error(`category not found: ${categoryId}`)
  }
  return category
}

const toCartImportJob = (jobId: string): CartImportJob => ({
  id: jobId,
  type: ImportJobType.CART_IMPORT,
  status: JobStatus.SUCCEEDED,
  progress: 100,
  createdAt: nowIso(),
  result: {
    autoAddedCount: 0,
    pendingCount: 0,
    autoAddedItems: [],
    pendingItems: []
  }
})

const toShipmentImportJob = (): ImportJob => ({
  id: `mock-shipment-import-${Date.now().toString(36)}`,
  type: ImportJobType.SHIPMENT_IMPORT,
  status: JobStatus.SUCCEEDED,
  progress: 100,
  createdAt: nowIso()
})

const getFirstSkuPrice = (sku: Sku): number => {
  return sku.priceTiers?.[0]?.unitPriceFen ?? 0
}

const getFileNameFromPath = (filePath: string): string => {
  const sanitized = filePath.trim()
  if (!sanitized) {
    return 'mock-file'
  }
  const segments = sanitized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return 'mock-file'
  }
  return segments[segments.length - 1]
}

export const createMockCommerceServices = (): CommerceServices => {
  const tokens = createIsolatedTokenStore(runtimeEnv.commerceDevToken)

  const catalog: CommerceServices['catalog'] = {
    listCategories: async () => ({ items: mockCategories }),
    getCategory: async (categoryId) => ensureCategory(categoryId),
    createCategory: async (payload) => ({
      id: `mock-category-${Date.now().toString(36)}`,
      name: payload.name,
      parentId: payload.parentId ?? null,
      sort: payload.sort ?? 0
    }),
    updateCategory: async (categoryId, payload) => {
      const found = ensureCategory(categoryId)
      return {
        id: found.id,
        name: payload.name ?? found.name,
        parentId: payload.parentId === undefined ? (found.parentId ?? null) : payload.parentId,
        sort: payload.sort ?? found.sort
      }
    },
    deleteCategory: async () => {},
    listProducts: async (params) => {
      const filtered = applyQuery(
        params?.categoryId
          ? mockProducts.filter((item) => item.categoryId === params.categoryId)
          : mockProducts,
        params?.q
      )
      return paginate(filtered, params?.page, params?.pageSize)
    },
    createProduct: async (payload) => {
      const detail = buildFallbackProductDetail(`mock-product-${Date.now().toString(36)}`)
      const updatedDetail = {
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
      const state = await loadIsolatedMockState()
      const result = applyProductDetailPriceTierOverrides(updatedDetail, state.skuPriceTiersBySkuId)
      const nextState = ensureStateIncludesSkuPriceTiers(state, result)
      if (nextState !== state) {
        await updateIsolatedMockState((current) => ensureStateIncludesSkuPriceTiers(current, result))
      }
      return result
    },
    updateProduct: async (spuId, payload) => {
      const baseDetail = buildFallbackProductDetail(spuId)
      const state = await loadIsolatedMockState()
      const detail = applyProductDetailPriceTierOverrides(baseDetail, state.skuPriceTiersBySkuId)
      const result = {
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
      const nextState = ensureStateIncludesSkuPriceTiers(state, result)
      if (nextState !== state) {
        await updateIsolatedMockState((current) => ensureStateIncludesSkuPriceTiers(current, result))
      }
      return result
    },
    deleteProduct: async () => {},
    getProductDetail: async (spuId) => {
      const state = await loadIsolatedMockState()
      const detail = applyProductDetailPriceTierOverrides(
        buildFallbackProductDetail(spuId),
        state.skuPriceTiersBySkuId
      )
      const nextState = ensureStateIncludesSkuPriceTiers(state, detail)
      if (nextState !== state) {
        await updateIsolatedMockState((current) => ensureStateIncludesSkuPriceTiers(current, detail))
      }
      return detail
    }
  }

  const wishlist: CommerceServices['wishlist'] = {
    list: async () => {
      const state = await loadIsolatedMockState()
      return toMockWishlist(state)
    },
    add: async (skuId) => {
      await updateIsolatedMockState((state) => {
        if (state.wishlistSkuIds.includes(skuId)) {
          return state
        }
        return {
          ...state,
          wishlistSkuIds: [...state.wishlistSkuIds, skuId]
        }
      })
    },
    remove: async (skuId) => {
      await updateIsolatedMockState((state) => ({
        ...state,
        wishlistSkuIds: state.wishlistSkuIds.filter((id) => id !== skuId)
      }))
    }
  }

  const cart: CommerceServices['cart'] = {
    getCart: async () => {
      const state = await loadIsolatedMockState()
      return toMockCart(state)
    },
    addItem: async (skuId, qty) => {
      const nextState = await updateIsolatedMockState((state) => {
        const safeQty = normalizeQty(qty)
        const existing = state.cartEntries.find((entry) => entry.skuId === skuId)
        const cartEntries: MockCartEntry[] = existing
          ? state.cartEntries.map((entry) => {
            if (entry.skuId !== skuId) {
              return entry
            }
            return {
              ...entry,
              qty: normalizeQty(entry.qty + safeQty)
            }
          })
          : [...state.cartEntries, { skuId, qty: safeQty }]
        return {
          ...state,
          cartEntries
        }
      })
      return toMockCart(nextState)
    },
    updateItemQty: async (itemId, qty) => {
      const nextState = await updateIsolatedMockState((state) => {
        const skuId = toSkuIdFromCartItemId(itemId)
        const safeQty = normalizeQty(qty)
        const exists = state.cartEntries.some((entry) => entry.skuId === skuId)
        const cartEntries = exists
          ? state.cartEntries.map((entry) => {
            if (entry.skuId !== skuId) {
              return entry
            }
            return { ...entry, qty: safeQty }
          })
          : [...state.cartEntries, { skuId, qty: safeQty }]
        return {
          ...state,
          cartEntries
        }
      })
      return toMockCart(nextState)
    },
    removeItem: async (itemId) => {
      await updateIsolatedMockState((state) => {
        const skuId = toSkuIdFromCartItemId(itemId)
        return {
          ...state,
          cartEntries: state.cartEntries.filter((entry) => entry.skuId !== skuId)
        }
      })
    },
    uploadImportExcel: async () => {
      return toCartImportJob(`mock-cart-import-${Date.now().toString(36)}`)
    },
    getImportJob: async (jobId) => {
      return toCartImportJob(jobId)
    },
    confirmImport: async (_jobId, selections) => {
      const nextState = await updateIsolatedMockState((state) => {
        let cartEntries = [...state.cartEntries]
        selections.forEach((selection: CartImportSelection) => {
          const qty = normalizeQty(selection.qty ?? 1)
          const index = cartEntries.findIndex((entry) => entry.skuId === selection.skuId)
          if (index < 0) {
            cartEntries.push({
              skuId: selection.skuId,
              qty
            })
            return
          }
          cartEntries[index] = {
            ...cartEntries[index],
            qty: normalizeQty(cartEntries[index].qty + qty)
          }
        })
        return {
          ...state,
          cartEntries
        }
      })
      return toMockCart(nextState)
    }
  }

  const orders: CommerceServices['orders'] = {
    submit: async (request) => {
      const currentState = await loadIsolatedMockState()
      const createdAt = nowIso()
      const order: Order = {
        id: `mock-order-${Date.now().toString(36)}`,
        status: OrderStatus.SUBMITTED,
        address: request.address,
        items: request.items.map((item) => {
          const sku = getMockSkuById(item.skuId, currentState.skuPriceTiersBySkuId)
          return {
            sku,
            qty: normalizeQty(item.qty),
            unitPriceFen: getFirstSkuPrice(sku)
          }
        }),
        remark: request.remark,
        createdAt,
        updatedAt: createdAt
      }

      await updateIsolatedMockState((state) => ({
        ...state,
        orders: [order, ...state.orders],
        trackingByOrderId: {
          ...state.trackingByOrderId,
          [order.id]: {
            orderId: order.id,
            shipments: []
          }
        }
      }))

      return order
    },
    list: async (params) => {
      const state = await loadIsolatedMockState()
      const filtered = params?.status
        ? state.orders.filter((order) => order.status === params.status)
        : state.orders
      return paginate(filtered, params?.page, params?.pageSize)
    },
    get: async (orderId) => {
      const state = await loadIsolatedMockState()
      const order = state.orders.find((item) => item.id === orderId)
      if (!order) {
        throw new Error(`order not found: ${orderId}`)
      }
      return order
    },
    resetIdempotency: () => {}
  }

  const tracking: CommerceServices['tracking'] = {
    getTracking: async (orderId) => {
      const state = await loadIsolatedMockState()
      return state.trackingByOrderId[orderId] ?? { orderId, shipments: [] }
    },
    updateTracking: async (orderId, request) => {
      const trackingInfo: TrackingInfo = {
        orderId,
        shipments: request.shipments
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        trackingByOrderId: {
          ...state.trackingByOrderId,
          [orderId]: trackingInfo
        }
      }))
      return trackingInfo
    },
    uploadShipmentImportExcel: async () => toShipmentImportJob()
  }

  const productRequests: CommerceServices['productRequests'] = {
    list: async (params) => {
      const state = await loadIsolatedMockState()
      const createdAfter = params?.createdAfter ? Date.parse(params.createdAfter) : Number.NaN
      const createdBefore = params?.createdBefore ? Date.parse(params.createdBefore) : Number.NaN
      const filtered = state.productRequests.filter((item) => {
        const createdAt = Date.parse(item.createdAt)
        if (Number.isFinite(createdAfter) && createdAt < createdAfter) {
          return false
        }
        if (Number.isFinite(createdBefore) && createdAt > createdBefore) {
          return false
        }
        return true
      })
      return paginate(filtered, params?.page, params?.pageSize)
    },
    create: async (payload) => {
      const productRequest: ProductRequest = {
        id: `mock-pr-${Date.now().toString(36)}`,
        createdByUserId: getMockUser().id,
        name: payload.name,
        categoryId: payload.categoryId ?? null,
        spec: payload.spec,
        material: payload.material,
        dimensions: payload.dimensions,
        color: payload.color,
        qty: payload.qty,
        note: payload.note,
        referenceImageUrls: payload.referenceImageUrls ?? [],
        createdAt: nowIso()
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        productRequests: [productRequest, ...state.productRequests]
      }))
      return productRequest
    },
    uploadAsset: async (filePath) => {
      const fileName = getFileNameFromPath(filePath)
      const asset: ProductRequestAsset = {
        url: `mock://product-request-assets/${encodeURIComponent(fileName)}`,
        contentType: 'image/png',
        size: 0
      }
      return asset
    }
  }

  const afterSales: CommerceServices['afterSales'] = {
    listTickets: async (params) => {
      const state = await loadIsolatedMockState()
      const filtered = state.afterSalesTickets.filter((ticket) => {
        if (params?.status && ticket.status !== params.status) {
          return false
        }
        if (params?.orderId && ticket.orderId !== params.orderId) {
          return false
        }
        return true
      })
      return paginate(filtered, params?.page, params?.pageSize)
    },
    createTicket: async (payload) => {
      const ticket: AfterSalesTicket = {
        id: `mock-ticket-${Date.now().toString(36)}`,
        status: TicketStatus.OPEN,
        orderId: payload.orderId ?? null,
        assignedStaffUserId: null,
        subject: payload.subject,
        description: payload.description,
        createdAt: nowIso(),
        updatedAt: null
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        afterSalesTickets: [ticket, ...state.afterSalesTickets]
      }))
      return ticket
    },
    getTicket: async (ticketId) => {
      const state = await loadIsolatedMockState()
      const ticket = state.afterSalesTickets.find((item) => item.id === ticketId)
      if (!ticket) {
        throw new Error(`ticket not found: ${ticketId}`)
      }
      return ticket
    },
    updateTicket: async (ticketId, payload) => {
      let updated: AfterSalesTicket | null = null
      await updateIsolatedMockState((state) => {
        const afterSalesTickets = state.afterSalesTickets.map((ticket) => {
          if (ticket.id !== ticketId) {
            return ticket
          }
          updated = {
            ...ticket,
            status: payload.status ?? ticket.status,
            assignedStaffUserId: payload.assignedStaffUserId === undefined
              ? (ticket.assignedStaffUserId ?? null)
              : payload.assignedStaffUserId,
            updatedAt: nowIso()
          }
          return updated
        })
        return {
          ...state,
          afterSalesTickets
        }
      })
      if (!updated) {
        throw new Error(`ticket not found: ${ticketId}`)
      }
      return updated
    },
    listMessages: async (ticketId, params) => {
      const state = await loadIsolatedMockState()
      const messages = state.afterSalesMessagesByTicketId[ticketId] ?? []
      return paginate(messages, params?.page, params?.pageSize)
    },
    postMessage: async (ticketId, payload) => {
      const message: AfterSalesMessage = {
        id: `mock-ticket-msg-${Date.now().toString(36)}`,
        ticketId,
        senderType: MessageSenderType.customer,
        senderUserId: getMockUser().id,
        content: payload.content,
        createdAt: nowIso()
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        afterSalesMessagesByTicketId: {
          ...state.afterSalesMessagesByTicketId,
          [ticketId]: [
            ...(state.afterSalesMessagesByTicketId[ticketId] ?? []),
            message
          ]
        }
      }))
      return message
    }
  }

  const inquiries: CommerceServices['inquiries'] = {
    list: async (params) => {
      const state = await loadIsolatedMockState()
      return paginate(state.inquiries, params?.page, params?.pageSize)
    },
    create: async (payload) => {
      const inquiry: PriceInquiry = {
        id: `mock-inquiry-${Date.now().toString(36)}`,
        createdByUserId: getMockUser().id,
        assignedSalesUserId: null,
        skuId: payload.skuId ?? null,
        orderId: payload.orderId ?? null,
        message: payload.message,
        status: PriceInquiryStatus.OPEN,
        responseNote: null,
        createdAt: nowIso(),
        updatedAt: null
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        inquiries: [inquiry, ...state.inquiries]
      }))
      return inquiry
    },
    get: async (inquiryId) => {
      const state = await loadIsolatedMockState()
      const inquiry = state.inquiries.find((item) => item.id === inquiryId)
      if (!inquiry) {
        throw new Error(`inquiry not found: ${inquiryId}`)
      }
      return inquiry
    },
    update: async (inquiryId, payload) => {
      let updated: PriceInquiry | null = null
      await updateIsolatedMockState((state) => {
        const nextInquiries = state.inquiries.map((inquiry) => {
          if (inquiry.id !== inquiryId) {
            return inquiry
          }
          updated = {
            ...inquiry,
            status: payload.status ?? inquiry.status,
            assignedSalesUserId: payload.assignedSalesUserId === undefined
              ? (inquiry.assignedSalesUserId ?? null)
              : payload.assignedSalesUserId,
            responseNote: payload.responseNote === undefined
              ? (inquiry.responseNote ?? null)
              : payload.responseNote,
            updatedAt: nowIso()
          }
          return updated
        })
        return {
          ...state,
          inquiries: nextInquiries
        }
      })
      if (!updated) {
        throw new Error(`inquiry not found: ${inquiryId}`)
      }
      return updated
    },
    listMessages: async (inquiryId, params) => {
      const state = await loadIsolatedMockState()
      const messages = state.inquiryMessagesByInquiryId[inquiryId] ?? []
      return paginate(messages, params?.page, params?.pageSize)
    },
    postMessage: async (inquiryId, payload) => {
      const message = {
        id: `mock-inquiry-msg-${Date.now().toString(36)}`,
        inquiryId,
        senderType: MessageSenderType.customer,
        senderUserId: getMockUser().id,
        content: payload.content,
        createdAt: nowIso()
      }
      await updateIsolatedMockState((state) => ({
        ...state,
        inquiryMessagesByInquiryId: {
          ...state.inquiryMessagesByInquiryId,
          [inquiryId]: [
            ...(state.inquiryMessagesByInquiryId[inquiryId] ?? []),
            message
          ]
        }
      }))
      return message
    }
  }

  const files = {
    chooseExcelFile: async (): Promise<ChooseFile> => ({
      path: '/tmp/mock.xlsx',
      name: 'mock.xlsx',
      size: 0,
      type: mockExcelMimeType
    })
  }

  return {
    catalog,
    cart,
    orders,
    tracking,
    wishlist,
    productRequests,
    afterSales,
    inquiries,
    files,
    tokens
  }
}
