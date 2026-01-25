import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Button, Cell } from '@taroify/core'
import Taro from '@tarojs/taro'

import { identityServices, RoleSelectionRequiredError, type MiniLoginInput } from '@tmo/identity-services'

import { gatewayServices } from '../../../services/gateway'
import {
  loadPendingRoleSelection,
  saveBootstrap,
  savePendingRoleSelection
} from '../../../services/bootstrap'
import { ROUTES } from '../../../routes'
import { switchTabLike } from '../../../utils/navigation'

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SALES: 'Sales',
  PROCUREMENT: 'Procurement',
  CS: 'Customer Service'
}

export default function RoleSelectPage() {
  const [roles, setRoles] = useState<string[]>([])
  const [pendingContext, setPendingContext] = useState<{ scene?: string; bindingToken?: string } | null>(null)
  const [loadingRole, setLoadingRole] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const pending = await loadPendingRoleSelection()
      if (!pending) {
        setRoles([])
        return
      }
      setRoles(pending.roles)
      setPendingContext({ scene: pending.scene, bindingToken: pending.bindingToken })
    })()
  }, [])

  const entries = useMemo(() => {
    if (roles.length === 0) {
      return []
    }
    return roles.map((role) => ({
      code: role,
      label: ROLE_LABELS[role] ?? role
    }))
  }, [roles])

  const handleSelect = async (role: string) => {
    if (loadingRole) return
    setLoadingRole(role)
    try {
      await identityServices.auth.miniLogin({
        role: role as MiniLoginInput['role'],
        scene: pendingContext?.scene,
        bindingToken: pendingContext?.bindingToken
      })
      const bootstrap = await gatewayServices.bootstrap.get()
      await saveBootstrap(bootstrap)
      await savePendingRoleSelection(null)
      await switchTabLike(ROUTES.home)
    } catch (error) {
      if (error instanceof RoleSelectionRequiredError) {
        await savePendingRoleSelection({
          roles: error.availableRoles,
          scene: pendingContext?.scene,
          bindingToken: pendingContext?.bindingToken
        })
        setRoles(error.availableRoles)
      }
      console.warn('role selection failed', error)
      await Taro.showToast({
        title: 'Login failed, try again.',
        icon: 'none'
      })
    } finally {
      setLoadingRole(null)
    }
  }

  if (entries.length === 0) {
    return (
      <View className='page'>
        <View className='page-content'>
          <Text className='section-title'>Role selection required</Text>
          <Text className='section-subtitle'>No available roles found. Please relaunch the app.</Text>
          <View className='placeholder-actions'>
            <Button color='primary' onClick={() => switchTabLike(ROUTES.home)}>
              Back to Home
            </Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='page'>
      <View className='page-content'>
        <Text className='section-title'>Choose your role</Text>
        <Text className='section-subtitle'>Select the role you want to enter now.</Text>
      </View>
      <Cell.Group inset>
        {entries.map((entry) => (
          <Cell key={entry.code} clickable>
            <View className='flex flex-col gap-2'>
              <Text className='text-sm font-semibold'>{entry.label}</Text>
              <Button
                size='small'
                color='primary'
                loading={loadingRole === entry.code}
                onClick={() => handleSelect(entry.code)}
              >
                Continue
              </Button>
            </View>
          </Cell>
        ))}
      </Cell.Group>
    </View>
  )
}
