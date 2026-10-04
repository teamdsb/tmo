import type { CartImportPendingItem } from '@tmo/api-client'
import type { MatchTypeBadge } from './types'

export const MATCH_TYPE_BADGES: Record<string, MatchTypeBadge> = {
  AMBIGUOUS: { label: '匹配不确定', className: 'bg-amber-50 text-amber-600' },
  NOT_FOUND: { label: '未找到', className: 'bg-red-50 text-red-600' }
}

export const formatPendingMeta = (item: CartImportPendingItem) => {
  const parts = [
    item.rawSpec?.trim() || null,
    item.rawQty ? `数量 ${item.rawQty}` : null,
    `行 ${item.rowNo}`
  ].filter(Boolean)
  return parts.join(' • ')
}
