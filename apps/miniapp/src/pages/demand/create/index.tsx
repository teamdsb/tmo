import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

export default function DemandCreate() {
  const navbarStyle = getNavbarStyle()
  const [name, setName] = useState('')
  const [spec, setSpec] = useState('')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      await Taro.showToast({ title: '请输入产品名称', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await commerceServices.productRequests.create({
        name: name.trim(),
        spec: spec.trim() || undefined,
        qty: qty.trim() || undefined,
        note: note.trim() || undefined
      })
      await Taro.showToast({ title: '已提交需求', icon: 'success' })
      await navigateTo(ROUTES.demandList)
    } catch (error) {
      console.warn('create demand failed', error)
      await Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>创建需求</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>告诉我们你的需求，我们来帮你找货。</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='产品名称'>
            <Input value={name} onInput={(event) => setName(event.detail.value)} />
          </Cell>
          <Cell title='规格'>
            <Input value={spec} onInput={(event) => setSpec(event.detail.value)} />
          </Cell>
          <Cell title='数量'>
            <Input value={qty} onInput={(event) => setQty(event.detail.value)} />
          </Cell>
          <Cell title='备注' align='start'>
            <Textarea value={note} onInput={(event) => setNote(event.detail.value)} />
          </Cell>
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block color='primary' loading={submitting} onClick={handleSubmit}>
            提交需求
          </Button>
        </View>
      </View>
    </View>
  )
}
