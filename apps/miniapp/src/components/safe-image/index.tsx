import { useEffect, useState } from 'react'
import Image from '@taroify/core/image'

import placeholderImage from '../../assets/images/placeholder-product.svg'

type SafeImageProps = {
  src?: string | null
  fallback?: string
  onError?: (...args: any[]) => void
} & Record<string, any>

export default function SafeImage({
  src,
  fallback = placeholderImage,
  onError,
  ...rest
}: SafeImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src || fallback)

  useEffect(() => {
    setResolvedSrc(src || fallback)
  }, [src, fallback])

  return (
    <Image
      {...rest}
      src={resolvedSrc}
      onError={(...args: any[]) => {
        if (resolvedSrc !== fallback) {
          setResolvedSrc(fallback)
        }
        onError?.(...args)
      }}
    />
  )
}
