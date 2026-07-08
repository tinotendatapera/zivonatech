'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
}

export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  fill = false
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (priority || !imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '50px' }
    )

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [priority])

  if (!isInView) {
    if (fill) {
      return (
        <div
          ref={imgRef as any}
          className={`${className} bg-zinc-900 animate-pulse`}
          aria-busy="true"
          aria-label={`Loading: ${alt}`}
        />
      )
    }
    return (
      <div
        ref={imgRef as any}
        className={`${className} bg-zinc-900 animate-pulse`}
        style={{ width, height }}
        aria-busy="true"
        aria-label={`Loading: ${alt}`}
      />
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`} role="img" aria-label={alt}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
        onLoad={() => setIsLoaded(true)}
      />
      {!isLoaded && <div className={`${className} bg-zinc-900 animate-pulse absolute inset-0`} aria-hidden="true" />}
    </div>
  )
}
