// Description: Client-side <img> with graceful fallback when the source 404s.
"use client"

import * as React from "react"

import { nextPlayerPhotoUrl } from "@/lib/clubs"

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string
}

export function ImageWithFallback({ src, fallback = "/player-fallback.svg", alt, ...rest }: Props) {
  const start = typeof src === "string" ? src : undefined
  const [currentSrc, setCurrentSrc] = React.useState<string | undefined>(start)

  React.useEffect(() => {
    setCurrentSrc(typeof src === "string" ? src : undefined)
  }, [src])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      alt={alt}
      referrerPolicy="no-referrer"
      src={currentSrc ?? fallback}
      onError={(e) => {
        const next = nextPlayerPhotoUrl(currentSrc, currentSrc === fallback ? undefined : fallback)
        if (next && next !== currentSrc) {
          setCurrentSrc(next)
        } else if (currentSrc !== fallback) {
          setCurrentSrc(fallback)
        }
        rest.onError?.(e)
      }}
    />
  )
}
