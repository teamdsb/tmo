import type { CSSProperties, PropsWithChildren } from 'react'
import { View } from '@tarojs/components'
import FixedView from '@taroify/core/fixed-view'

import { getRuntimeDeviceInfo } from '../../utils/device-info'
import './index.scss'

type AppSafeAreaBottomProps = {
  className?: string
}

type AppFixedBottomProps = PropsWithChildren<{
  className?: string
  contentClassName?: string
  includeSafeArea?: boolean
  placeholder?: boolean
}>

const getBottomSafeAreaStyle = (): CSSProperties => {
  const metrics = getRuntimeDeviceInfo()
  if (!metrics.bottomSafeAreaAvailable) {
    return {}
  }
  return {
    '--app-safe-area-bottom': `${metrics.bottomSafeArea}px`
  } as CSSProperties
}

export function AppSafeAreaBottom({ className }: AppSafeAreaBottomProps) {
  const classes = ['app-safe-area-bottom', className].filter(Boolean).join(' ')
  return <View aria-hidden className={classes} style={getBottomSafeAreaStyle()} />
}

export default function AppFixedBottom({
  children,
  className,
  contentClassName,
  includeSafeArea = true,
  placeholder = true
}: AppFixedBottomProps) {
  const classes = ['app-fixed-bottom', className].filter(Boolean).join(' ')
  return (
    <FixedView position='bottom' placeholder={placeholder} className={classes}>
      <View className={contentClassName}>{children}</View>
      {includeSafeArea ? <AppSafeAreaBottom /> : null}
    </FixedView>
  )
}
