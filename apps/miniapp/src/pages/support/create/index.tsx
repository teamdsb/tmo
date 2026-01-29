import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import ArrowLeft from '@taroify/icons/ArrowLeft'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import AppTabbar from '../../../components/app-tabbar'
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
      await Taro.showToast({ title: 'Subject and description required', icon: 'none' })
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
      await Taro.showToast({ title: 'Ticket submitted', icon: 'success' })
      await navigateTo(ROUTES.support)
    } catch (error) {
      console.warn('submit after-sales failed', error)
      await Taro.showToast({ title: 'Submit failed', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle}>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.support))}>
          <ArrowLeft className='text-xl' />
        </Navbar.NavLeft>
      </Navbar>
      <View className='page-content'>
        <Text className='section-title'>After-Sales Ticket</Text>
        <Text className='section-subtitle'>Describe your issue and we will follow up quickly.</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='Subject'>
            <Input
              placeholder='e.g. Damaged packaging'
              value={subject}
              onInput={(event) => setSubject(event.detail.value)}
            />
          </Cell>
          <Cell title='Order ID'>
            <Input
              placeholder='Optional'
              value={orderId}
              onInput={(event) => setOrderId(event.detail.value)}
            />
          </Cell>
          <Cell title='Description' align='start'>
            <Textarea
              placeholder='Provide issue details, photos, or desired resolution.'
              value={description}
              onInput={(event) => setDescription(event.detail.value)}
            />
          </Cell>
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block color='primary' loading={submitting} onClick={handleSubmit}>
            Submit Ticket
          </Button>
        </View>
      </View>
      <AppTabbar value='mine' />
    </View>
  )
}
