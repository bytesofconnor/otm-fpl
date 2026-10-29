"use client"

import { useState, useEffect } from "react"
import { Share, X } from "lucide-react"
import { pageWidth } from "@/components/page-shell"

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
    const isIOSStandalone = "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true
    const hasSeenPrompt = localStorage.getItem("ios-install-prompt-dismissed")

    if (!isIOS || isInStandaloneMode || isIOSStandalone || hasSeenPrompt) return
    const timer = window.setTimeout(() => setShowPrompt(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function dismissPrompt() {
    setShowPrompt(false)
    localStorage.setItem("ios-install-prompt-dismissed", "true")
  }

  if (!showPrompt) return null

  return (
    <div className="border-b border-border bg-card" role="region" aria-label="Install Over the Moon">
      <div className={`${pageWidth} flex items-start gap-2 py-1.5`}>
        <span className="mt-2.5 text-base leading-none" aria-hidden>
          🌕
        </span>
        <div className="min-w-0 flex-1 py-1.5">
          <p className="text-sm font-semibold whitespace-normal">Install Over the Moon</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs whitespace-normal text-muted-foreground">
            <Share className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Tap Share, then Add to Home Screen</span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismissPrompt}
          className="tap flex size-11 shrink-0 items-center justify-center text-muted-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  )
}
