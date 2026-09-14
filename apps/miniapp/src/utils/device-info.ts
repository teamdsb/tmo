import Taro from '@tarojs/taro'

type GenericRecord = Record<string, unknown>

export type RuntimeDeviceInfo = {
  statusBarHeight: number
  safeAreaTop: number
  bottomSafeArea: number
  bottomSafeAreaAvailable: boolean
  theme?: string
}

const toFinitePositiveNumber = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

const toFiniteNonNegativeNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

const toTheme = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return normalized
}

const getSafeAreaTop = (source: GenericRecord): number => {
  const safeArea = source.safeArea
  if (safeArea && typeof safeArea === 'object') {
    const top = toFinitePositiveNumber((safeArea as GenericRecord).top)
    if (top > 0) {
      return top
    }
  }

  const safeAreaInsets = source.safeAreaInsets
  if (safeAreaInsets && typeof safeAreaInsets === 'object') {
    const top = toFinitePositiveNumber((safeAreaInsets as GenericRecord).top)
    if (top > 0) {
      return top
    }
  }

  return 0
}

const getBottomSafeArea = (source: GenericRecord): { value: number; available: boolean } => {
  const safeAreaInsets = source.safeAreaInsets
  if (safeAreaInsets && typeof safeAreaInsets === 'object') {
    const bottom = toFiniteNonNegativeNumber((safeAreaInsets as GenericRecord).bottom)
    if (bottom !== null) {
      return { value: bottom, available: true }
    }
  }

  const safeArea = source.safeArea
  const screenHeight = toFinitePositiveNumber(source.screenHeight)
  if (safeArea && typeof safeArea === 'object' && screenHeight > 0) {
    const safeAreaBottom = toFinitePositiveNumber((safeArea as GenericRecord).bottom)
    if (safeAreaBottom > 0 && safeAreaBottom <= screenHeight) {
      return { value: screenHeight - safeAreaBottom, available: true }
    }
  }

  return { value: 0, available: false }
}

const getWindowInfoFromTaro = (): GenericRecord => {
  try {
    if (typeof Taro.getWindowInfo === 'function') {
      return (Taro.getWindowInfo() as unknown as GenericRecord) ?? {}
    }
  } catch {
    // ignore read errors
  }
  return {}
}

const getLegacySystemInfoFromTaro = (): GenericRecord => {
  try {
    if (typeof Taro.getSystemInfoSync === 'function') {
      return (Taro.getSystemInfoSync() as unknown as GenericRecord) ?? {}
    }
  } catch {
    // ignore read errors
  }
  return {}
}

const getThemeFromAppBaseInfo = (): string | undefined => {
  try {
    if (typeof Taro.getAppBaseInfo === 'function') {
      const appBaseInfo = Taro.getAppBaseInfo() as unknown as GenericRecord
      return toTheme(appBaseInfo.theme)
    }
  } catch {
    // ignore read errors
  }
  return undefined
}

const readFromTaroFallback = (): RuntimeDeviceInfo => {
  const windowInfo = getWindowInfoFromTaro()
  const legacySystemInfo = getLegacySystemInfoFromTaro()
  const statusBarHeight = toFinitePositiveNumber(windowInfo.statusBarHeight)
    || toFinitePositiveNumber(legacySystemInfo.statusBarHeight)
  const safeAreaTop = getSafeAreaTop(windowInfo) || getSafeAreaTop(legacySystemInfo)
  const windowBottomSafeArea = getBottomSafeArea(windowInfo)
  const bottomSafeArea = windowBottomSafeArea.available
    ? windowBottomSafeArea
    : getBottomSafeArea(legacySystemInfo)
  const theme = getThemeFromAppBaseInfo()
    || toTheme(windowInfo.theme)
    || toTheme(legacySystemInfo.theme)

  return {
    statusBarHeight,
    safeAreaTop,
    bottomSafeArea: bottomSafeArea.value,
    bottomSafeAreaAvailable: bottomSafeArea.available,
    theme
  }
}

const readThemeFromH5 = (): string | undefined => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return undefined
  }
}

export const getRuntimeDeviceInfo = (): RuntimeDeviceInfo => {
  return readFromTaroFallback()
}

export const getRuntimeTheme = (): string | undefined => {
  const runtimeInfo = getRuntimeDeviceInfo()
  if (runtimeInfo.theme) {
    return runtimeInfo.theme
  }

  if (process.env.TARO_ENV === 'h5') {
    return readThemeFromH5()
  }

  return undefined
}
