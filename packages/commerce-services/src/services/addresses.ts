import {
  deleteAddressesAddressId,
  getAddresses,
  patchAddressesAddressId,
  postAddresses,
  type CreateUserAddressRequest,
  type ListAddressesResponse,
  type UpdateUserAddressRequest,
  type UserAddress
} from '@tmo/api-client'

export interface AddressesService {
  list: () => Promise<ListAddressesResponse>
  create: (payload: CreateUserAddressRequest) => Promise<UserAddress>
  update: (addressId: string, payload: UpdateUserAddressRequest) => Promise<UserAddress>
  remove: (addressId: string) => Promise<void>
}

export const createAddressesService = (): AddressesService => {
  return {
    list: async () => (await getAddresses()).data,
    create: async (payload) => (await postAddresses(payload)).data,
    update: async (addressId, payload) => {
      const response = await patchAddressesAddressId(addressId, payload)
      if (response.status !== 200) {
        throw new Error(response.data.message || 'failed to update address')
      }
      return response.data
    },
    remove: async (addressId) => {
      await deleteAddressesAddressId(addressId)
    }
  }
}
