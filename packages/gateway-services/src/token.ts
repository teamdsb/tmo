import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'

export interface TokenStore {
  getToken: () => Promise<string | null>
  setToken: (token: string | null) => Promise<void>
}

const hasLocalStorage = (): boolean => {
  return typeof localStorage !== 'undefined'
}

const getLocalStorage = (key: string): string | null => {
  if (!hasLocalStorage()) {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const setLocalStorage = (key: string, value: string | null): void => {
  if (!hasLocalStorage()) {
    return
  }
  try {
    if (value === null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, value)
  } catch {
    // ignore storage errors
  }
}

export const createTokenStore = (key: string, devToken?: string, fallbackKey?: string): TokenStore => {
  return {
    getToken: async () => {
      const readFromKey = async (storageKey: string): Promise<string | null> => {
        try {
          const result = await getStorage<string>(storageKey)
          if (result.data) {
            return result.data
          }
        } catch {
          // ignore and fall back
        }
        return getLocalStorage(storageKey)
      }

      const primary = await readFromKey(key)
      if (primary) {
        return primary
      }

      if (fallbackKey && fallbackKey !== key) {
        const fallback = await readFromKey(fallbackKey)
        if (fallback) {
          return fallback
        }
      }

      return devToken ?? null
    },
    setToken: async (token: string | null) => {
      try {
        if (token === null) {
          await removeStorage(key)
          if (fallbackKey && fallbackKey !== key) {
            await removeStorage(fallbackKey)
          }
        } else {
          await setStorage(key, token)
        }
      } catch {
        // ignore and fall back
      }
      setLocalStorage(key, token)
      if (token === null && fallbackKey && fallbackKey !== key) {
        setLocalStorage(fallbackKey, null)
      }
    }
  }
}
