import Taro from '@tarojs/taro'

const SUPPORT_COMPOSE_INTENT_KEY = 'tmo:support:compose-intent'

export type ProductInquiryComposeIntent = {
  kind: 'product_inquiry'
  productId: string
  productName: string
  productImageUrl?: string
  message: string
}

export type SupportComposeIntent = ProductInquiryComposeIntent

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const normalizeString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const parseSupportComposeIntent = (value: unknown): SupportComposeIntent | null => {
  if (!isObjectRecord(value)) {
    return null
  }

  const kind = normalizeString(value.kind)
  if (kind !== 'product_inquiry') {
    return null
  }

  const productId = normalizeString(value.productId)
  const productName = normalizeString(value.productName)
  const message = normalizeString(value.message)
  if (!productId || !productName || !message) {
    return null
  }

  const productImageUrl = normalizeString(value.productImageUrl)
  return {
    kind: 'product_inquiry',
    productId,
    productName,
    productImageUrl: productImageUrl || undefined,
    message
  }
}

export const saveSupportComposeIntent = async (intent: SupportComposeIntent): Promise<void> => {
  await Taro.setStorage({
    key: SUPPORT_COMPOSE_INTENT_KEY,
    data: intent
  })
}

export const loadSupportComposeIntent = async (): Promise<SupportComposeIntent | null> => {
  try {
    const result = await Taro.getStorage({ key: SUPPORT_COMPOSE_INTENT_KEY })
    return parseSupportComposeIntent(result.data)
  } catch {
    return null
  }
}

export const clearSupportComposeIntent = async (): Promise<void> => {
  try {
    await Taro.removeStorage({ key: SUPPORT_COMPOSE_INTENT_KEY })
  } catch {
    // ignore missing storage entry
  }
}
