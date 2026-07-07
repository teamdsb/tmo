import { useEffect, useRef, useState } from 'react'
import Image from '@taroify/core/image'

import placeholderImage from '../../assets/images/placeholder-product.svg'

type SafeImageProps = {
  src?: string | null
  fallback?: string
  onError?: (...args: any[]) => void
  onLoad?: (...args: any[]) => void
} & Record<string, any>

const IMAGE_FALLBACK_TIMEOUT_MS = 2500

export default function SafeImage({
  src,
  fallback = placeholderImage,
  onError,
  onLoad,
  ...rest
}: SafeImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src || fallback)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const nextSrc = src || fallback
    setResolvedSrc(nextSrc)

    if (!src || nextSrc === fallback) {
      return undefined
    }

    timeoutRef.current = setTimeout(() => {
      setResolvedSrc((current) => (current === nextSrc ? fallback : current))
    }, IMAGE_FALLBACK_TIMEOUT_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [fallback, src])

  return (
    <Image
      key={resolvedSrc}
      {...rest}
      src={resolvedSrc}
      onLoad={(...args: any[]) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        onLoad?.(...args)
      }}
      onError={(...args: any[]) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        if (resolvedSrc !== fallback) {
          setResolvedSrc(fallback)
        }
        onError?.(...args)
      }}
    />
  )
}
