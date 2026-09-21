import { View, Text } from '@tarojs/components'
import TaroifyButton from '@taroify/core/button'
import { getSpecLevelOptions, normalizeSpecDimensions, selectSpecValue } from '@tmo/shared'
import type { SpecDimensions, SpecificationSku } from '@tmo/shared'
import './index.scss'

type SpecSelectorProps = {
  dimensions: SpecDimensions
  skus: readonly SpecificationSku[]
  selection: readonly string[]
  onChange: (selection: string[]) => void
}

export default function SpecSelector({ dimensions, skus, selection, onChange }: SpecSelectorProps) {
  return (
    <View className='spec-selector'>
      {normalizeSpecDimensions(dimensions).map((name, level) => {
        const options = getSpecLevelOptions(dimensions, skus, selection, level)
        return (
          <View key={`${level}-${name}`} className='spec-selector-level'>
            <Text className='spec-selector-name'>{name}</Text>
            <View className='spec-selector-options'>
              {options.map((value) => (
                <TaroifyButton
                  key={value}
                  size='small'
                  className={`product-sku-button ${selection[level] === value ? 'product-sku-button--selected' : ''}`}
                  color={selection[level] === value ? 'primary' : 'default'}
                  variant={selection[level] === value ? 'contained' : 'outlined'}
                  onClick={() => onChange(selectSpecValue(selection, level, value))}
                >
                  {value}
                </TaroifyButton>
              ))}
            </View>
            {level > 0 && !selection[level - 1] ? <Text className='spec-selector-hint'>请先选择{normalizeSpecDimensions(dimensions)[level - 1]}</Text> : null}
          </View>
        )
      })}
    </View>
  )
}
