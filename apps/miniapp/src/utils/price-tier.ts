import type { PriceTier } from '@tmo/api-client'

export const matchPriceTier = (tiers: PriceTier[] | undefined, qty: number): PriceTier | null => {
  if (!tiers || tiers.length === 0 || !Number.isFinite(qty)) {
    return null
  }

  const safeQty = Math.floor(qty)
  let selected: PriceTier | null = null

  for (const tier of tiers) {
    if (safeQty < tier.minQty) {
      continue
    }
    if (tier.maxQty !== null && tier.maxQty !== undefined && safeQty > tier.maxQty) {
      continue
    }
    selected = tier
  }

  return selected
}
