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
      await Taro.showToast({ title: 'Product name is required', icon: 'none' })
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
      await Taro.showToast({ title: 'Request submitted', icon: 'success' })
      await navigateTo(ROUTES.demandList)
    } catch (error) {
      console.warn('create demand failed', error)
      await Taro.showToast({ title: 'Submit failed', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>Create Demand</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>Tell us what you need and we will source it.</Text>

        <Cell.Group inset className='mt-4'>
          <Cell title='Product Name'>
            <Input value={name} onInput={(event) => setName(event.detail.value)} />
          </Cell>
          <Cell title='Spec'>
            <Input value={spec} onInput={(event) => setSpec(event.detail.value)} />
          </Cell>
          <Cell title='Quantity'>
            <Input value={qty} onInput={(event) => setQty(event.detail.value)} />
          </Cell>
          <Cell title='Note' align='start'>
            <Textarea value={note} onInput={(event) => setNote(event.detail.value)} />
          </Cell>
        </Cell.Group>

        <View className='placeholder-actions'>
          <Button block color='primary' loading={submitting} onClick={handleSubmit}>
            Submit Demand
          </Button>
        </View>
      </View>
    </View>
  )
}
