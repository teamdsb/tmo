import { useMemo, useState } from 'react'
import { Button as NativeButton, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Button from '@taroify/core/button'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import { getPhoneNumber as platformGetPhoneNumber, getPlatform, type PhoneProofResult } from '@tmo/platform-adapter'
import { RoleSelectionRequiredError, isApiError } from '@tmo/identity-services'

import { identityServices } from '../../../services/identity'
import { gatewayServices } from '../../../services/gateway'
import { saveBootstrap, savePendingRoleSelection } from '../../../services/bootstrap'
import { applyMockLogin } from '../../../services/mock-auth'
import { ROUTES } from '../../../routes'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { runtimeEnv } from '../../../config/runtime-env'

import './index.scss'

type LaunchContext = {
  scene?: string
  bindingToken?: string
}

type RecordValue = Record<string, unknown>
type MiniPlatform = 'weapp' | 'alipay' | 'unknown'

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

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

const asRecord = (value: unknown): RecordValue | null => {
  if (typeof value === 'object' && value !== null) {
    return value as RecordValue
  }
  return null
}

const createPhoneAuthError = (code: string, message: string): Error => {
  const error = new Error(message)
  return Object.assign(error, { code })
}

const extractWeappPhoneProof = (event: unknown): PhoneProofResult => {
  const eventRecord = asRecord(event)
  const detail = asRecord(eventRecord?.detail)
  const errMsg = pickString(detail?.errMsg)
  if (errMsg && errMsg.toLowerCase().includes('deny')) {
    throw createPhoneAuthError('PHONE_AUTH_DENIED', errMsg)
  }

  const code = pickString(detail?.code)
  const phone = pickString(detail?.phoneNumber)
  if (!code && !phone) {
    throw createPhoneAuthError('WEAPP_PHONE_PROOF_MISSING', 'WeChat phone proof missing')
  }

  return {
    code,
    phone,
    raw: event
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const launchContext = useMemo(readLaunchContext, [])
  const enableMockLogin = useMemo(() => runtimeEnv.enableMockLogin, [])
  const platform = useMemo(() => getPlatform() as MiniPlatform, [])
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

  const handleLoginFlow = async (resolvePhoneProof?: () => Promise<PhoneProofResult | undefined>) => {
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
      const phoneProof = resolvePhoneProof ? await resolvePhoneProof() : undefined
      await identityServices.auth.miniLogin({
        scene: launchContext.scene,
        bindingToken: launchContext.bindingToken,
        phoneProof
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

  const handleWeappGetPhoneNumber = async (event: unknown) => {
    await handleLoginFlow(async () => extractWeappPhoneProof(event))
  }

  const handleAlipayGetAuthorize = async () => {
    await handleLoginFlow(async () => platformGetPhoneNumber())
  }

  const handleAlipayAuthorizeError = async (event: unknown) => {
    const detail = asRecord(asRecord(event)?.detail) ?? asRecord(event)
    const errMsg = pickString(detail?.errorMessage) ?? pickString(detail?.errMsg)
    await Taro.showToast({
      title: errMsg && errMsg.trim() ? '请先授权手机号' : '手机号授权失败',
      icon: 'none'
    })
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
          {platform === 'weapp' ? (
            <NativeButton
              className='login-primary login-native-button'
              disabled={!agreed || loading}
              loading={loading}
              openType='getPhoneNumber'
              onGetPhoneNumber={handleWeappGetPhoneNumber}
            >
              快速登录
            </NativeButton>
          ) : null}

          {platform === 'alipay' ? (
            <NativeButton
              className='login-primary login-native-button'
              disabled={!agreed || loading}
              loading={loading}
              openType='getAuthorize'
              scope='phoneNumber'
              onGetAuthorize={handleAlipayGetAuthorize}
              onError={handleAlipayAuthorizeError}
            >
              快速登录
            </NativeButton>
          ) : null}

          {platform === 'unknown' ? (
            <Button
              color='primary'
              block
              loading={loading}
              onClick={() => handleLoginFlow()}
              className='login-primary'
            >
              快速登录
            </Button>
          ) : null}

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
