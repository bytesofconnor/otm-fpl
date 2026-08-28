// Description: Paste a license token and activate it on this device.
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
  DialogTrigger,
} from "@/components/ui/dialog"

export function RestoreLicense() {
  const [open, setOpen] = React.useState(false)
  const [token, setToken] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      })
      const data = await res.json()
      if (data?.ok) {
        try {
          localStorage.setItem("otm_license", token.trim())
        } catch {}
        setMsg("Activated. You can continue from here.")
      } else {
        setMsg(data?.error === "rate_limited" ? "Too many attempts. Wait a minute and try again." : "Invalid token.")
      }
    } catch {
      setMsg("Could not activate. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        Restore purchase
      </DialogTrigger>
      <DialogContent>
          <DialogHeader>
            <p className="otm-kicker">License</p>
            <DialogTitle>Restore purchase</DialogTitle>
            <DialogDescription>Paste your license token.</DialogDescription>
          </DialogHeader>
          {msg ? <p className="text-[13px] text-foreground">{msg}</p> : null}
          <Textarea value={token} onChange={(e) => setToken(e.target.value)} />
          <DialogFooter>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Activating…" : "Activate"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}
