import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import { ROUTES, withQuery } from '../../routes'
import { commerceServices } from '../../services/commerce'
import { getNavbarStyle } from '../../utils/navbar'
import { switchTabLike } from '../../utils/navigation'

export default function ImportIndex() {
  const navbarStyle = getNavbarStyle()
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleChoose = async () => {
    try {
      const file = await commerceServices.files.chooseExcelFile()
      setFilePath(file.path)
      setFileName(file.name ?? 'selected.xlsx')
    } catch (error) {
      console.warn('choose file failed', error)
      await Taro.showToast({ title: 'No file selected', icon: 'none' })
    }
  }

  const handleUpload = async () => {
    if (!filePath) {
      await Taro.showToast({ title: 'Select a file first', icon: 'none' })
      return
    }
    setUploading(true)
    try {
      const job = await commerceServices.cart.uploadImportExcel(filePath)
      await Taro.showToast({ title: 'Upload started', icon: 'success' })
      await switchTabLike(withQuery(ROUTES.cart, { jobId: job.id }))
    } catch (error) {
      console.warn('upload failed', error)
      await Taro.showToast({ title: 'Upload failed', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.cart))} />
        <Navbar.Title>Bulk Import</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>Upload an Excel file to add items to cart in bulk.</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='Selected File' brief={fileName ?? 'No file selected'} />
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block variant='outlined' onClick={handleChoose}>Choose Excel File</Button>
          <Button block color='primary' loading={uploading} onClick={handleUpload}>Upload and Review</Button>
        </View>
      </View>
    </View>
  )
}
