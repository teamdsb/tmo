import { useEffect, useState } from 'react'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import { type BootstrapResponse } from '@tmo/gateway-api-client'
import { loadBootstrap, saveBootstrap } from '../../../services/bootstrap'
import { loadEditableProfile, saveEditableProfile } from '../../../services/profile'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { switchTabLike } from '../../../utils/navigation'
import placeholderProductImage from '../../../assets/images/placeholder-product.svg'

type ProfileFormState = {
  displayName: string
  phone: string
  avatarUrl: string
}

const normalizePhone = (value: string) => value.replace(/\s+/g, '').trim()

const isValidPhone = (value: string) => /^1\d{10}$/.test(value)

const buildNextBootstrap = (bootstrap: BootstrapResponse | null, displayName: string): BootstrapResponse | null => {
  if (!bootstrap?.me) {
    return bootstrap
  }
  return {
    ...bootstrap,
    me: {
      ...bootstrap.me,
      displayName
    }
  }
}

export default function ProfileEditPage() {
  const navbarStyle = getNavbarStyle()
  const [form, setForm] = useState<ProfileFormState>({ displayName: '', phone: '', avatarUrl: '' })
  const [saving, setSaving] = useState(false)
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const cachedBootstrap = await loadBootstrap()
      const cachedProfile = loadEditableProfile()
      if (cancelled) {
        return
      }

      setBootstrap(cachedBootstrap)
      setForm({
        displayName: cachedProfile?.displayName || cachedBootstrap?.me?.displayName?.trim() || '',
        phone: cachedProfile?.phone || '',
        avatarUrl: cachedProfile?.avatarUrl || ''
      })
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleBack = async () => {
    await Taro.navigateBack().catch(() => switchTabLike(ROUTES.settings))
  }

  const handleSave = async () => {
    const displayName = form.displayName.trim()
    const phone = normalizePhone(form.phone)
    const avatarUrl = form.avatarUrl.trim()

    if (!displayName) {
      await Taro.showToast({ title: '请输入名称', icon: 'none' })
      return
    }

    if (!isValidPhone(phone)) {
      await Taro.showToast({ title: '请输入正确手机号', icon: 'none' })
      return
    }

    if (saving) {
      return
    }

    setSaving(true)
    try {
      const nextBootstrap = buildNextBootstrap(bootstrap, displayName)
      if (nextBootstrap) {
        await saveBootstrap(nextBootstrap)
      }
      saveEditableProfile({ displayName, phone, avatarUrl: avatarUrl || undefined })
      await Taro.showToast({ title: '个人信息已保存', icon: 'success' })
      await handleBack()
    } catch (error) {
      console.warn('save profile failed', error)
      await Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleChooseAvatar = async () => {
    if (!bootstrap?.me) {
      await Taro.showToast({ title: '请先登录后再设置头像', icon: 'none' })
      return
    }

    try {
      const result = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      const nextAvatarUrl = Array.isArray(result.tempFilePaths) ? result.tempFilePaths[0] : ''
      if (!nextAvatarUrl) {
        return
      }
      setForm((current) => ({ ...current, avatarUrl: nextAvatarUrl }))
    } catch (error) {
      console.warn('choose avatar failed', error)
      await Taro.showToast({ title: '选择头像失败', icon: 'none' })
    }
  }

  const avatarPreview = form.avatarUrl.trim() || placeholderProductImage
  const canEditAvatar = Boolean(bootstrap?.me)

  return (
    <View className='page min-h-screen bg-slate-100'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => void handleBack()} />
        <Navbar.Title>个人信息</Navbar.Title>
      </Navbar>

      <View className='px-4 pb-10 pt-4'>
        <View className='rounded-3xl bg-white p-5 shadow-sm'>
          <Text className='block text-xs tracking-wide text-slate-400'>基础资料</Text>

          <View className='mt-4 flex items-center gap-4'>
            <View className='h-20 w-20 overflow-hidden rounded-full bg-slate-100'>
              <Image className='h-full w-full' src={avatarPreview} mode='aspectFill' />
            </View>
            <View className='flex-1'>
              <Text className='block text-sm font-medium text-slate-700'>头像</Text>
              <Text className='mt-1 block text-xs leading-5 text-slate-400'>
                {canEditAvatar ? '支持从手机相册或相机选择头像。未设置时保持默认头像。' : '登录后可上传自定义头像。'}
              </Text>
              <Button
                className='mt-3 inline-flex h-9 items-center justify-center rounded-xl border-0 bg-slate-900 px-4 text-xs font-medium text-white disabled:bg-slate-300'
                disabled={!canEditAvatar}
                onClick={() => void handleChooseAvatar()}
              >
                选择头像
              </Button>
            </View>
          </View>

          <View className='mt-4'>
            <Text className='mb-2 block text-sm font-medium text-slate-700'>名称</Text>
            <View className='rounded-2xl bg-slate-50 px-4'>
              <Input
                className='h-12 text-sm text-slate-900'
                maxlength={30}
                value={form.displayName}
                placeholder='请输入名称'
                onInput={(event) => setForm((current) => ({ ...current, displayName: event.detail.value }))}
              />
            </View>
          </View>

          <View className='mt-4'>
            <Text className='mb-2 block text-sm font-medium text-slate-700'>手机号</Text>
            <View className='rounded-2xl bg-slate-50 px-4'>
              <Input
                className='h-12 text-sm text-slate-900'
                type='number'
                maxlength={11}
                value={form.phone}
                placeholder='请输入手机号'
                onInput={(event) => setForm((current) => ({ ...current, phone: event.detail.value }))}
              />
            </View>
          </View>

          <Text className='mt-4 block text-xs leading-5 text-slate-400'>
            当前为本地资料编辑，保存后会立即更新小程序内显示。
          </Text>
        </View>

        <Button
          className='mt-6 flex h-12 w-full items-center justify-center rounded-2xl border-0 bg-blue-600 text-sm font-medium text-white'
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? '保存中...' : '保存'}
        </Button>
      </View>
    </View>
  )
}
