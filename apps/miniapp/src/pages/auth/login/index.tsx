import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Button from '@taroify/core/button'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import { RoleSelectionRequiredError } from '@tmo/identity-services'

import { identityServices } from '../../../services/identity'
import { gatewayServices } from '../../../services/gateway'
import { saveBootstrap, savePendingRoleSelection } from '../../../services/bootstrap'
import { applyMockLogin } from '../../../services/mock-auth'
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
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const launchContext = useMemo(readLaunchContext, [])
  const redirect = (() => {
    if (typeof router.params?.redirect !== 'string') {
      return ''
    }
    try {
      return decodeURIComponent(router.params.redirect)
    } catch {
      return router.params.redirect
    }
  })()

  const handleLogin = async () => {
    if (!agreed) {
      await Taro.showToast({
        title: '请先同意条款。',
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
      await switchTabLike(redirect || ROUTES.home)
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
      if (isTouristModeUnsupportedError(error)) {
        await Taro.showToast({
          title: '请先配置 TARO_APP_ID',
          icon: 'none'
        })
        return
      }
      console.warn('identity login failed', error)
      await Taro.showToast({
        title: '登录失败，请重试。',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAltLogin = async () => {
    await identityServices.tokens.setToken(null)
    if (redirect) {
      await switchTabLike(redirect)
      return
    }
    try {
      await Taro.navigateBack()
    } catch {
      await switchTabLike(ROUTES.home)
    }
  }

  const handleMockLogin = async () => {
    await applyMockLogin()
    await switchTabLike(redirect || ROUTES.home)
  }

  return (
    <View className='page login-page'>
      <View className='login-bg login-bg--top' />
      <View className='login-bg login-bg--mid' />

      <View className='login-content px-6 pt-14 pb-10 flex flex-col min-h-screen'>
        <View className='login-main flex-1 flex flex-col justify-center'>
          <View className='login-hero'>
            <View className='login-logo-shell'>
              <View className='login-logo'>
                <AppsOutlined className='text-white text-2xl' />
              </View>
            </View>
            <View className='login-copy'>
              <Text className='login-title'>批发合作伙伴</Text>
              <Text className='login-subtitle'>登录后可查看专属价格。</Text>
            </View>
          </View>

          <View className='login-actions mt-10'>
            <Button
              color='primary'
              block
              loading={loading}
              onClick={handleLogin}
              className='login-primary'
            >
              快速登录
            </Button>
            <Button
              variant='outlined'
              block
              onClick={handleMockLogin}
              className='login-secondary'
            >
              测试登录
            </Button>
            <Button
              variant='outlined'
              block
              onClick={handleAltLogin}
              className='login-ghost'
            >
              暂不登录
            </Button>
          </View>

          <View className='login-agreement' onClick={() => setAgreed((prev) => !prev)}>
            <View className={`login-checkbox ${agreed ? 'login-checkbox--checked' : ''}`} />
            <Text className='login-agreement-text'>
              我已阅读并同意
              <Text className='login-agreement-link'>隐私政策</Text>
              与
              <Text className='login-agreement-link'>服务条款</Text>
              。
            </Text>
          </View>
        </View>

        <View className='login-footer'>需要帮助？请联系你的客户经理。</View>
      </View>
    </View>
  )
}

const isTouristModeUnsupportedError = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'WEAPP_TOURIST_MODE_UNSUPPORTED'
}
