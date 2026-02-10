import Taro from '@tarojs/taro'

type RuntimeTaro = {
  getWindowInfo?: () => unknown
  getAppBaseInfo?: () => unknown
  getSystemInfoSync?: () => unknown
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }
  return null
}

export const getWindowSystemInfo = (): Record<string, unknown> => {
  const runtime = Taro as unknown as RuntimeTaro

  const windowInfo = asRecord(runtime.getWindowInfo?.())
  if (windowInfo) {
    return windowInfo
  }

  const legacySystemInfo = asRecord(runtime.getSystemInfoSync?.())
  if (legacySystemInfo) {
    return legacySystemInfo
  }

  return {}
}

export const getAppTheme = (): string | undefined => {
  const runtime = Taro as unknown as RuntimeTaro

  const appBaseInfo = asRecord(runtime.getAppBaseInfo?.())
  const appBaseTheme = appBaseInfo?.theme
  if (appBaseTheme === 'dark' || appBaseTheme === 'light') {
    return appBaseTheme
  }

  const legacySystemInfo = asRecord(runtime.getSystemInfoSync?.())
  const legacyTheme = legacySystemInfo?.theme
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    return legacyTheme
  }

  return undefined
}
