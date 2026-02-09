import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Button from '@taroify/core/button'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import { RoleSelectionRequiredError, isApiError } from '@tmo/identity-services'

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

declare const process: { env?: Record<string, string | undefined> } | undefined

const isMockLoginEnabled = (): boolean => {
  if (typeof process === 'undefined' || !process?.env) {
    return false
  }
  const raw = process.env.TARO_APP_ENABLE_MOCK_LOGIN
  const value = raw ? raw.trim().toLowerCase() : ''
  return value === 'true' || value === '1' || value === 'on' || value === 'yes'
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
  const enableMockLogin = useMemo(isMockLoginEnabled, [])
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
      if (isPhoneAuthorizationError(error) || isPhoneProofApiError(error)) {
        await Taro.showToast({
          title: '请先授权手机号',
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
    <View className='page login-page px-6 pt-16 pb-12 flex flex-col min-h-screen'>
      <View className='flex-1 flex flex-col justify-center'>
        <View className='flex flex-col items-center text-center gap-3'>
          <View className='login-logo shadow-md'>
            <AppsOutlined className='text-white text-2xl' />
          </View>
          <View>
            <Text className='text-xl font-semibold text-slate-900'>批发合作伙伴</Text>
            <Text className='block text-xs text-slate-500 mt-2'>登录后可查看专属价格。</Text>
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
            快速登录
          </Button>
          {enableMockLogin ? (
            <Button
              variant='outlined'
              block
              onClick={handleMockLogin}
              className='login-secondary'
            >
              测试登录
            </Button>
          ) : null}
          <Button
            variant='outlined'
            block
            onClick={handleAltLogin}
            className='login-secondary'
          >
            暂不登录
          </Button>
        </View>

        <View className='mt-5 flex items-start gap-3' onClick={() => setAgreed((prev) => !prev)}>
          <View className={`login-checkbox ${agreed ? 'login-checkbox--checked' : ''}`} />
          <Text className='text-10 text-slate-500 leading-snug'>
            我已阅读并同意隐私政策与服务条款。
          </Text>
        </View>
      </View>

      <View className='mt-auto text-center text-10 text-slate-400'>需要帮助？请联系你的客户经理。</View>
    </View>
  )
}

const isTouristModeUnsupportedError = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'WEAPP_TOURIST_MODE_UNSUPPORTED'
}

const isPhoneAuthorizationError = (error: unknown): boolean => {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && [
      'PHONE_AUTH_DENIED',
      'WEAPP_GET_PHONE_UNSUPPORTED',
      'WEAPP_PHONE_PROOF_MISSING'
    ].includes((error as { code?: string }).code ?? '')
}

const isPhoneProofApiError = (error: unknown): boolean => {
  return isApiError(error)
    && ['phone_required', 'invalid_phone_proof', 'invalid_phone'].includes(error.code ?? '')
}
