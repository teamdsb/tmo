import { useRef } from 'react'
import { useDidShow } from '@tarojs/taro'

type RefreshCallback = () => void

/**
 * Runs a refresh when an already-mounted page becomes visible again.
 * The page's mount effect owns the initial load, so the first onShow is skipped.
 */
export const useRefreshOnReturn = (refresh: RefreshCallback): void => {
  const refreshRef = useRef(refresh)
  const hasSeenInitialShowRef = useRef(false)
  refreshRef.current = refresh

  useDidShow(() => {
    if (!hasSeenInitialShowRef.current) {
      hasSeenInitialShowRef.current = true
      return
    }
    refreshRef.current()
  })
}
