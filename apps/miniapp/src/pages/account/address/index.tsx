import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Plus from '@taroify/icons/Plus'
import LocationOutlined from '@taroify/icons/LocationOutlined'
import { getNavbarStyle } from '../../../utils/navbar'
import './index.scss'

export default function AddressList() {
  const navbarStyle = getNavbarStyle()
  const [addresses, setAddresses] = useState<AddressRecord[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<AddressRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const didHydrateRef = useRef(false)

  useEffect(() => {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (Array.isArray(stored)) {
      setAddresses(stored)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!didHydrateRef.current) {
      didHydrateRef.current = true
      return
    }
    Taro.setStorageSync(STORAGE_KEY, addresses)
  }, [addresses, isLoading])

  const sortedAddresses = useMemo(() => {
    const list = [...addresses]
    return list.sort((a, b) => {
      if (a.isDefault) return -1
      if (b.isDefault) return 1
      return a.name.localeCompare(b.name)
    })
  }, [addresses])

  const handleSaveAddress = (formData: AddressFormData) => {
    setAddresses((prev) => {
      const next = prev.map((addr) => ({
        ...addr,
        isDefault: formData.isDefault ? false : addr.isDefault
      }))

      if (editingAddress) {
        return next.map((addr) =>
          addr.id === editingAddress.id ? { ...addr, ...formData } : addr
        )
      }

      const newAddress: AddressRecord = {
        id: createId(),
        ...formData,
        isDefault: prev.length === 0 ? true : formData.isDefault
      }
      return [newAddress, ...next]
    })
    setIsFormOpen(false)
    setEditingAddress(null)
  }

  const handleDelete = async (id: string) => {
    const result = await Taro.showModal({
      title: 'Delete address',
      content: 'Are you sure you want to delete this address?'
    })
    if (!result.confirm) return
    setAddresses((prev) => prev.filter((addr) => addr.id !== id))
  }

  const openEdit = (addr: AddressRecord) => {
    setEditingAddress(addr)
    setIsFormOpen(true)
  }

  const openAdd = () => {
    setEditingAddress(null)
    setIsFormOpen(true)
  }

  return (
    <View className='min-h-screen bg-slate-50 text-slate-900 font-sans page address-page'>
      <Navbar
        bordered
        fixed
        placeholder
        safeArea='top'
        style={navbarStyle}
        className='address-navbar app-navbar'
      >
        <Navbar.NavLeft onClick={() => Taro.navigateBack()} />
        <Navbar.Title>Shipping Address</Navbar.Title>
      </Navbar>

      <View className='mt-4 px-4 pb-32 address-list'>
        {isLoading ? (
          <View className='flex justify-center py-20'>
            <View className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' />
          </View>
        ) : sortedAddresses.length === 0 ? (
          <View className='text-center py-20 opacity-60 address-empty'>
            <View className='bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto address-empty-icon'>
              <LocationOutlined className='text-2xl text-slate-500' />
            </View>
            <Text className='text-sm text-slate-500'>No addresses saved yet.</Text>
          </View>
        ) : (
          sortedAddresses.map((addr) => (
            <View
              key={addr.id}
              className='bg-white rounded-2xl border border-slate-100 p-5 shadow-sm transition-all address-card'
            >
              <View className='flex justify-between items-start mb-2'>
                <View className='flex flex-wrap items-center gap-2'>
                  <Text className='text-base font-semibold text-slate-900'>{addr.name}</Text>
                  <Text className='text-sm text-slate-500'>{addr.phone}</Text>
                  {addr.isDefault ? (
                    <Text className='px-2 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100 uppercase tracking-wide address-default-badge'>
                      Default
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text className='text-sm text-slate-600 leading-relaxed'>{addr.address}</Text>

              <View className='mt-4 pt-4 border-t border-slate-50 flex justify-end gap-5'>
                <View
                  className='flex items-center gap-2 text-xs text-slate-400 transition-colors address-action address-action-edit'
                  onClick={() => openEdit(addr)}
                >
                  <Text>Edit</Text>
                </View>
                <View
                  className='flex items-center gap-2 text-xs text-slate-400 transition-colors address-action address-action-delete'
                  onClick={() => void handleDelete(addr.id)}
                >
                  <Text>Delete</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {!isFormOpen ? (
        <View className='fixed bottom-8 left-0 right-0 px-4 pb-4 z-30'>
          <View
            className='w-full h-14 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 address-fab address-pressable'
            onClick={openAdd}
          >
            <Plus className='text-lg' />
            <Text>Add New Address</Text>
          </View>
        </View>
      ) : null}

      {isFormOpen ? (
        <View className='fixed inset-0 z-50 bg-black bg-opacity-40 flex items-end justify-center px-4 address-overlay'>
          <View className='bg-white w-full max-w-md rounded-t-3xl p-6 shadow-2xl address-sheet'>
            <View className='flex justify-between items-center mb-6 address-sheet-header'>
              <Text className='text-lg font-bold address-sheet-title'>
                {editingAddress ? 'Edit Address' : 'New Address'}
              </Text>
              <View
                className='p-2 rounded-full transition-colors address-close'
                onClick={() => setIsFormOpen(false)}
              >
                <Text className='text-base'>X</Text>
              </View>
            </View>

            <AddressForm
              initialData={editingAddress}
              onSubmit={handleSaveAddress}
              onCancel={() => setIsFormOpen(false)}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

type AddressRecord = {
  id: string
  name: string
  phone: string
  address: string
  isDefault: boolean
}

type AddressFormData = Omit<AddressRecord, 'id'>

const STORAGE_KEY = 'tmo.addresses'

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

type AddressFormProps = {
  initialData: AddressRecord | null
  onSubmit: (data: AddressFormData) => void
  onCancel: () => void
}

function AddressForm({ initialData, onSubmit, onCancel }: AddressFormProps) {
  const [formData, setFormData] = useState<AddressFormData>({
    name: initialData?.name ?? '',
    phone: initialData?.phone ?? '',
    address: initialData?.address ?? '',
    isDefault: initialData?.isDefault ?? false
  })

  useEffect(() => {
    setFormData({
      name: initialData?.name ?? '',
      phone: initialData?.phone ?? '',
      address: initialData?.address ?? '',
      isDefault: initialData?.isDefault ?? false
    })
  }, [initialData])

  const handleSubmit = () => {
    if (!formData.name || !formData.phone || !formData.address) {
      void Taro.showToast({ title: 'Please complete all fields', icon: 'none' })
      return
    }
    onSubmit(formData)
  }

  return (
    <View className='address-form'>
      <View className='address-field'>
        <Text className='text-xs font-medium text-slate-500 ml-1'>Contact Name</Text>
        <Input
          className='w-full h-12 px-4 rounded-xl bg-slate-50 border-none transition-all'
          placeholder='e.g. John Doe'
          value={formData.name}
          onInput={(event) => setFormData({ ...formData, name: event.detail.value })}
        />
      </View>

      <View className='address-field'>
        <Text className='text-xs font-medium text-slate-500 ml-1'>Phone Number</Text>
        <Input
          className='w-full h-12 px-4 rounded-xl bg-slate-50 border-none transition-all'
          placeholder='e.g. 138-1234-5678'
          value={formData.phone}
          onInput={(event) => setFormData({ ...formData, phone: event.detail.value })}
        />
      </View>

      <View className='address-field'>
        <Text className='text-xs font-medium text-slate-500 ml-1'>Full Address</Text>
        <Textarea
          className='w-full px-4 py-3 rounded-xl bg-slate-50 border-none transition-all address-textarea'
          placeholder='Enter complete shipping address...'
          value={formData.address}
          onInput={(event) => setFormData({ ...formData, address: event.detail.value })}
        />
      </View>

      <View className='flex items-center justify-between p-1'>
        <Text className='text-sm font-medium'>Set as default address</Text>
        <View
          className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${
            formData.isDefault ? 'bg-blue-600' : 'bg-slate-200'
          }`}
          onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
        >
          <View
            className={`w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
              formData.isDefault ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </View>
      </View>

      <View className='flex gap-3 pt-4 address-actions'>
        <View
          className='flex-1 h-12 rounded-xl font-medium border border-slate-100 transition-colors flex items-center justify-center address-cancel'
          onClick={onCancel}
        >
          <Text>Cancel</Text>
        </View>
        <View
          className='flex-1 h-12 rounded-xl bg-blue-600 text-white font-semibold transition-all shadow-md flex items-center justify-center address-pressable address-save'
          onClick={handleSubmit}
        >
          <Text>Save</Text>
        </View>
      </View>
    </View>
  )
}
