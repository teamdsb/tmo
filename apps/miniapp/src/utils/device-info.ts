import Taro from '@tarojs/taro'

type GenericRecord = Record<string, unknown>

export type RuntimeDeviceInfo = {
  statusBarHeight: number
  safeAreaTop: number
  theme?: string
}

const toFinitePositiveNumber = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
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

const readFromWeappApis = (): RuntimeDeviceInfo => {
  const weapp = (globalThis as { wx?: GenericRecord }).wx as
    | {
        getWindowInfo?: () => GenericRecord
        getAppBaseInfo?: () => GenericRecord
      }
    | undefined

  if (!weapp) {
    return { statusBarHeight: 0, safeAreaTop: 0 }
  }

  const windowInfo = (() => {
    try {
      return weapp.getWindowInfo?.() ?? {}
    } catch {
      return {}
    }
  })()

  const appBaseInfo = (() => {
    try {
      return weapp.getAppBaseInfo?.() ?? {}
    } catch {
      return {}
    }
  })()

  return {
    statusBarHeight: toFinitePositiveNumber(windowInfo.statusBarHeight),
    safeAreaTop: getSafeAreaTop(windowInfo),
    theme: toTheme(appBaseInfo.theme) ?? toTheme(windowInfo.theme)
  }
}

const readFromAlipayApi = (): RuntimeDeviceInfo => {
  const alipay = (globalThis as { my?: GenericRecord }).my as
    | {
        getSystemInfoSync?: () => GenericRecord
      }
    | undefined

  if (!alipay || typeof alipay.getSystemInfoSync !== 'function') {
    return { statusBarHeight: 0, safeAreaTop: 0 }
  }

  const systemInfo = (() => {
    try {
      return alipay.getSystemInfoSync?.() ?? {}
    } catch {
      return {}
    }
  })()

  return {
    statusBarHeight: toFinitePositiveNumber(systemInfo.statusBarHeight),
    safeAreaTop: getSafeAreaTop(systemInfo),
    theme: toTheme(systemInfo.theme)
  }
}

const readFromTaroFallback = (): RuntimeDeviceInfo => {
  const windowInfo = getWindowInfoFromTaro()

  return {
    statusBarHeight: toFinitePositiveNumber(windowInfo.statusBarHeight),
    safeAreaTop: getSafeAreaTop(windowInfo),
    theme: getThemeFromAppBaseInfo() ?? toTheme(windowInfo.theme)
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
  const taroEnv = process.env.TARO_ENV

  if (taroEnv === 'weapp') {
    return readFromWeappApis()
  }

  if (taroEnv === 'alipay') {
    return readFromAlipayApi()
  }

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
