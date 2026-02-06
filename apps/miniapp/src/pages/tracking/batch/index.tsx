import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { switchTabLike } from '../../../utils/navigation'
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
      setFileName(file.name ?? '已选.xlsx')
    } catch (error) {
      console.warn('choose shipment file failed', error)
      await Taro.showToast({ title: '未选择文件', icon: 'none' })
    }
  }

  const handleUpload = async () => {
    if (!filePath) {
      await Taro.showToast({ title: '请先选择文件', icon: 'none' })
      return
    }
    setUploading(true)
    try {
      await commerceServices.tracking.uploadShipmentImportExcel(filePath)
      await Taro.showToast({ title: '已开始上传', icon: 'success' })
    } catch (error) {
      console.warn('upload shipment failed', error)
      await Taro.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>批量物流跟踪</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>上传发货 Excel 以批量更新物流。</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='已选文件' brief={fileName ?? '未选择文件'} />
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block variant='outlined' onClick={handleChoose}>选择 Excel 文件</Button>
          <Button block color='primary' loading={uploading} onClick={handleUpload}>上传发货单</Button>
        </View>
      </View>
    </View>
  )
}
