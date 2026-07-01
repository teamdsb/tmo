export const formatPhoneForDisplay = (
  phone: string | null | undefined,
  emptyValue = '未设置'
): string => {
  const value = String(phone || '').trim()
  if (!value) {
    return emptyValue
  }
  if (!value.startsWith('+86')) {
    return value
  }
  const nationalNumber = value.slice(3).replace(/\s+/g, '')
  return nationalNumber ? `+86 ${nationalNumber}` : '+86'
}
