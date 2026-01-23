export interface OrderFingerprintItem {
  skuId: string
  qty: number
}

export interface OrderFingerprintInput {
  items: OrderFingerprintItem[]
  address: unknown
  remark?: string | null
}

export interface OrderIdempotency {
  getKey: (draft: OrderFingerprintInput) => string
  reset: () => void
}

const generateIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const rand = Math.random().toString(36).slice(2)
  const time = Date.now().toString(36)
  return `idem_${time}_${rand}`
}

const fingerprintDraft = (draft: OrderFingerprintInput): string => {
  const items = [...draft.items].sort((a, b) => a.skuId.localeCompare(b.skuId))
  return JSON.stringify({
    items,
    address: draft.address,
    remark: draft.remark ?? null
  })
}

export const createOrderIdempotency = (): OrderIdempotency => {
  let lastFingerprint = ''
  let lastKey = ''

  return {
    getKey: (draft) => {
      const fingerprint = fingerprintDraft(draft)
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint
        lastKey = generateIdempotencyKey()
      }
      return lastKey
    },
    reset: () => {
      lastFingerprint = ''
      lastKey = ''
    }
  }
}
