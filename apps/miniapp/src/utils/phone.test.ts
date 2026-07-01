import { formatPhoneForDisplay } from '@tmo/shared/formatters'

describe('formatPhoneForDisplay', () => {
  it.each([
    ['+8616360475622', '+86 16360475622'],
    ['+86 16360475622', '+86 16360475622'],
    ['+86   1636 047 5622', '+86 16360475622'],
    ['+15550000003', '+15550000003'],
    ['13800138000', '13800138000']
  ])('formats %s as %s', (input, expected) => {
    expect(formatPhoneForDisplay(input)).toBe(expected)
  })

  it('uses the requested empty value', () => {
    expect(formatPhoneForDisplay(null)).toBe('未设置')
    expect(formatPhoneForDisplay('  ', '-')).toBe('-')
  })
})
