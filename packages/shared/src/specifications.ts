/** Product-local, ordered specification dimensions. Empty dimensions denote legacy SKUs. */
export type SpecDimensions = readonly string[] | null | undefined

export interface SpecificationSku {
  id?: string
  name?: string
  spec?: string | null
  attributes?: Record<string, string> | null
  isActive?: boolean
}

export const MAX_SPEC_DIMENSIONS = 3

export function normalizeSpecDimensions(dimensions: SpecDimensions): string[] {
  return dimensions?.length ? dimensions.map((name) => name.trim()) : ['规格']
}

export function getSkuSpecValues(dimensions: SpecDimensions, sku: SpecificationSku): string[] {
  if (!dimensions?.length) return [sku.spec?.trim() || sku.name?.trim() || '']
  return normalizeSpecDimensions(dimensions).map((name) => {
    const value = sku.attributes && Object.prototype.hasOwnProperty.call(sku.attributes, name)
      ? sku.attributes[name]
      : undefined
    return typeof value === 'string' ? value.trim() : ''
  })
}

export function formatSpecPath(values: readonly string[]): string {
  return values.map((value) => value.trim()).join(' / ')
}

export function formatSkuSpec(dimensions: SpecDimensions, sku: SpecificationSku): string {
  const values = getSkuSpecValues(dimensions, sku)
  return values.every(Boolean) ? formatSpecPath(values) : sku.spec?.trim() || sku.name?.trim() || ''
}

export interface SpecValidationIssue {
  code: 'dimension_count' | 'dimension_name' | 'dimension_duplicate' | 'value_required' | 'combination_duplicate'
  message: string
  rowIndex?: number
  otherRowIndex?: number
}

export function validateProductSpecs(dimensions: SpecDimensions, skus: readonly SpecificationSku[]): SpecValidationIssue[] {
  const names = normalizeSpecDimensions(dimensions)
  const issues: SpecValidationIssue[] = []
  if (names.length > MAX_SPEC_DIMENSIONS) issues.push({ code: 'dimension_count', message: '商品规格最多支持三个层级' })
  if (names.some((name) => !name)) issues.push({ code: 'dimension_name', message: '规格层级名称不能为空' })
  if (new Set(names).size !== names.length) issues.push({ code: 'dimension_duplicate', message: '规格层级名称不能重复' })
  const combinations = new Map<string, number>()
  skus.forEach((sku, rowIndex) => {
    const values = getSkuSpecValues(dimensions, sku)
    // Disabled historical SKUs may retain a previous dimension structure.
    if (sku.isActive === false) return
    if (values.some((value) => !value)) {
      issues.push({ code: 'value_required', message: `第 ${rowIndex + 1} 行规格值未填写完整`, rowIndex })
      return
    }
    const key = JSON.stringify(values)
    const otherRowIndex = combinations.get(key)
    if (otherRowIndex !== undefined) {
      issues.push({ code: 'combination_duplicate', message: `第 ${rowIndex + 1} 行与第 ${otherRowIndex + 1} 行规格组合重复`, rowIndex, otherRowIndex })
    } else combinations.set(key, rowIndex)
  })
  return issues
}

/** Keep only active, fully specified SKUs. Never truncate malformed multi-level data. */
export function getPurchasableSpecSkus<T extends SpecificationSku>(dimensions: SpecDimensions, skus: readonly T[]): T[] {
  const names = normalizeSpecDimensions(dimensions)
  if (names.length > MAX_SPEC_DIMENSIONS || names.some((name) => !name) || new Set(names).size !== names.length) return []
  return skus.filter((sku) => sku.isActive !== false && getSkuSpecValues(dimensions, sku).every(Boolean))
}

export function getSpecLevelOptions(dimensions: SpecDimensions, skus: readonly SpecificationSku[], selection: readonly string[], level: number): string[] {
  if (level < 0 || level >= normalizeSpecDimensions(dimensions).length) return []
  if (Array.from({ length: level }, (_, index) => selection[index]).some((value) => !value)) return []
  return [...new Set(getPurchasableSpecSkus(dimensions, skus)
    .map((sku) => getSkuSpecValues(dimensions, sku))
    .filter((values) => values.slice(0, level).every((value, index) => value === selection[index]))
    .map((values) => values[level]))]
}

export function selectSpecValue(selection: readonly string[], level: number, value: string): string[] {
  return [...selection.slice(0, level), value]
}

export function findSkuBySpecSelection<T extends SpecificationSku>(dimensions: SpecDimensions, skus: readonly T[], selection: readonly string[]): T | undefined {
  if (selection.length !== normalizeSpecDimensions(dimensions).length || selection.some((value) => !value)) return undefined
  return getPurchasableSpecSkus(dimensions, skus).find((sku) => getSkuSpecValues(dimensions, sku).every((value, index) => value === selection[index]))
}
