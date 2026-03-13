import { Input, View } from '@tarojs/components'
import './index.scss'

type HomeSearchInputProps = {
  value: string
  placeholder?: string
  onInput: (value: string) => void
}

export default function HomeSearchInput({
  value,
  placeholder = '按 SKU 或名称搜索...',
  onInput
}: HomeSearchInputProps) {
  return (
    <View className='home-search-shell'>
      <View className='home-search-icon' aria-hidden='true'>
        <View className='home-search-icon-circle' />
        <View className='home-search-icon-handle' />
      </View>
      <Input
        className='home-search-input'
        type='text'
        confirmType='search'
        value={value}
        placeholder={placeholder}
        placeholderClass='home-search-placeholder'
        onInput={(event) => onInput(event.detail.value)}
      />
    </View>
  )
}
