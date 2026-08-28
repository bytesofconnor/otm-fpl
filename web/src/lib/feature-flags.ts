// Description: Lightweight feature flags with URL/cookie overrides and env-based defaults.
"use client"

import * as React from 'react'

export const KNOWN_FLAGS = [
  // Reserved for future feature flags
] as const

export type FeatureFlag = typeof KNOWN_FLAGS[number]
export type FlagMap = Record<FeatureFlag, boolean>

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name) + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

function writeCookie(name: string, val: string, days = 7) {
  if (typeof document === 'undefined') return
  const d = new Date()
  d.setTime(d.getTime() + days * 864e5)
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
}

function defaultsFromEnv(): Partial<FlagMap> {
  // IMPORTANT: Next.js only inlines env vars that are statically referenced.
  // Avoid dynamic access like process.env[key] on the client.
  return {}
}

/**
 * useFeatureFlags
 * Priority order (highest wins):
 * 1) URL ?ff=a,b,c (also persisted to cookie for 7 days)
 * 2) Cookie ff=a,b,c
 * 3) Env defaults NEXT_PUBLIC_FLAG_*
 */
export function useFeatureFlags(): FlagMap {
  const [flags, setFlags] = React.useState<FlagMap>(() => ({
    ...defaultsFromEnv(),
  }))

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const urlParam = params.get('ff')
      const fromCookie = readCookie('ff')
      let enabled: string[] | null = null
      if (urlParam && urlParam.trim()) {
        enabled = urlParam.split(',').map((s) => s.trim()).filter(Boolean)
        writeCookie('ff', enabled.join(','), 7)
      } else if (fromCookie) {
        enabled = fromCookie.split(',').map((s) => s.trim()).filter(Boolean)
      }
      if (enabled) {
        setFlags((prev) => {
          const next = { ...prev }
          for (const key of KNOWN_FLAGS) next[key] = enabled!.includes(key)
          return next
        })
      }
    } catch {}
  }, [])

  return flags
}

export function useFeature(flag: FeatureFlag): boolean {
  const map = useFeatureFlags()
  return map[flag]
}
