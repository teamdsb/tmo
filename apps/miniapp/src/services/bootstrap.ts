import { getStorage, removeStorage, setStorage } from '@tmo/platform-adapter'
import type { BootstrapResponse } from '@tmo/gateway-api-client'

const bootstrapStorageKey = 'tmo:bootstrap'

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
