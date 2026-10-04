import { Button, Text, View } from '@tarojs/components'
import type { CartImportJob, CartImportPendingItem } from '@tmo/api-client'
import { formatPendingMeta, MATCH_TYPE_BADGES } from './helpers'
import type { ImportTab, SelectionMap } from './types'

type AutoAddedItem = NonNullable<CartImportJob['result']>['autoAddedItems'][number]

type ImportResultViewProps = {
  activeTab: ImportTab
  autoAddedItems: AutoAddedItem[]
  handleSelectSpec: (item: CartImportPendingItem) => Promise<void>
  identifiedCount: number
  disabled: boolean
  onTabChange: (tab: ImportTab) => void
  pendingItems: CartImportPendingItem[]
  progressPercent: number
  selectionMap: SelectionMap
  totalCount: number
}

export function ImportResultView({
  activeTab,
  autoAddedItems,
  handleSelectSpec,
  identifiedCount,
  disabled,
  onTabChange,
  pendingItems,
  progressPercent,
  selectionMap,
  totalCount
}: ImportResultViewProps) {
  return (
    <View className='flex-1 flex flex-col bg-white'>
      <View className='px-6 pt-2 pb-2 bg-white'>
        <View className='flex items-center gap-4 mb-2'>
          <View className='flex-1 h-1 bg-slate-100 rounded-full overflow-hidden'>
            <View className='h-full bg-blue-600 rounded-full' style={{ width: `${progressPercent}%` }} />
          </View>
          <Text className='text-10 font-medium text-slate-400 whitespace-nowrap'>
            {identifiedCount}/{totalCount} 已识别
          </Text>
        </View>
      </View>

      <View className='flex px-6 border-b border-slate-100 mb-2'>
        <View
          className={`pb-3 text-sm font-medium mr-8 ${
            activeTab === 'to-confirm'
              ? 'border-b-2 border-blue-600 text-slate-900'
              : 'text-slate-400'
          }`}
          onClick={() => onTabChange('to-confirm')}
        >
          <Text>待确认</Text>
          <Text className='text-10 align-top ml-1 text-blue-600'>
            {pendingItems.length}
          </Text>
        </View>
        <View
          className={`pb-3 text-sm font-medium ${
            activeTab === 'confirmed'
              ? 'border-b-2 border-blue-600 text-slate-900'
              : 'text-slate-400'
          }`}
          onClick={() => onTabChange('confirmed')}
        >
          <Text>已确认</Text>
          <Text className='text-10 align-top ml-1'>{autoAddedItems.length}</Text>
        </View>
      </View>

      <View className='px-6 py-2 pb-40'>
        {activeTab === 'to-confirm' ? (
          pendingItems.length > 0 ? (
            pendingItems.map((item) => {
              const selected = selectionMap[item.rowNo]
              const badge = MATCH_TYPE_BADGES[item.matchType] ?? {
                label: '待处理',
                className: 'bg-slate-50 text-slate-500'
              }
              const buttonClass = selected
                ? 'border-blue-200 text-blue-600 bg-blue-50'
                : 'border-slate-200 text-slate-600 bg-transparent'

              return (
                <View
                  key={item.rowNo}
                  className='py-5 border-b border-slate-100 flex items-center justify-between gap-4'
                >
                  <View className='flex-1 min-w-0'>
                    <View className='flex items-center gap-2 mb-1 flex-wrap'>
                      <Text className='text-sm font-medium text-slate-900 truncate'>
                        {item.rawName}
                      </Text>
                      <View className={`px-2 py-1 rounded ${badge.className}`}>
                        <Text className='text-9 font-medium uppercase tracking-wide'>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <Text className='text-xs text-slate-400 font-light truncate'>
                      {formatPendingMeta(item)}
                    </Text>
                  </View>
                  {item.candidates?.length ? <Button
                    disabled={disabled}
                    className={`shrink-0 h-8 px-3 text-11 font-medium border rounded-lg ${buttonClass}`}
                    onClick={() => void handleSelectSpec(item)}
                  >
                    {selected ? '已选择' : '选择规格'}
                  </Button> : <Text className='text-xs text-slate-400'>未找到可选规格</Text>}
                </View>
              )
            })
          ) : (
            <View className='py-10 text-center'>
              <Text className='text-sm text-slate-400'>无待确认项</Text>
              <Text className='text-xs text-slate-300'>已自动匹配全部项目。</Text>
            </View>
          )
        ) : autoAddedItems.length > 0 ? (
          autoAddedItems.map((item) => (
            <View
              key={`${item.rowNo}-${item.skuId}`}
              className='py-5 border-b border-slate-100 flex items-center justify-between gap-4'
            >
              <View className='flex-1 min-w-0'>
                <Text className='text-sm font-medium text-slate-900 truncate'>
                  SKU {item.skuId.slice(0, 8)}
                </Text>
                <Text className='text-xs text-slate-400 font-light truncate'>
                  数量 {item.qty} • 行 {item.rowNo}
                </Text>
              </View>
              <View className='px-2 py-1 rounded bg-emerald-50'>
                <Text className='text-9 font-medium uppercase tracking-wide text-emerald-600'>
                  已确认
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View className='py-10 text-center'>
            <Text className='text-sm text-slate-400'>无已确认项</Text>
            <Text className='text-xs text-slate-300'>确认后将显示在此处。</Text>
          </View>
        )}
      </View>
    </View>
  )
}
