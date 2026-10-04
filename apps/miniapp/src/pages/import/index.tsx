import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import { ROUTES, importConfirmRoute } from '../../routes'
import { commerceServices } from '../../services/commerce'
import { getNavbarStyle } from '../../utils/navbar'
import { navigateTo, switchTabLike } from '../../utils/navigation'

export default function ImportIndex() {
  const navbarStyle = getNavbarStyle()
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const uploadInFlight = useRef(false)
  const uploadMayNavigate = useRef(false)
  const chooseInFlight = useRef(false)
  const uploadedJobId = useRef<string | null>(null)
  const requestVersion = useRef(0)
  const mounted = useRef(true)
  const visible = useRef(true)
  const pendingChoice = useRef<{ version: number; file: { path: string; name?: string } } | null>(null)

  const isCurrent = (version: number) => mounted.current && visible.current && version === requestVersion.current
  const invalidateRequests = useCallback(() => {
    requestVersion.current += 1
    uploadInFlight.current = false
    uploadMayNavigate.current = false
    chooseInFlight.current = false
    pendingChoice.current = null
    if (mounted.current) setUploading(false)
    return requestVersion.current
  }, [])

  useEffect(() => {
    mounted.current = true
    visible.current = true
    return () => {
      mounted.current = false
      visible.current = false
      invalidateRequests()
    }
  }, [invalidateRequests])
  const applyChoice = (version: number, file: { path: string; name?: string }) => {
    if (!isCurrent(version)) return
    uploadedJobId.current = null
    setFilePath(file.path)
    setFileName(file.name ?? '已选.xlsx')
    chooseInFlight.current = false
    pendingChoice.current = null
  }
  useDidShow(() => {
    visible.current = true
    const choice = pendingChoice.current
    if (choice) applyChoice(choice.version, choice.file)
  })
  useDidHide(() => {
    visible.current = false
    if (uploadInFlight.current) {
      // Backgrounding must not unlock or duplicate a server-side import. Keep its
      // result for an explicit retry, but never resume automatic navigation.
      uploadMayNavigate.current = false
      return
    }
    // The native file picker can hide this page while a valid selection is pending.
    // Explicit back navigation and unmount still invalidate that selection.
    if (!chooseInFlight.current) invalidateRequests()
  })

  const handleBack = async () => {
    const version = invalidateRequests()
    try {
      await Taro.navigateBack()
    } catch {
      if (isCurrent(version)) await switchTabLike(ROUTES.cart)
    }
  }

  const handleChoose = async () => {
    if (!visible.current || uploadInFlight.current || chooseInFlight.current) return
    const version = ++requestVersion.current
    chooseInFlight.current = true
    try {
      const file = await commerceServices.files.chooseExcelFile()
      if (!mounted.current || version !== requestVersion.current) return
      if (!visible.current) {
        pendingChoice.current = { version, file }
        return
      }
      applyChoice(version, file)
    } catch (error) {
      if (!isCurrent(version)) return
      console.warn('choose file failed', error)
      await Taro.showToast({ title: '未选择文件', icon: 'none' })
    } finally {
      if (mounted.current && version === requestVersion.current && !pendingChoice.current) chooseInFlight.current = false
    }
  }

  const handleUpload = async () => {
    if (!visible.current || uploadInFlight.current || chooseInFlight.current) return
    const version = ++requestVersion.current
    if (!filePath) {
      await Taro.showToast({ title: '请先选择文件', icon: 'none' })
      return
    }
    uploadInFlight.current = true
    uploadMayNavigate.current = true
    setUploading(true)
    try {
      if (!uploadedJobId.current) {
        const job = await commerceServices.cart.uploadImportExcel(filePath)
        if (!mounted.current || version !== requestVersion.current) return
        uploadedJobId.current = job.id
      }
      if (isCurrent(version) && uploadMayNavigate.current) await navigateTo(importConfirmRoute(uploadedJobId.current))
    } catch (error) {
      if (!isCurrent(version) || !uploadMayNavigate.current) return
      console.warn('upload failed', error)
      await Taro.showToast({ title: uploadedJobId.current ? '上传已完成，打开结果失败，请重试' : '上传失败', icon: 'none' })
    } finally {
      if (mounted.current && version === requestVersion.current) {
        uploadInFlight.current = false
        setUploading(false)
      }
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder style={navbarStyle} className='app-navbar app-navbar--secondary'>
        <Navbar.NavLeft onClick={() => void handleBack()} />
        <Navbar.Title>批量导入</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>上传 Excel 文件以批量加入购物车。</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='已选文件' brief={fileName ?? '未选择文件'} />
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block variant='outlined' disabled={uploading} onClick={handleChoose}>选择 Excel 文件</Button>
          <Button block color='primary' disabled={uploading} loading={uploading} onClick={handleUpload}>上传并查看</Button>
        </View>
      </View>
    </View>
  )
}
