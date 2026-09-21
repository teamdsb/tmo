import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { findSkuBySpecSelection, formatSkuSpec, getPurchasableSpecSkus, getSkuSpecValues, normalizeSpecDimensions, validateProductSpecs } from '@tmo/shared'
import SpecSelector from './index'

const dimensions = ['材质', '长度', '直径']
const skus = [
  { id: 'a', isActive: true, attributes: { 材质: '钢', 长度: '10mm', 直径: 'M8' } },
  { id: 'b', isActive: true, attributes: { 材质: '铜', 长度: '20mm', 直径: 'M10' } },
  { id: 'disabled', isActive: false, attributes: { 材质: '铝', 长度: '30mm', 直径: 'M12' } }
]

function Harness() {
  const [selection, setSelection] = useState<string[]>([])
  return <>
    <SpecSelector dimensions={dimensions} skus={skus} selection={selection} onChange={setSelection} />
    <span data-testid='selected'>{findSkuBySpecSelection(dimensions, skus, selection)?.id ?? 'none'}</span>
  </>
}

it('shows real combinations in order and clears subsequent selections when a parent changes', () => {
  render(<Harness />)
  expect(screen.getByText('请先选择材质')).toBeInTheDocument()
  expect(screen.queryByText('10mm')).not.toBeInTheDocument()
  expect(screen.queryByText('铝')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('钢'))
  expect(screen.getByText('10mm')).toBeInTheDocument()
  expect(screen.queryByText('20mm')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('10mm'))
  fireEvent.click(screen.getByText('M8'))
  expect(screen.getByTestId('selected')).toHaveTextContent('a')
  fireEvent.click(screen.getByText('铜'))
  expect(screen.getByTestId('selected')).toHaveTextContent('none')
  expect(screen.queryByText('M8')).not.toBeInTheDocument()
  expect(screen.getByText('请先选择长度')).toBeInTheDocument()
  fireEvent.click(screen.getByText('20mm'))
  fireEvent.click(screen.getByText('M10'))
  expect(screen.getByTestId('selected')).toHaveTextContent('b')
})

it('keeps legacy specs and full ordered paths, without truncating malformed dimensions', () => {
  expect(formatSkuSpec([], { spec: ' M8 / 钢 ' })).toBe('M8 / 钢')
  expect(formatSkuSpec(undefined, { name: '默认型号' })).toBe('默认型号')
  expect(formatSkuSpec(dimensions, skus[0])).toBe('钢 / 10mm / M8')
  expect(normalizeSpecDimensions(['一', '二', '三', '四'])).toHaveLength(4)
  expect(getPurchasableSpecSkus(['一', '二', '三', '四'], skus)).toEqual([])
})

it('validates dimension names, missing values and active duplicate combinations', () => {
  expect(validateProductSpecs(['', '同名', '同名', '四'], []).map((issue) => issue.code))
    .toEqual(['dimension_count', 'dimension_name', 'dimension_duplicate'])
  const issues = validateProductSpecs(dimensions, [skus[0], { ...skus[0], id: 'duplicate' }, { attributes: {} }, { isActive: false, attributes: {} }])
  expect(issues).toEqual([
    expect.objectContaining({ code: 'combination_duplicate', rowIndex: 1, otherRowIndex: 0 }),
    expect.objectContaining({ code: 'value_required', rowIndex: 2 })
  ])
})


it.each(['constructor', '__proto__'])('treats %s as an ordinary own specification key', (name) => {
  const missing = { id: 'missing', attributes: Object.fromEntries([]), isActive: true }
  const present = { id: 'present', attributes: Object.fromEntries([[name, ' 自定义值 ']]), isActive: true }
  expect(getSkuSpecValues([name], missing)).toEqual([''])
  expect(validateProductSpecs([name], [missing])).toEqual([
    expect.objectContaining({ code: 'value_required', rowIndex: 0 })
  ])
  expect(getPurchasableSpecSkus([name], [missing, present])).toEqual([present])
  expect(getSkuSpecValues([name], present)).toEqual(['自定义值'])
  expect(formatSkuSpec([name], present)).toBe('自定义值')
  expect(validateProductSpecs([name], [present])).toEqual([])
  expect(findSkuBySpecSelection([name], [missing, present], ['自定义值'])).toBe(present)
})

it('ignores inherited and non-string attribute values when reading specification levels', () => {
  const inherited = Object.create({ 尺寸: '继承值' })
  const malformed = Object.fromEntries([['尺寸', 123]]) as unknown as Record<string, string>
  expect(getSkuSpecValues(['尺寸'], { attributes: inherited })).toEqual([''])
  expect(getSkuSpecValues(['尺寸'], { attributes: malformed })).toEqual([''])
})
