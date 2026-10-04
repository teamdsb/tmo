import type { CartImportSelection } from '@tmo/api-client'

export type SelectionMap = Record<number, CartImportSelection>
export type ImportTab = 'to-confirm' | 'confirmed'
export type MatchTypeBadge = { label: string; className: string }
