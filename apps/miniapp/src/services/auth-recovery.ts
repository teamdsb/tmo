import { removeStorage } from '@tmo/platform-adapter'

import { ROUTES } from '../routes'
import { getCurrentPath, switchTabLike } from '../utils/navigation'
import { clearBootstrap, savePendingRoleSelection } from './bootstrap'

const AUTH_STORAGE_KEYS = ['tmo:auth:token', 'tmo:commerce:token'] as const

let recoveryInFlight: Promise<void> | null = null

const clearLocalAuthStorage = () => {
  if (typeof localStorage === 'undefined') {
    return
  }
  AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // Platform storage is authoritative; localStorage is only an H5 fallback.
    }
  })
}

export const recoverUnauthorizedSession = (): Promise<void> => {
  if (recoveryInFlight) {
    return recoveryInFlight
  }

  const recovery = (async () => {
    await Promise.allSettled([
      ...AUTH_STORAGE_KEYS.map((key) => removeStorage(key)),
      clearBootstrap(),
      savePendingRoleSelection(null)
    ])
    clearLocalAuthStorage()
    if (getCurrentPath() !== ROUTES.authLogin) {
      await switchTabLike(ROUTES.authLogin)
    }
  })()
  recoveryInFlight = recovery
  return recovery.finally(() => {
    if (recoveryInFlight === recovery) {
      recoveryInFlight = null
    }
  })
}
