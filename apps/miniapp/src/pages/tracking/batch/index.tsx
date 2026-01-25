import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import AppTabbar from '../../../components/app-tabbar'
import { getNavbarStyle } from '../../../utils/navbar'
import { commerceServices } from '../../../services/commerce'

export default function BatchTracking() {
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
      console.warn('choose shipment file failed', error)
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
      await commerceServices.tracking.uploadShipmentImportExcel(filePath)
      await Taro.showToast({ title: 'Upload started', icon: 'success' })
    } catch (error) {
      console.warn('upload shipment failed', error)
      await Taro.showToast({ title: 'Upload failed', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>Batch Tracking</Text>
        <Text className='section-subtitle'>Upload shipment Excel to update tracking in bulk.</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='Selected File' brief={fileName ?? 'No file selected'} />
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block variant='outlined' onClick={handleChoose}>Choose Excel File</Button>
          <Button block color='primary' loading={uploading} onClick={handleUpload}>Upload Shipments</Button>
        </View>
      </View>
      <AppTabbar value='mine' />
    </View>
  )
}
