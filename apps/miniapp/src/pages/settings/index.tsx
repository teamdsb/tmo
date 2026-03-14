import { useEffect, useMemo, useState } from 'react'
import { View, Text, Button as NativeButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Switch from '@taroify/core/switch'
import type { BootstrapResponse } from '@tmo/gateway-api-client'
import miniappPackage from '../../../package.json'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { clearBootstrap, loadBootstrap } from '../../services/bootstrap'
import { applyMockLogin } from '../../services/mock-auth'
import { resetIsolatedMockState } from '../../services/mock/runtime'
import { runtimeEnv } from '../../config/runtime-env'
import { getCurrentRole, isSalesUser } from '../../utils/authz'

type SettingsState = {
  notifications: boolean
  autoLogin: boolean
}

type PolicySectionKey = 'privacy' | 'terms' | 'data'

const STORAGE_KEY = 'tmo.settings'
const DEFAULT_SETTINGS: SettingsState = {
  notifications: true,
  autoLogin: true
}

const POLICY_CONTENT: Record<PolicySectionKey, { title: string; body: string }> = {
  privacy: {
    title: '隐私政策',
    body: '我们会在登录、下单、收货与售后流程中处理账号信息、角色信息、订单与地址数据，用于完成身份识别、履约协同与客户服务。你可以通过退出登录、清除缓存或联系支持团队处理本地留存信息。'
  },
  terms: {
    title: '服务条款',
    body: '账号需按真实业务身份使用；询价、下单、支付与售后流程应遵守平台规则与企业采购约定。业务员工作台、Mock 调试能力及测试环境仅用于授权账号，不作为正式交易依据。'
  },
  data: {
    title: '数据说明',
    body: '小程序会本地缓存登录态、Bootstrap 信息与部分设置项。Mock 模式使用离线模拟数据，不访问真实后端；Real 模式会读取当前配置的接口环境。重置或清除缓存后，部分页面状态需要重新拉取。'
  }
}

const appVersion = typeof miniappPackage?.version === 'string' && miniappPackage.version.trim()
  ? miniappPackage.version.trim()
  : '0.0.0'

export default function SettingsPage() {
  const navbarStyle = getNavbarStyle()
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)
  const [expandedPolicy, setExpandedPolicy] = useState<PolicySectionKey | null>(null)
  const [showEnvDetails, setShowEnvDetails] = useState(false)
  const [resettingMock, setResettingMock] = useState(false)
  const [mockLoggingIn, setMockLoggingIn] = useState(false)

  useEffect(() => {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (stored && typeof stored === 'object') {
      setSettings({ ...DEFAULT_SETTINGS, ...stored })
    }
  }, [])

  useEffect(() => {
    Taro.setStorageSync(STORAGE_KEY, settings)
  }, [settings])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const cachedBootstrap = await loadBootstrap()
      if (!cancelled) {
        setBootstrap(cachedBootstrap)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const currentRole = useMemo(() => getCurrentRole(bootstrap), [bootstrap])
  const normalizedRoles = useMemo(() => {
    const roles = bootstrap?.me?.roles
    if (!Array.isArray(roles)) {
      return []
    }
    return Array.from(new Set(
      roles
        .filter((role): role is string => typeof role === 'string' && role.trim().length > 0)
        .map((role) => role.trim().toUpperCase())
    ))
  }, [bootstrap])
  const isLoggedIn = Boolean(bootstrap?.me)
  const showSalesWorkbenchEntry = isLoggedIn && isSalesUser(bootstrap)
  const accountDisplayName = bootstrap?.me?.displayName?.trim() || '企业账号'
  const modeLabel = runtimeEnv.isIsolatedMock ? 'Mock' : 'Real'
  const gatewayBaseUrl = runtimeEnv.gatewayBaseUrl || '离线模式'
  const environmentHint = runtimeEnv.isIsolatedMock
    ? '离线 Mock 模式，不访问真实后端'
    : gatewayBaseUrl

  const handleToggle = (key: keyof SettingsState) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleTogglePolicy = (key: PolicySectionKey) => {
    setExpandedPolicy((prev) => (prev === key ? null : key))
  }

  const handleResetMock = async () => {
    if (!runtimeEnv.isIsolatedMock || resettingMock) {
      return
    }
    setResettingMock(true)
    try {
      await resetIsolatedMockState()
      await clearBootstrap()
      await Taro.showToast({
        title: 'Mock 数据已重置',
        icon: 'none'
      })
    } catch (error) {
      console.warn('reset isolated mock data failed', error)
      await Taro.showToast({
        title: '重置失败，请重试',
        icon: 'none'
      })
    } finally {
      setResettingMock(false)
    }
  }

  const handleMockLogin = async () => {
    if (!runtimeEnv.isIsolatedMock || mockLoggingIn) {
      return
    }
    setMockLoggingIn(true)
    try {
      await applyMockLogin()
      await Taro.showToast({
        title: '已切换到测试业务员',
        icon: 'none'
      })
      await switchTabLike(ROUTES.home)
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : '测试登录不可用'
      await Taro.showToast({
        title: message,
        icon: 'none'
      })
    } finally {
      setMockLoggingIn(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>系统设置</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <View className='mb-4'>
          <Text className='section-subtitle'>控制通知、账号信息与排障配置。</Text>
        </View>

        <Cell.Group inset>
          {showSalesWorkbenchEntry ? (
            <Cell
              title='业务员页面'
              brief='进入业务员工作台'
              isLink
              onClick={() => navigateTo(ROUTES.sales)}
            />
          ) : null}
          <Cell
            title='订单通知'
            brief='获取状态更新和发货提醒'
            rightIcon={
              <Switch
                size='24px'
                checked={settings.notifications}
                onChange={() => handleToggle('notifications')}
              />
            }
          />
          <Cell
            title='自动登录'
            brief='保持在本设备登录'
            rightIcon={
              <Switch
                size='24px'
                checked={settings.autoLogin}
                onChange={() => handleToggle('autoLogin')}
              />
            }
          />
        </Cell.Group>

        <View className='mt-6 bg-white rounded-2xl border border-slate-100 p-4'>
          <Text className='text-xs uppercase tracking-wide text-slate-400'>账号与角色信息</Text>
          {isLoggedIn ? (
            <>
              <View className='mt-3'>
                <Text className='text-xs text-slate-400'>当前账号</Text>
                <Text className='text-sm text-slate-700 mt-1'>{accountDisplayName}</Text>
              </View>
              <View className='mt-3'>
                <Text className='text-xs text-slate-400'>当前角色</Text>
                <Text className='text-sm text-slate-700 mt-1'>{currentRole || '未识别'}</Text>
              </View>
              <View className='mt-3'>
                <Text className='text-xs text-slate-400'>可用角色</Text>
                <Text className='text-sm text-slate-700 mt-1'>
                  {normalizedRoles.length > 0 ? normalizedRoles.join(' / ') : '未配置'}
                </Text>
              </View>
            </>
          ) : (
            <View className='mt-3 flex items-center justify-between gap-3'>
              <View className='min-w-0 flex-1'>
                <Text className='text-sm text-slate-700'>当前未登录</Text>
                <Text className='text-xs text-slate-400 mt-1'>登录后可查看账号身份、角色能力和业务员入口。</Text>
              </View>
              <NativeButton
                className='rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700'
                onClick={() => navigateTo(ROUTES.authLogin)}
              >
                去登录
              </NativeButton>
            </View>
          )}
        </View>

        <View className='mt-6 bg-white rounded-2xl border border-slate-100 p-4'>
          <Text className='text-xs uppercase tracking-wide text-slate-400'>隐私与协议</Text>
          <View className='mt-3'>
            {(Object.entries(POLICY_CONTENT) as Array<[PolicySectionKey, { title: string; body: string }]>).map(([key, item]) => (
              <View key={key} className='border-b border-slate-100 last:border-b-0'>
                <Cell
                  title={item.title}
                  isLink
                  onClick={() => handleTogglePolicy(key)}
                />
                {expandedPolicy === key ? (
                  <View className='px-4 pb-4'>
                    <Text className='text-sm text-slate-600 leading-6'>{item.body}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {runtimeEnv.isIsolatedMock ? (
          <View className='mt-6 bg-white rounded-2xl border border-slate-100 p-4'>
            <Text className='text-xs uppercase tracking-wide text-slate-400'>开发调试</Text>
            <Text className='text-sm text-slate-600 mt-2'>
              当前为离线 Mock 模式。这里保留调试专用入口，不影响默认交互评审路径。
            </Text>
            <NativeButton
              className='mt-3 rounded-xl border border-slate-200 py-2 text-sm text-slate-700'
              disabled={mockLoggingIn}
              onClick={handleMockLogin}
            >
              {mockLoggingIn ? '切换中...' : '切换为业务员 Mock 账号'}
            </NativeButton>
            <NativeButton
              className='mt-3 rounded-xl border border-slate-200 py-2 text-sm text-slate-700'
              disabled={resettingMock}
              onClick={handleResetMock}
            >
              {resettingMock ? '重置中...' : '重置 Mock 数据'}
            </NativeButton>
          </View>
        ) : null}

        <View className='mt-6 bg-white rounded-2xl border border-slate-100 p-4'>
          <Text className='text-xs uppercase tracking-wide text-slate-400'>版本与环境信息</Text>
          <View className='mt-3'>
            <Text className='text-xs text-slate-400'>App 版本</Text>
            <Text className='text-sm text-slate-700 mt-1'>v{appVersion}</Text>
          </View>
          <View className='mt-3'>
            <Text className='text-xs text-slate-400'>运行模式</Text>
            <Text className='text-sm text-slate-700 mt-1'>{modeLabel}</Text>
          </View>
          <View className='mt-3'>
            <Text className='text-xs text-slate-400'>接口环境</Text>
            <Text className='text-sm text-slate-700 mt-1'>{environmentHint}</Text>
          </View>
          <NativeButton
            className='mt-3 rounded-xl border border-slate-200 py-2 text-sm text-slate-700'
            onClick={() => setShowEnvDetails((prev) => !prev)}
          >
            {showEnvDetails ? '收起详情' : '查看详情'}
          </NativeButton>
          {showEnvDetails ? (
            <View className='mt-4 rounded-xl bg-slate-50 px-4 py-3'>
              <Text className='text-xs text-slate-400'>Gateway</Text>
              <Text className='text-sm text-slate-700 mt-1'>{runtimeEnv.gatewayBaseUrl || '离线模式'}</Text>
              <Text className='text-xs text-slate-400 mt-3'>Commerce</Text>
              <Text className='text-sm text-slate-700 mt-1'>{runtimeEnv.commerceBaseUrl || '离线模式'}</Text>
              <Text className='text-xs text-slate-400 mt-3'>Identity</Text>
              <Text className='text-sm text-slate-700 mt-1'>{runtimeEnv.identityBaseUrl || '离线模式'}</Text>
              <Text className='text-xs text-slate-400 mt-3'>Fake Payment</Text>
              <Text className='text-sm text-slate-700 mt-1'>{runtimeEnv.devFakePaymentEnabled ? '已开启' : '未开启'}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
