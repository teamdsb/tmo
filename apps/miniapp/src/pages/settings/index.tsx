import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Cell from '@taroify/core/cell'
import Switch from '@taroify/core/switch'
import ArrowLeft from '@taroify/icons/ArrowLeft'
import AppTabbar from '../../components/app-tabbar'
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
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))}>
          <ArrowLeft className='text-xl' />
        </Navbar.NavLeft>
      </Navbar>
      <View className='page-content'>
        <View className='mb-4'>
          <Text className='section-title'>System Settings</Text>
          <Text className='section-subtitle'>Control notifications and display preferences.</Text>
        </View>

        <Cell.Group inset>
          <Cell
            title='Order notifications'
            brief='Get status updates and shipping alerts'
            rightIcon={
              <Switch
                size='24px'
                checked={settings.notifications}
                onChange={() => handleToggle('notifications')}
              />
            }
          />
          <Cell
            title='Auto login'
            brief='Keep me signed in on this device'
            rightIcon={
              <Switch
                size='24px'
                checked={settings.autoLogin}
                onChange={() => handleToggle('autoLogin')}
              />
            }
          />
          <Cell
            title='Compact display'
            brief='Reduce spacing to view more data'
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
          <Text className='text-xs uppercase tracking-wide text-slate-400'>About</Text>
          <Text className='text-sm text-slate-600 mt-2'>
            TMO Procurement Miniapp v0.1
          </Text>
          <Text className='text-xs text-slate-400 mt-1'>
            Designed for efficient B2B sourcing workflows.
          </Text>
        </View>
      </View>
      <AppTabbar value='mine' />
    </View>
  )
}
