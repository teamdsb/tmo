import { useEffect, useMemo, useState } from 'react'
import { Button as NativeButton, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Button from '@taroify/core/button'
import AppsOutlined from '@taroify/icons/AppsOutlined'
import { getPhoneNumber as platformGetPhoneNumber, getPlatform, type PhoneProofResult } from '@tmo/platform-adapter'
import { RoleSelectionRequiredError, isApiError } from '@tmo/identity-services'

import { identityServices } from '../../../services/identity'
import { fetchMiniLoginCapabilities, type MiniLoginCapabilities } from '../../../services/auth-capabilities'
import { gatewayServices } from '../../../services/gateway'
import { saveBootstrap, savePendingRoleSelection } from '../../../services/bootstrap'
import { ROUTES } from '../../../routes'
import { clearAuthSession } from '../../../utils/auth'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { runtimeEnv } from '../../../config/runtime-env'

import './index.scss'

type LaunchContext = {
  scene?: string
  bindingToken?: string
}

type RecordValue = Record<string, unknown>
type MiniPlatform = 'weapp' | 'alipay' | 'unknown'

const simulatedWeappPhoneProof: PhoneProofResult = Object.freeze({
  code: 'simulated_weapp_phone_proof'
})
const weappSimulationMismatchMessage = '开发环境模拟登录配置不一致，请开启 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION 后重试'
const weappSimulationIdentityBoundMessage = '本地模拟账号与 seed 绑定冲突，请重启 identity 容器或更新后端后重试'
const realWeappConfigCheckMessage = '当前真实微信登录配置不完整，请补齐前后端 AppID/AppSecret 配置后重试'
const realWeappCapabilityCheckMessage = '无法确认后端真实微信登录配置，请检查 gateway / identity 是否在线'

const readLaunchContext = (): LaunchContext => {
  const options = Taro.getLaunchOptionsSync?.()
  const query = (options?.query ?? {}) as Record<string, unknown>
  const sceneFromQuery = typeof query.scene === 'string' && query.scene.trim()
    ? query.scene.trim()
    : undefined
  const bindingToken = typeof query.bindingToken === 'string'
    ? query.bindingToken
    : typeof query.binding_token === 'string'
      ? query.binding_token
      : undefined
  return {
    scene: sceneFromQuery,
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
  const [miniLoginCapabilities, setMiniLoginCapabilities] = useState<MiniLoginCapabilities | null>(null)
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(false)
  const [capabilitiesError, setCapabilitiesError] = useState('')
  const launchContext = useMemo(readLaunchContext, [])
  const enableWeappPhoneProofSimulation = useMemo(() => runtimeEnv.weappPhoneProofSimulation, [])
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
  const hasRealWeappAppId = useMemo(() => hasConfiguredWeappAppId(runtimeEnv.weappAppId), [])
  const shouldCheckRealWeappCapabilities = platform === 'weapp'
    && !runtimeEnv.isIsolatedMock
    && !enableWeappPhoneProofSimulation

  useEffect(() => {
    if (!shouldCheckRealWeappCapabilities) {
      setMiniLoginCapabilities(null)
      setCapabilitiesError('')
      setCapabilitiesLoading(false)
      return
    }

    let cancelled = false
    setCapabilitiesLoading(true)
    setCapabilitiesError('')

    void (async () => {
      try {
        const next = await fetchMiniLoginCapabilities()
        if (!cancelled) {
          setMiniLoginCapabilities(next)
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('load mini login capabilities failed', error)
          setCapabilitiesError(realWeappCapabilityCheckMessage)
        }
      } finally {
        if (!cancelled) {
          setCapabilitiesLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shouldCheckRealWeappCapabilities])

  const blockedWeappLoginMessage = useMemo(() => {
    if (!shouldCheckRealWeappCapabilities) {
      return ''
    }
    if (!hasRealWeappAppId) {
      return '当前未配置真实微信 AppID，请先设置 TARO_APP_ID。'
    }
    if (capabilitiesError) {
      return capabilitiesError
    }
    if (capabilitiesLoading) {
      return '正在校验真实微信登录配置...'
    }
    if (!miniLoginCapabilities) {
      return realWeappCapabilityCheckMessage
    }
    if (String(miniLoginCapabilities.loginMode).trim().toLowerCase() !== 'real') {
      return 'identity 当前未开启真实登录模式，请先设置 IDENTITY_LOGIN_MODE=real。'
    }
    if (miniLoginCapabilities.weapp.phoneProofSimulationEnabled) {
      return 'identity 当前仍开启手机号证明模拟，请先关闭 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION。'
    }
    if (!miniLoginCapabilities.weapp.realPhoneLoginReady) {
      const missing = Array.isArray(miniLoginCapabilities.weapp.missing)
        ? miniLoginCapabilities.weapp.missing.filter(Boolean).join(' / ')
        : ''
      return missing
        ? `identity 缺少真实微信配置：${missing}`
        : realWeappConfigCheckMessage
    }
    return ''
  }, [
    capabilitiesError,
    capabilitiesLoading,
    hasRealWeappAppId,
    miniLoginCapabilities,
    shouldCheckRealWeappCapabilities
  ])
  const isWeappLoginBlocked = blockedWeappLoginMessage.length > 0

  const handleLoginFlow = async (resolvePhoneProof?: () => Promise<PhoneProofResult | undefined>) => {
    if (!agreed) {
      await Taro.showToast({
        title: '请先同意条款。',
        icon: 'none'
      })
      return
    }
    if (platform === 'weapp' && isWeappLoginBlocked) {
      await Taro.showToast({
        title: blockedWeappLoginMessage,
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
        phoneProof,
        codeOverride: platform === 'weapp' && enableWeappPhoneProofSimulation ? 'mock_customer_001' : undefined
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
      if (isWeappSimulationConfigError(error, enableWeappPhoneProofSimulation)) {
        await Taro.showToast({
          title: weappSimulationMismatchMessage,
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
      if (isWeappSimulationIdentityConflict(error, enableWeappPhoneProofSimulation)) {
        await Taro.showToast({
          title: weappSimulationIdentityBoundMessage,
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

  const handleWeappSimulatedLogin = async () => {
    await handleLoginFlow(async () => simulatedWeappPhoneProof)
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
    await clearAuthSession()
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

  return (
    <View className='page login-page'>
      <View className='login-shell'>
        <View className='login-backdrop login-backdrop--top' />
        <View className='login-backdrop login-backdrop--bottom' />

        <View className='login-content'>
          <View className='login-hero'>
            <View className='login-logo-frame'>
              <View className='login-logo'>
                <AppsOutlined className='login-logo-icon' />
              </View>
            </View>
            <View className='login-copy'>
              <Text className='login-eyebrow'>企业采购小程序</Text>
              <Text className='login-title'>批发合作伙伴</Text>
              <Text className='login-subtitle'>登录后可查看账号信息、专属价格与履约进度。</Text>
            </View>
          </View>

          <View className='login-panel'>
            <View className='login-panel-head'>
              <Text className='login-panel-title'>手机号登录</Text>
              <Text className='login-panel-caption'>使用微信授权手机号完成身份识别</Text>
            </View>

            <View className='login-status-strip'>
              <View className='login-status-dot' />
              <Text className='login-status-copy'>
                {platform === 'weapp'
                  ? '微信环境将直接调起手机号授权。'
                  : platform === 'alipay'
                    ? '支付宝环境将使用平台手机号授权。'
                    : '当前环境将按调试登录逻辑执行。'}
              </Text>
            </View>

            {isWeappLoginBlocked ? (
              <View className='login-alert'>
                <Text className='login-alert-text'>
                  {blockedWeappLoginMessage}
                </Text>
              </View>
            ) : null}

            <View className='login-actions'>
              {platform === 'weapp' && enableWeappPhoneProofSimulation ? (
                <NativeButton
                  className='login-primary login-native-button'
                  disabled={!agreed || loading}
                  loading={loading}
                  onClick={handleWeappSimulatedLogin}
                >
                  快速登录
                </NativeButton>
              ) : null}

              {platform === 'weapp' && !enableWeappPhoneProofSimulation ? (
                <NativeButton
                  className='login-primary login-native-button'
                  disabled={!agreed || loading || isWeappLoginBlocked}
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

              <Button
                variant='outlined'
                block
                onClick={handleAltLogin}
                className='login-secondary'
              >
                暂不登录
              </Button>
            </View>

            <View
              className='login-agreement'
              onClick={() => setAgreed((prev) => !prev)}
            >
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

          <View className='login-footer'>
            <Text className='login-footer-text'>需要帮助？请联系你的客户经理。</Text>
          </View>
        </View>
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

const isWeappSimulationConfigError = (
  error: unknown,
  enableWeappPhoneProofSimulation: boolean
): boolean => {
  if (!enableWeappPhoneProofSimulation || !isApiError(error)) {
    return false
  }
  if (error.code === 'phone_required') {
    return true
  }
  return error.code === 'invalid_request'
    && error.message.trim().toLowerCase() === 'invalid login code'
}

const isWeappSimulationIdentityConflict = (
  error: unknown,
  enableWeappPhoneProofSimulation: boolean
): boolean => {
  return enableWeappPhoneProofSimulation &&
    isApiError(error) &&
    error.code === 'conflict' &&
    error.message.trim().toLowerCase() === 'identity already bound'
}

const hasConfiguredWeappAppId = (value?: string | null): boolean => {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return false
  }
  return trimmed.toLowerCase() !== 'touristappid'
}
