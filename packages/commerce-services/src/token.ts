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

export const createTokenStore = (key: string, devToken?: string): TokenStore => {
  return {
    getToken: async () => {
      try {
        const result = await getStorage<string>(key)
        if (result.data) {
          return result.data
        }
      } catch {
        // ignore and fall back
      }

      const local = getLocalStorage(key)
      if (local) {
        return local
      }

      return devToken ?? null
    },
    setToken: async (token: string | null) => {
      try {
        if (token === null) {
          await removeStorage(key)
        } else {
          await setStorage(key, token)
        }
      } catch {
        // ignore and fall back
      }
      setLocalStorage(key, token)
    }
  }
}
