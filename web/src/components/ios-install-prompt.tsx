"use client"

import { useState, useEffect } from "react"
import { X, Share } from "lucide-react"

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Only show on iOS Safari when not in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isInStandaloneMode = window.matchMedia("(display-mode: standalone)").matches
    // Check iOS-specific standalone mode
    const isIOSStandalone = "standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true
    const hasSeenPrompt = localStorage.getItem("ios-install-prompt-dismissed")

    if (isIOS && !isInStandaloneMode && !isIOSStandalone && !hasSeenPrompt) {
      // Show after a short delay
      const timer = setTimeout(() => setShowPrompt(true), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const dismissPrompt = () => {
    setShowPrompt(false)
    localStorage.setItem("ios-install-prompt-dismissed", "true")
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl">🌕</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Install Over the Moon</h3>
                <p className="text-xs text-muted-foreground">Add to Home Screen for quick access</p>
              </div>
              <button
                onClick={dismissPrompt}
                className="tap shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors -mr-2"
                aria-label="Dismiss install prompt"
                style={{ minWidth: '44px', minHeight: '44px' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1 pl-12">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-500/20 text-blue-400 shrink-0">
                  <Share className="w-3.5 h-3.5" />
                </span>
                <span>Tap Share, then &quot;Add to Home Screen&quot;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
