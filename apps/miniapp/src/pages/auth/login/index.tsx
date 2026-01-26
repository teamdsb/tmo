import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Button from '@taroify/core/button'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import { RoleSelectionRequiredError } from '@tmo/identity-services'

import { identityServices } from '../../../services/identity'
import { gatewayServices } from '../../../services/gateway'
import { saveBootstrap, savePendingRoleSelection } from '../../../services/bootstrap'
import { ROUTES } from '../../../routes'
import { navigateTo, switchTabLike } from '../../../utils/navigation'

import './index.scss'

type LaunchContext = {
  scene?: string
  bindingToken?: string
}

const readLaunchContext = (): LaunchContext => {
  const options = Taro.getLaunchOptionsSync?.()
  const query = (options?.query ?? {}) as Record<string, unknown>
  const sceneFromOptions = options?.scene !== undefined && options?.scene !== null
    ? String(options.scene)
    : undefined
  const sceneFromQuery = typeof query.scene === 'string' && query.scene.trim()
    ? query.scene.trim()
    : undefined
  const bindingToken = typeof query.bindingToken === 'string'
    ? query.bindingToken
    : typeof query.binding_token === 'string'
      ? query.binding_token
      : undefined
  return {
    scene: sceneFromOptions ?? sceneFromQuery,
    bindingToken
  }
}

export default function LoginPage() {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const launchContext = useMemo(readLaunchContext, [])

  const handleLogin = async () => {
    if (!agreed) {
      await Taro.showToast({
        title: 'Please agree to terms.',
        icon: 'none'
      })
      return
    }
    if (loading) return
    setLoading(true)
    try {
      await identityServices.auth.miniLogin({
        scene: launchContext.scene,
        bindingToken: launchContext.bindingToken
      })
      const bootstrap = await gatewayServices.bootstrap.get()
      await saveBootstrap(bootstrap)
      await savePendingRoleSelection(null)
      await switchTabLike(ROUTES.home)
    } catch (error) {
      if (error instanceof RoleSelectionRequiredError) {
        await savePendingRoleSelection({
          roles: error.availableRoles,
          scene: launchContext.scene,
          bindingToken: launchContext.bindingToken
        })
        await navigateTo(ROUTES.authRoleSelect)
        return
      }
      console.warn('identity login failed', error)
      await Taro.showToast({
        title: 'Login failed, try again.',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAltLogin = async () => {
    await Taro.showToast({
      title: 'Please contact support to update your login method.',
      icon: 'none'
    })
  }

  return (
    <View className='page login-page px-6 pt-16 pb-12 flex flex-col min-h-screen'>
      <View className='flex-1 flex flex-col justify-center'>
        <View className='flex flex-col items-center text-center gap-3'>
          <View className='login-logo shadow-md'>
            <AppsOutlined className='text-white text-2xl' />
          </View>
          <View>
            <Text className='text-xl font-semibold text-slate-900'>Wholesale Partner</Text>
            <Text className='block text-xs text-slate-500 mt-2'>Log in to access exclusive pricing.</Text>
          </View>
        </View>

        <View className='mt-10 flex flex-col gap-4'>
          <Button
            color='primary'
            block
            loading={loading}
            onClick={handleLogin}
            className='login-primary'
          >
            Quick Login
          </Button>
          <Button
            variant='outlined'
            block
            onClick={handleAltLogin}
            className='login-secondary'
          >
            Use another phone number
          </Button>
        </View>

        <View className='mt-5 flex items-start gap-3' onClick={() => setAgreed((prev) => !prev)}>
          <View className={`login-checkbox ${agreed ? 'login-checkbox--checked' : ''}`} />
          <Text className='text-[10px] text-slate-500 leading-snug'>
            I have read and agree to the Privacy Policy and Terms of Service.
          </Text>
        </View>
      </View>

      <View className='mt-auto text-center text-[10px] text-slate-400'>Need help? Reach out to your account manager.</View>
    </View>
  )
}
