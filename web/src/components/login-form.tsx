"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConnectedLeague } from "@/lib/league-session"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { isSupabaseAuthConfigured } from "@/lib/supabase/env"

export function LoginForm(): React.ReactElement {
  const router = useRouter()
  const { storedTeamName } = useConnectedLeague()
  const [email, setEmail] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const configured = isSupabaseAuthConfigured()

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const supabase = createBrowserSupabaseClient()
    if (!supabase) {
      setError("Accounts are not configured on this host yet.")
      return
    }
    setBusy(true)
    setError(null)
    const origin = window.location.origin
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Exact path — extra query params get rejected and fall back to Site URL (production).
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })
    setBusy(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setSent(true)
  }

  if (!configured) {
    return (
      <PageShell width="article">
        <p className="otm-kicker">Account</p>
        <h1 className="otm-title mt-2 text-3xl">Sign in</h1>
        <p className="mt-4 text-[15px] text-muted-foreground">
          Auth is not wired on this environment. Add the public Supabase URL and publishable key, then magic links will work.
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={() => router.push("/")}>
          Back to league
        </Button>
      </PageShell>
    )
  }

  return (
    <PageShell width="article">
        <p className="otm-kicker">Save your squad</p>
        <h1 className="otm-title mt-2 text-3xl">Sign in</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          {storedTeamName
            ? `This browser already has ${storedTeamName}. A one-time link keeps it on the next phone.`
            : "This browser already has your league. A one-time link keeps the same squad on the next phone."}
        </p>
      {sent ? (
        <p className="mt-8 text-[15px] text-foreground">
          Check {email} for the link. It should open this same address, not the live Vercel site.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex max-w-md flex-col gap-3">
          <label htmlFor="email" className="text-[13px] font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send link"}
          </Button>
        </form>
      )}
    </PageShell>
  )
}
