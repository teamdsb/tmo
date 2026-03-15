import Taro from '@tarojs/taro'

export type EditableProfile = {
  displayName: string
  phone: string
}

const PROFILE_STORAGE_KEY = 'tmo.profile'

const normalizeDisplayName = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : ''
}

const normalizePhone = (value: unknown) => {
  return typeof value === 'string' ? value.replace(/\s+/g, '').trim() : ''
}

export const loadEditableProfile = (): EditableProfile | null => {
  try {
    const value = Taro.getStorageSync(PROFILE_STORAGE_KEY)
    if (!value || typeof value !== 'object') {
      return null
    }

    const record = value as Record<string, unknown>
    return {
      displayName: normalizeDisplayName(record.displayName),
      phone: normalizePhone(record.phone)
    }
  } catch {
    return null
  }
}

export const saveEditableProfile = (value: EditableProfile) => {
  const normalized = {
    displayName: normalizeDisplayName(value.displayName),
    phone: normalizePhone(value.phone)
  }
  Taro.setStorageSync(PROFILE_STORAGE_KEY, normalized)
}
