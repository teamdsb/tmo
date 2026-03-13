import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
type FlexDirection = 'row' | 'column'
type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse'

type FlexProps = PropsWithChildren<{
  className?: string
  style?: Record<string, string | number>
  align?: FlexAlign
  justify?: FlexJustify
  direction?: FlexDirection
  wrap?: FlexWrap
  gutter?: number | string | [number | string, number | string]
}>

const alignMap: Record<FlexAlign, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
  baseline: 'baseline'
}

const justifyMap: Record<FlexJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly'
}

const normalizeGap = (gutter: FlexProps['gutter']): { columnGap?: string | number; rowGap?: string | number } => {
  if (gutter == null) {
    return {}
  }

  if (Array.isArray(gutter)) {
    return {
      columnGap: gutter[0],
      rowGap: gutter[1]
    }
  }

  return {
    columnGap: gutter,
    rowGap: gutter
  }
}

export default function Flex({
  children,
  className,
  style,
  align = 'start',
  justify = 'start',
  direction = 'row',
  wrap = 'nowrap',
  gutter
}: FlexProps) {
  const gapStyle = normalizeGap(gutter)

  return (
    <View
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        flexWrap: wrap,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        ...gapStyle,
        ...style
      }}
    >
      {children}
    </View>
  )
}
