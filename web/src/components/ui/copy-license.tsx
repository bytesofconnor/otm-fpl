// Description: Copy the stored license token, with a fallback dialog.
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function CopyLicenseButton(): React.ReactElement {
  const [copied, setCopied] = React.useState(false)
  const [paid, setPaid] = React.useState<boolean | null>(null)
  const [exp, setExp] = React.useState<string | null>(null)
  const [showToken, setShowToken] = React.useState(false)
  const [tokenText, setTokenText] = React.useState("")

  React.useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setPaid(Boolean(d?.paid)))
      .catch(() => setPaid(null))
    try {
      const token = localStorage.getItem("otm_license") || ""
      if (token) {
        const parts = token.split(".")
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1])) as { exp?: number }
          if (payload?.exp) {
            setExp(new Date(payload.exp * 1000).toLocaleDateString())
          }
        }
        setTokenText(token)
      }
    } catch {}
  }, [])

  const onCopy = async () => {
    const token = localStorage.getItem("otm_license") || ""
    if (!token) {
      setCopied(false)
      setShowToken(true)
      return
    }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } else {
        setShowToken(true)
      }
    } catch {
      setShowToken(true)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
      <span className={paid ? "font-medium text-live" : ""}>{paid ? "Paid" : "Free"}</span>
      {exp ? <span>Expires {exp}</span> : null}
      <Button type="button" variant="outline" size="sm" onClick={() => void onCopy()}>
        {copied ? "Copied" : "Copy token"}
      </Button>
      <Dialog open={showToken} onOpenChange={setShowToken}>
        <DialogContent>
          <DialogHeader>
            <p className="otm-kicker">License</p>
            <DialogTitle>Your token</DialogTitle>
            <DialogDescription>
              {tokenText
                ? "Copy this token to restore Over the Moon on another device."
                : "No token on this device. After checkout it is saved here. On another device, restore with the token first."}
            </DialogDescription>
          </DialogHeader>
          {tokenText ? <Textarea readOnly value={tokenText} /> : null}
          <DialogFooter>
            <Button disabled={!tokenText} onClick={() => void onCopy()}>
              Copy
            </Button>
            <Button variant="ghost" onClick={() => setShowToken(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
