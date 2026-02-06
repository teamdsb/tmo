import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { ensureLoggedIn } from '../../../utils/auth'
import { commerceServices } from '../../../services/commerce'

export default function SupportCreatePage() {
  const navbarStyle = getNavbarStyle()
  const [subject, setSubject] = useState('')
  const [orderId, setOrderId] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      await Taro.showToast({ title: '请填写主题和描述', icon: 'none' })
      return
    }
    const allowed = await ensureLoggedIn({ redirect: true })
    if (!allowed) return
    setSubmitting(true)
    try {
      await commerceServices.afterSales.createTicket({
        subject: subject.trim(),
        description: description.trim(),
        orderId: orderId.trim() || undefined
      })
      await Taro.showToast({ title: '工单已提交', icon: 'success' })
      await navigateTo(ROUTES.support)
    } catch (error) {
      console.warn('submit after-sales failed', error)
      await Taro.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.support))} />
        <Navbar.Title>售后工单</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>描述问题，我们会尽快跟进。</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='主题'>
            <Input
              placeholder='例如：包装破损'
              value={subject}
              onInput={(event) => setSubject(event.detail.value)}
            />
          </Cell>
          <Cell title='订单号'>
            <Input
              placeholder='可选'
              value={orderId}
              onInput={(event) => setOrderId(event.detail.value)}
            />
          </Cell>
          <Cell title='描述' align='start'>
            <Textarea
              placeholder='请提供问题详情、照片或期望处理方式。'
              value={description}
              onInput={(event) => setDescription(event.detail.value)}
            />
          </Cell>
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block color='primary' loading={submitting} onClick={handleSubmit}>
            提交工单
          </Button>
        </View>
      </View>
    </View>
  )
}
