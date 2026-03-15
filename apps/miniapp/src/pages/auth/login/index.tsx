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
const realAlipayConfigCheckMessage = '当前真实支付宝登录配置不完整，请补齐 identity 的支付宝密钥配置后重试'
const realAlipayCapabilityCheckMessage = '无法确认后端真实支付宝登录配置，请检查 gateway / identity 是否在线'

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
  const isMockMode = runtimeEnv.isIsolatedMock
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
    && !isMockMode
    && !enableWeappPhoneProofSimulation
  const shouldCheckRealAlipayCapabilities = platform === 'alipay'
    && !isMockMode

  useEffect(() => {
    if (!shouldCheckRealWeappCapabilities && !shouldCheckRealAlipayCapabilities) {
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
          setCapabilitiesError(
            shouldCheckRealAlipayCapabilities ? realAlipayCapabilityCheckMessage : realWeappCapabilityCheckMessage
          )
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
  }, [shouldCheckRealAlipayCapabilities, shouldCheckRealWeappCapabilities])

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
  const blockedAlipayLoginMessage = useMemo(() => {
    if (!shouldCheckRealAlipayCapabilities) {
      return ''
    }
    const alipayCapabilities = miniLoginCapabilities?.alipay
    if (capabilitiesError) {
      return capabilitiesError
    }
    if (capabilitiesLoading) {
      return '正在校验真实支付宝登录配置...'
    }
    if (!miniLoginCapabilities || !alipayCapabilities) {
      return realAlipayCapabilityCheckMessage
    }
    if (String(miniLoginCapabilities.loginMode).trim().toLowerCase() !== 'real') {
      return 'identity 当前未开启真实登录模式，请先设置 IDENTITY_LOGIN_MODE=real。'
    }
    if (alipayCapabilities.phoneProofSimulationEnabled) {
      return 'identity 当前仍开启手机号证明模拟，请先关闭 IDENTITY_ENABLE_PHONE_PROOF_SIMULATION。'
    }
    if (!alipayCapabilities.realPhoneLoginReady) {
      const missing = Array.isArray(alipayCapabilities.missing)
        ? alipayCapabilities.missing.filter(Boolean).join(' / ')
        : ''
      return missing
        ? `identity 缺少真实支付宝配置：${missing}`
        : realAlipayConfigCheckMessage
    }
    return ''
  }, [
    capabilitiesError,
    capabilitiesLoading,
    miniLoginCapabilities,
    shouldCheckRealAlipayCapabilities
  ])
  const isWeappLoginBlocked = blockedWeappLoginMessage.length > 0
  const isAlipayLoginBlocked = blockedAlipayLoginMessage.length > 0
  const panelTitle = isMockMode ? 'Mock 快速登录' : '手机号登录'
  const panelDescription = isMockMode
    ? '当前处于演示模式。所有业务逻辑已预设，可直接体验不同角色的操作流程。'
    : platform === 'weapp'
      ? '使用微信授权手机号完成身份识别。'
      : platform === 'alipay'
        ? '使用支付宝授权手机号完成身份识别。'
        : '当前环境将按调试登录逻辑执行。'
  const statusMessage = isMockMode
    ? '模拟数据已激活'
    : platform === 'weapp'
      ? enableWeappPhoneProofSimulation
        ? '开发调试已启用模拟手机号校验'
        : '微信手机号授权'
      : platform === 'alipay'
        ? '支付宝手机号授权'
        : '调试登录'

  const handleLoginSuccess = async (
    role?: 'CUSTOMER' | 'SALES',
    resolvePhoneProof?: () => Promise<PhoneProofResult | undefined>
  ) => {
    const phoneProof = resolvePhoneProof ? await resolvePhoneProof() : undefined
    await identityServices.auth.miniLogin({
      role,
      scene: launchContext.scene,
      bindingToken: launchContext.bindingToken,
      phoneProof,
      codeOverride: platform === 'weapp' && enableWeappPhoneProofSimulation ? 'mock_customer_001' : undefined
    })
    const bootstrap = await gatewayServices.bootstrap.get()
    await saveBootstrap(bootstrap)
    await savePendingRoleSelection(null)
    await switchTabLike(redirect || ROUTES.home)
  }

  const handleLoginFlow = async (
    resolvePhoneProof?: () => Promise<PhoneProofResult | undefined>,
    options: { role?: 'CUSTOMER' | 'SALES' } = {}
  ) => {
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
    if (platform === 'alipay' && isAlipayLoginBlocked) {
      await Taro.showToast({
        title: blockedAlipayLoginMessage,
        icon: 'none'
      })
      return
    }
    if (loading) return

    setLoading(true)
    try {
      await handleLoginSuccess(options.role, resolvePhoneProof)
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
      if (isPhoneAuthorizationError(error)) {
        await Taro.showToast({
          title: '请先授权手机号',
          icon: 'none'
        })
        return
      }
      if (isPhoneProofApiError(error)) {
        await Taro.showToast({
          title: resolvePhoneProofErrorMessage(error, platform),
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

  const handleMockRoleLogin = async (role: 'CUSTOMER' | 'SALES') => {
    await handleLoginFlow(async () => undefined, { role })
  }

  return (
    <View className='page login-page'>
      <View className='login-shell'>
        <View className='login-backdrop login-backdrop--top' />
        <View className='login-backdrop login-backdrop--bottom' />

        <View className='login-header'>
          <View className='login-header-spacer' />
          <Text className='login-header-title'>登录</Text>
          <View className='login-header-spacer' />
        </View>

        <View className='login-content'>
          <View className='login-card login-card--hero'>
            <View className='login-hero-glow' />
            <View className='login-logo-frame'>
              <View className='login-logo'>
                <AppsOutlined className='login-logo-icon' />
              </View>
            </View>
            <View className='login-copy'>
              <Text className='login-eyebrow'>Enterprise Sourcing</Text>
              <Text className='login-title'>批发合作伙伴</Text>
              <Text className='login-subtitle'>验证身份以访问您的专属价格、账户信息及订单实时进度</Text>
            </View>
          </View>

          <View className='login-card login-card--info'>
            <View className='login-panel-head login-panel-head--compact'>
              <View className='login-panel-badge' />
              <Text className='login-panel-title'>{panelTitle}</Text>
            </View>
            <View className='login-panel-note'>
              <View className='login-panel-note-dot' />
              <Text className='login-panel-caption'>{panelDescription}</Text>
            </View>
            <View className='login-status-toggle'>
              <Text className='login-status-label'>{statusMessage}</Text>
              <View className='login-status-switch'>
                <View className='login-status-switch-thumb' />
              </View>
            </View>
          </View>

          <View className='login-card login-card--actions'>
            {isWeappLoginBlocked || isAlipayLoginBlocked ? (
              <View className='login-alert'>
                <Text className='login-alert-text'>
                  {platform === 'alipay' ? blockedAlipayLoginMessage : blockedWeappLoginMessage}
                </Text>
              </View>
            ) : null}

            <View className='login-actions'>
              {isMockMode ? (
                <>
                  <Button
                    color='primary'
                    block
                    disabled={loading}
                    onClick={() => handleMockRoleLogin('CUSTOMER')}
                    className='login-primary'
                  >
                    客户登录
                    <Text className='login-primary-arrow'>→</Text>
                  </Button>
                  <Button
                    variant='outlined'
                    block
                    disabled={loading}
                    onClick={() => handleMockRoleLogin('SALES')}
                    className='login-secondary'
                  >
                    业务员登录
                  </Button>
                </>
              ) : null}

              {!isMockMode && platform === 'weapp' && enableWeappPhoneProofSimulation ? (
                <NativeButton
                  className='login-primary login-native-button'
                  disabled={!agreed || loading}
                  loading={loading}
                  onClick={handleWeappSimulatedLogin}
                >
                  快速登录
                </NativeButton>
              ) : null}

              {!isMockMode && platform === 'weapp' && !enableWeappPhoneProofSimulation ? (
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

              {!isMockMode && platform === 'alipay' ? (
                <NativeButton
                  className='login-primary login-native-button'
                  disabled={!agreed || loading || isAlipayLoginBlocked}
                  loading={loading}
                  openType='getAuthorize'
                  scope='phoneNumber'
                  onGetAuthorize={handleAlipayGetAuthorize}
                  onError={handleAlipayAuthorizeError}
                >
                  快速登录
                </NativeButton>
              ) : null}

              {!isMockMode && platform === 'unknown' ? (
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
                variant='text'
                block
                onClick={handleAltLogin}
                className='login-ghost'
              >
                {isMockMode ? '暂不登录，先去逛逛' : '暂不登录'}
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
              </Text>
            </View>
          </View>

          <View className='login-footer'>
            <View className='login-footer-divider'>
              <View className='login-footer-line' />
              <Text className='login-footer-label'>寻求支持</Text>
              <View className='login-footer-line' />
            </View>
            <View className='login-footer-support'>
              <View className='login-footer-support-dot' />
              <Text className='login-footer-text'>联系您的客户经理</Text>
            </View>
            <View className='login-footer-handle' />
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

const resolvePhoneProofErrorMessage = (error: unknown, platform: MiniPlatform): string => {
  if (!isApiError(error)) {
    return '手机号校验失败，请重试。'
  }
  if (error.code === 'phone_required') {
    return '请先授权手机号'
  }
  if (error.code === 'invalid_phone') {
    return '手机号格式无效，请重新授权。'
  }
  if (platform === 'alipay' && error.code === 'invalid_phone_proof') {
    return '支付宝手机号授权已返回，但后端未完成校验。请检查 IDENTITY_ALIPAY_APP_ID / PRIVATE_KEY / PUBLIC_KEY / AES_KEY。'
  }
  if (platform === 'weapp' && error.code === 'invalid_phone_proof') {
    return '微信手机号证明校验失败，请检查后端微信登录配置。'
  }
  return '手机号校验失败，请重试。'
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
