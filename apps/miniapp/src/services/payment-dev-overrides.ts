import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'

const paymentOverrideStorageKey = 'tmo:payment:dev-overrides'
const devFakePaymentPrefix = 'pay_dev_fake_'

export interface DevFakePaymentOverride {
  orderId: string
  paymentStatus: 'PAID'
  status: 'PAID'
  latestPaymentId: string
  paidAt: string
  updatedAt: string
}

type DevFakePaymentOverrideMap = Record<string, DevFakePaymentOverride>

const normalizeOverrideMap = (value: unknown): DevFakePaymentOverrideMap => {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as DevFakePaymentOverrideMap
}

const loadOverrideMap = async (): Promise<DevFakePaymentOverrideMap> => {
  try {
    const result = await getStorage<DevFakePaymentOverrideMap>(paymentOverrideStorageKey)
    return normalizeOverrideMap(result.data)
  } catch {
    return {}
  }
}

const saveOverrideMap = async (value: DevFakePaymentOverrideMap): Promise<void> => {
  await setStorage(paymentOverrideStorageKey, value)
}

export const buildDevFakePaymentId = (orderId: string): string => `${devFakePaymentPrefix}${orderId}`

export const isDevFakePaymentId = (paymentId: string): boolean => paymentId.startsWith(devFakePaymentPrefix)

export const createDevFakePaymentOverride = (orderId: string, now = new Date().toISOString()): DevFakePaymentOverride => ({
  orderId,
  paymentStatus: 'PAID',
  status: 'PAID',
  latestPaymentId: buildDevFakePaymentId(orderId),
  paidAt: now,
  updatedAt: now
})

export const loadDevFakePaymentOverride = async (orderId: string): Promise<DevFakePaymentOverride | null> => {
  const overrides = await loadOverrideMap()
  return overrides[orderId] ?? null
}

export const saveDevFakePaymentOverride = async (override: DevFakePaymentOverride): Promise<void> => {
  const overrides = await loadOverrideMap()
  overrides[override.orderId] = override
  await saveOverrideMap(overrides)
}

export const clearDevFakePaymentOverride = async (orderId: string): Promise<void> => {
  const overrides = await loadOverrideMap()
  if (!overrides[orderId]) {
    return
  }
  delete overrides[orderId]
  if (Object.keys(overrides).length === 0) {
    await removeStorage(paymentOverrideStorageKey)
    return
  }
  await saveOverrideMap(overrides)
}
