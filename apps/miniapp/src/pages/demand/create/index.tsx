import { useEffect, useMemo, useState } from 'react'
import { View, Text, Input, Textarea, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import Navbar from '@taroify/core/navbar'
import Button from '@taroify/core/button'
import Cell from '@taroify/core/cell'
import Tag from '@taroify/core/tag'
import type { Category } from '@tmo/api-client'
import { ROUTES } from '../../../routes'
import { getNavbarStyle } from '../../../utils/navbar'
import { navigateTo, switchTabLike } from '../../../utils/navigation'
import { commerceServices } from '../../../services/commerce'

const decodeQueryValue = (value?: string) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const isUUID = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

type ApiLikeError = {
  message?: unknown
  statusCode?: unknown
  code?: unknown
}

const readUploadError = (error: unknown) => {
  const fallbackMessage = '上传失败'
  if (!error || typeof error !== 'object') {
    return {
      toastMessage: fallbackMessage
    }
  }

  const apiError = error as ApiLikeError
  const statusCode = typeof apiError.statusCode === 'number' ? apiError.statusCode : undefined
  const code = typeof apiError.code === 'string' ? apiError.code : undefined
  const message = typeof apiError.message === 'string' ? apiError.message.trim() : ''

  if (message && message !== 'request failed') {
    return {
      toastMessage: message,
      statusCode,
      code,
      message
    }
  }

  if (statusCode === 404) {
    return {
      toastMessage: '上传服务未就绪',
      statusCode,
      code,
      message
    }
  }

  if (statusCode === 401 || code === 'unauthorized') {
    return {
      toastMessage: '请先登录后再上传',
      statusCode,
      code,
      message
    }
  }

  if (statusCode === 413) {
    return {
      toastMessage: '图片过大，请压缩后重试',
      statusCode,
      code,
      message
    }
  }

  if (statusCode === 415) {
    return {
      toastMessage: '仅支持上传图片',
      statusCode,
      code,
      message
    }
  }

  return {
    toastMessage: fallbackMessage,
    statusCode,
    code,
    message
  }
}

const readCreateError = (error: unknown) => {
  const fallbackMessage = '提交失败'
  if (!error || typeof error !== 'object') {
    return {
      toastMessage: fallbackMessage
    }
  }

  const apiError = error as ApiLikeError
  const statusCode = typeof apiError.statusCode === 'number' ? apiError.statusCode : undefined
  const code = typeof apiError.code === 'string' ? apiError.code : undefined
  const message = typeof apiError.message === 'string' ? apiError.message.trim() : ''

  if (message === 'categoryId does not exist') {
    return {
      toastMessage: '类目不存在，请从下方标签选择',
      statusCode,
      code,
      message
    }
  }

  if (message && message !== 'request failed') {
    return {
      toastMessage: message,
      statusCode,
      code,
      message
    }
  }

  return {
    toastMessage: fallbackMessage,
    statusCode,
    code,
    message
  }
}

export default function DemandCreate() {
  const router = useRouter()
  const navbarStyle = getNavbarStyle()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [spec, setSpec] = useState('')
  const [qty, setQty] = useState('')
  const [material, setMaterial] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [color, setColor] = useState('')
  const [note, setNote] = useState('')
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const kw = useMemo(() => {
    return typeof router.params?.kw === 'string' ? decodeQueryValue(router.params.kw).trim() : ''
  }, [router.params?.kw])

  useEffect(() => {
    if (!kw) return
    setName((current) => (current.trim() ? current : kw))
  }, [kw])

  useEffect(() => {
    void (async () => {
      try {
        const response = await commerceServices.catalog.listCategories()
        setCategories(response.items ?? [])
      } catch (error) {
        console.warn('load categories failed', error)
      }
    })()
  }, [])

  const removeReferenceImage = (value: string) => {
    setReferenceImageUrls((current) => current.filter((item) => item !== value))
  }

  const uploadReferenceImage = async () => {
    if (uploading) return
    setUploading(true)
    try {
      const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed', 'original'] })
      const filePath = selected.tempFilePaths?.[0]
      if (!filePath) return
      const uploaded = await commerceServices.productRequests.uploadAsset(filePath)
      if (referenceImageUrls.includes(uploaded.url)) {
        return
      }
      setReferenceImageUrls((current) => [...current, uploaded.url])
      await Taro.showToast({ title: '图片已上传', icon: 'success' })
    } catch (error) {
      const uploadError = readUploadError(error)
      console.warn('upload demand image failed', {
        statusCode: uploadError.statusCode,
        code: uploadError.code,
        message: uploadError.message
      }, error)
      await Taro.showToast({ title: uploadError.toastMessage, icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      await Taro.showToast({ title: '请输入产品名称', icon: 'none' })
      return
    }
    if (categoryId.trim() && !isUUID(categoryId.trim())) {
      await Taro.showToast({ title: '类目ID格式错误', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await commerceServices.productRequests.create({
        name: name.trim(),
        categoryId: categoryId.trim() ? categoryId.trim() : undefined,
        spec: spec.trim() || undefined,
        material: material.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        color: color.trim() || undefined,
        qty: qty.trim() || undefined,
        note: note.trim() || undefined,
        referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined
      })
      await Taro.showToast({ title: '已提交需求', icon: 'success' })
      await navigateTo(ROUTES.demandList)
    } catch (error) {
      const createError = readCreateError(error)
      console.warn('create demand failed', {
        statusCode: createError.statusCode,
        code: createError.code,
        message: createError.message
      }, error)
      await Taro.showToast({ title: createError.toastMessage, icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='page'>
      <Navbar bordered fixed placeholder safeArea='top' style={navbarStyle} className='app-navbar'>
        <Navbar.NavLeft onClick={() => Taro.navigateBack().catch(() => switchTabLike(ROUTES.mine))} />
        <Navbar.Title>我的需求</Navbar.Title>
      </Navbar>
      <View className='page-content'>
        <Text className='section-subtitle'>找不到 SKU 或商品时，提交需求让我们帮你寻源。</Text>

        <Cell.Group inset className='mt-4 demand-form-group'>
          <Cell title='产品名称（必填）'>
            <Input
              value={name}
              placeholder='例如：无线降噪耳机'
              onInput={(event) => setName(event.detail.value)}
            />
          </Cell>
          <Cell title='产品类目ID（可选）'>
            <Input
              value={categoryId}
              placeholder='请选择下方类目标签，或留空'
              onInput={(event) => setCategoryId(event.detail.value)}
            />
            <Text className='demand-category-tip'>需选择系统内已有类目，不能随意填写 UUID。</Text>
            {categories.length > 0 ? (
              <View className='demand-category-tags'>
                {categories.slice(0, 8).map((item) => (
                  <Tag
                    key={item.id}
                    size='small'
                    color={categoryId === item.id ? 'primary' : undefined}
                    onClick={() => setCategoryId(item.id)}
                  >
                    {item.name}
                  </Tag>
                ))}
              </View>
            ) : null}
          </Cell>
          <Cell title='目标数量'>
            <Input
              value={qty}
              placeholder='例如：500 件'
              onInput={(event) => setQty(event.detail.value)}
            />
          </Cell>
          <Cell title='材质'>
            <Input value={material} placeholder='例如：塑料' onInput={(event) => setMaterial(event.detail.value)} />
          </Cell>
          <Cell title='尺寸'>
            <Input
              value={dimensions}
              placeholder='例如：长 x 宽 x 高'
              onInput={(event) => setDimensions(event.detail.value)}
            />
          </Cell>
          <Cell title='颜色'>
            <Input value={color} placeholder='例如：黑色' onInput={(event) => setColor(event.detail.value)} />
          </Cell>
          <Cell title='规格'>
            <Input value={spec} placeholder='例如：蓝牙 5.3' onInput={(event) => setSpec(event.detail.value)} />
          </Cell>
          <Cell title='备注' align='start'>
            <Textarea
              value={note}
              placeholder='可填写交期、包装、验收标准等要求'
              onInput={(event) => setNote(event.detail.value)}
            />
          </Cell>
          <Cell title='参考图片' align='start'>
            <View className='demand-reference-editor'>
              <Button size='small' variant='outlined' loading={uploading} onClick={uploadReferenceImage}>
                上传图片
              </Button>
            </View>
            {referenceImageUrls.length > 0 ? (
              <View className='demand-reference-list'>
                {referenceImageUrls.map((url) => (
                  <View key={url} className='demand-reference-item'>
                    <Image src={url} className='demand-reference-thumb' mode='aspectFill' />
                    <Text className='demand-reference-remove' onClick={() => removeReferenceImage(url)}>删除</Text>
                  </View>
                ))}
              </View>
            ) : null}
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
