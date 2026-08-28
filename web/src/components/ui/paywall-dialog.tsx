// Description: Branded paywall dialog using the same surfaces as the rest of OTM.
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { RestoreLicense } from "@/components/ui/restore-license"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  onClose: () => void
  onUnlock: () => Promise<void>
}

export function PaywallDialog({ open, onClose, onUnlock }: Props): React.ReactElement {
  const [showRestore, setShowRestore] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleUnlock() {
    setError(null)
    setLoading(true)
    try {
      await onUnlock()
    } catch (e) {
      const msg = (e as { message?: string })?.message || "Unable to start checkout. Please try again."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent>
        {error ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
        ) : null}
        <DialogHeader>
          <p className="otm-kicker">Unlock</p>
          <DialogTitle>Over the Moon</DialogTitle>
          <DialogDescription>
            Free preview reached. Unlock the full kit for <span className="font-medium text-foreground">$4.99</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button onClick={handleUnlock} disabled={loading}>
            {loading ? "Loading…" : "Unlock $4.99"}
          </Button>
          <Button variant="ghost" onClick={() => setShowRestore((v) => !v)}>
            {showRestore ? "Hide restore" : "Restore"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </DialogFooter>
        <p className="text-[12px] text-muted-foreground">Secure checkout via Stripe.</p>
        {showRestore ? (
          <div className="border-t border-border pt-4">
            <RestoreLicense />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
