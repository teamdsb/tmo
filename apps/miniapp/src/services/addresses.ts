import Taro from '@tarojs/taro'
import type { CreateUserAddressRequest, UserAddress } from '@tmo/api-client'
import { commerceServices } from './commerce'

const LEGACY_ADDRESS_STORAGE_KEY = 'tmo.addresses'

type LegacyAddressRecord = {
  name: string
  phone: string
  address: string
  isDefault: boolean
}

let legacyMigrationAttempted = false

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const toLegacyAddressRecord = (value: unknown): LegacyAddressRecord | null => {
  if (!isRecord(value)) {
    return null
  }

  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const phone = typeof value.phone === 'string' ? value.phone.trim() : ''
  const address = typeof value.address === 'string' ? value.address.trim() : ''
  if (!name || !phone || !address) {
    return null
  }

  return {
    name,
    phone,
    address,
    isDefault: value.isDefault === true
  }
}

const normalizeLegacyAddressPayloads = (raw: unknown): CreateUserAddressRequest[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const records = raw
    .map(toLegacyAddressRecord)
    .filter((item): item is LegacyAddressRecord => item !== null)

  if (records.length === 0) {
    return []
  }

  const defaultIndex = records.findIndex((item) => item.isDefault)
  return records.map((item, index) => ({
    receiverName: item.name,
    receiverPhone: item.phone,
    detail: item.address,
    isDefault: defaultIndex >= 0 ? index === defaultIndex : index === 0
  }))
}

const migrateLegacyAddressesIfNeeded = async (): Promise<void> => {
  if (legacyMigrationAttempted) {
    return
  }
  legacyMigrationAttempted = true

  const listResponse = await commerceServices.addresses.list()
  if ((listResponse.items?.length ?? 0) > 0) {
    return
  }

  const legacy = Taro.getStorageSync(LEGACY_ADDRESS_STORAGE_KEY)
  const payloads = normalizeLegacyAddressPayloads(legacy)
  if (payloads.length === 0) {
    return
  }

  for (const payload of payloads) {
    await commerceServices.addresses.create(payload)
  }

  Taro.removeStorageSync(LEGACY_ADDRESS_STORAGE_KEY)
}

export const listUserAddresses = async (): Promise<UserAddress[]> => {
  await migrateLegacyAddressesIfNeeded()
  const response = await commerceServices.addresses.list()
  return response.items ?? []
}
