import { useEffect, useState } from 'react'
import { View, Text, Button as NativeButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Switch from '@taroify/core/switch'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'
import { clearBootstrap, saveBootstrap } from '../../services/bootstrap'
import { gatewayServices } from '../../services/gateway'
import { resetIsolatedMockState, getIsolatedMockRoles, setIsolatedMockRoles } from '../../services/mock/runtime'
import { runtimeEnv } from '../../config/runtime-env'

type SettingsState = {
  notifications: boolean
  autoLogin: boolean
  compactMode: boolean
}

const STORAGE_KEY = 'tmo.settings'
const DEFAULT_SETTINGS: SettingsState = {
  notifications: true,
  autoLogin: true,
  compactMode: false
}

export default function SettingsPage() {
  const navbarStyle = getNavbarStyle()
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS)
  const [resettingMock, setResettingMock] = useState(false)
  const [mockSalesEnabled, setMockSalesEnabled] = useState(false)
  const [updatingMockRole, setUpdatingMockRole] = useState(false)

  useEffect(() => {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (stored && typeof stored === 'object') {
      setSettings({ ...DEFAULT_SETTINGS, ...stored })
    }
  }, [])

  useEffect(() => {
    if (!runtimeEnv.isIsolatedMock) {
      return
    }
    void (async () => {
      const roles = await getIsolatedMockRoles()
      setMockSalesEnabled(roles.includes('SALES'))
    })()
  }, [])

  useEffect(() => {
    Taro.setStorageSync(STORAGE_KEY, settings)
  }, [settings])

  const handleToggle = (key: keyof SettingsState) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
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

  const handleToggleSalesRole = async () => {
    if (!runtimeEnv.isIsolatedMock || updatingMockRole) {
      return
    }
    setUpdatingMockRole(true)
    const nextEnabled = !mockSalesEnabled
    try {
      const currentRoles = await getIsolatedMockRoles()
      const nextRoles = currentRoles.filter((role) => role !== 'SALES')
      if (nextEnabled) {
        nextRoles.push('SALES')
      }
      await setIsolatedMockRoles(nextRoles)
      setMockSalesEnabled(nextEnabled)

      const token = await gatewayServices.tokens.getToken()
      if (token) {
        const bootstrap = await gatewayServices.bootstrap.get()
        await saveBootstrap(bootstrap)
      }
      await Taro.showToast({
        title: nextEnabled ? '已启用业务员身份' : '已关闭业务员身份',
        icon: 'none'
      })
    } catch (error) {
      console.warn('toggle mock sales role failed', error)
      await Taro.showToast({
        title: '切换失败，请重试',
        icon: 'none'
      })
    } finally {
      setUpdatingMockRole(false)
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
          <Text className='section-subtitle'>控制通知与显示偏好。</Text>
        </View>

        <Cell.Group inset>
          <Cell
            title='业务员页面（临时）'
            brief='暂时开放入口，点击进入业务员页面'
            onClick={() => navigateTo(ROUTES.sales)}
          />
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
          <Cell
            title='紧凑显示'
            brief='减少间距查看更多内容'
            rightIcon={
              <Switch
                size='24px'
                checked={settings.compactMode}
                onChange={() => handleToggle('compactMode')}
              />
            }
          />
        </Cell.Group>

        {runtimeEnv.isIsolatedMock ? (
          <View className='mt-6 bg-white rounded-2xl border border-slate-100 p-4'>
            <Text className='text-xs uppercase tracking-wide text-slate-400'>Mock</Text>
            <Text className='text-sm text-slate-600 mt-2'>
              当前为离线 Mock 模式，可重置本地购物车、收藏与订单等数据。
            </Text>
            <Cell
              className='mt-3'
              title='模拟业务员身份'
              brief='开启后会在我的页展示业务员入口'
              rightIcon={
                <Switch
                  size='24px'
                  checked={mockSalesEnabled}
                  onChange={handleToggleSalesRole}
                />
              }
            />
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
          <Text className='text-xs uppercase tracking-wide text-slate-400'>关于</Text>
          <Text className='text-sm text-slate-600 mt-2'>
            TMO 采购小程序 v0.1
          </Text>
          <Text className='text-xs text-slate-400 mt-1'>
            为高效的 B2B 寻源流程而设计。
          </Text>
        </View>
      </View>
    </View>
  )
}
