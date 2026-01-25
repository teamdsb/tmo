import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'
import type { BootstrapResponse } from '@tmo/gateway-api-client'

const bootstrapStorageKey = 'tmo:bootstrap'
const roleSelectionStorageKey = 'tmo:auth:role-selection'

export interface PendingRoleSelection {
  roles: string[]
  scene?: string
  bindingToken?: string
}

export const saveBootstrap = async (value: BootstrapResponse): Promise<void> => {
  await setStorage(bootstrapStorageKey, value)
}

export const loadBootstrap = async (): Promise<BootstrapResponse | null> => {
  try {
    const result = await getStorage<BootstrapResponse>(bootstrapStorageKey)
    return result.data ?? null
  } catch {
    return null
  }
}

export const clearBootstrap = async (): Promise<void> => {
  try {
    await removeStorage(bootstrapStorageKey)
  } catch {
    // ignore storage errors
  }
}

export const savePendingRoleSelection = async (value: PendingRoleSelection | null): Promise<void> => {
  try {
    if (value === null) {
      await removeStorage(roleSelectionStorageKey)
      return
    }
    await setStorage(roleSelectionStorageKey, value)
  } catch {
    // ignore storage errors
  }
}

export const loadPendingRoleSelection = async (): Promise<PendingRoleSelection | null> => {
  try {
    const result = await getStorage<PendingRoleSelection>(roleSelectionStorageKey)
    return result.data ?? null
  } catch {
    return null
  }
}
