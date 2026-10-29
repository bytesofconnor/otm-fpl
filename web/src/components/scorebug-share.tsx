"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cardKey, presentShare, type CardSource, type ShareReceipt } from "@/lib/scorebug-key"

function receiptLabel(receipt: ShareReceipt | "idle", idle: string): string {
  if (receipt === "shared") return "Shared"
  if (receipt === "copied") return "Copied"
  if (receipt === "failed") return "Try again"
  return idle
}

export function ScorebugShare({ source }: { source: CardSource }) {
  const idle = source.kind === "matchup" ? "Share matchup" : "Share recommendation"
  const [receipt, setReceipt] = React.useState<ShareReceipt | "idle">("idle")
  const timer = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [])

  async function onShare() {
    const result = await presentShare(cardKey(source))
    if (result === "cancelled") {
      if (timer.current != null) window.clearTimeout(timer.current)
      timer.current = null
      setReceipt("idle")
      return
    }
    setReceipt(result)
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setReceipt("idle")
    }, 1600)
  }

  return (
    <Button
      type="button"
      size="lg"
      className="min-h-11 w-full whitespace-normal"
      aria-live="polite"
      onClick={() => {
        void onShare()
      }}
    >
      {receiptLabel(receipt, idle)}
    </Button>
  )
}
