import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Switch from '@taroify/core/switch'
import { ROUTES } from '../../routes'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'

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

  useEffect(() => {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    if (stored && typeof stored === 'object') {
      setSettings({ ...DEFAULT_SETTINGS, ...stored })
    }
  }, [])

  useEffect(() => {
    Taro.setStorageSync(STORAGE_KEY, settings)
  }, [settings])

  const handleToggle = (key: keyof SettingsState) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
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
