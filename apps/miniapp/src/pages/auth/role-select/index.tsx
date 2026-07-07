import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Button from '@taroify/core/button'
import Navbar from '@taroify/core/navbar'
import Taro from '@tarojs/taro'

import { RoleSelectionRequiredError, type MiniLoginInput } from '@tmo/identity-services'

import { gatewayServices } from '../../../services/gateway'
import { identityServices } from '../../../services/identity'
import {
  loadPendingRoleSelection,
  saveBootstrap,
  savePendingRoleSelection
} from '../../../services/bootstrap'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { switchTabLike } from '../../../utils/navigation'

import './index.scss'

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: '客户',
  SALES: '业务员'
}

export default function RoleSelectPage() {
  const navbarStyle = getNavbarStyle()
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
        title: '登录失败，请重试。',
        icon: 'none'
      })
    } finally {
      setLoadingRole(null)
    }
  }

  if (entries.length === 0) {
    return (
      <View className='page role-select-page'>
        <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
          <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.authLogin))} />
          <Navbar.Title>选择角色</Navbar.Title>
        </Navbar>
        <View className='role-select-main'>
          <View className='role-select-card role-select-card--empty'>
            <Text className='role-select-title'>需要选择角色</Text>
            <Text className='role-select-subtitle'>未发现可用角色，请重新打开应用。</Text>
            <Button color='primary' onClick={() => switchTabLike(ROUTES.home)}>
              返回首页
            </Button>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='page role-select-page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.authLogin))} />
        <Navbar.Title>选择角色</Navbar.Title>
      </Navbar>
      <View className='role-select-main'>
        <View className='role-select-card'>
          <Text className='role-select-title'>选择登录身份</Text>
          <Text className='role-select-subtitle'>请选择本次进入应用使用的身份</Text>
          <View className='role-select-options'>
            {entries.map((entry) => (
              <View className='role-select-option' key={entry.code}>
                <Text className='role-select-option-label'>{entry.label}</Text>
                <Button
                  block
                  color='primary'
                  loading={loadingRole === entry.code}
                  onClick={() => handleSelect(entry.code)}
                >
                  以{entry.label}身份进入
                </Button>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}
