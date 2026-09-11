"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/client"
import { isSupabaseAuthConfigured } from "@/lib/supabase/env"

const accountClass =
  "tap inline-flex min-h-9 items-center px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground sm:text-[12px]"

export function AuthMenu(): React.ReactElement | null {
  const router = useRouter()
  const [email, setEmail] = React.useState<string | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (!isSupabaseAuthConfigured()) {
      setReady(true)
      return
    }
    const supabase = createBrowserSupabaseClient()
    if (!supabase) {
      setReady(true)
      return
    }
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setEmail(data.session?.user.email ?? null)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null)
      setReady(true)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!isSupabaseAuthConfigured()) return null
  if (!ready) return <span className="inline-block w-10" aria-hidden />

  if (!email) {
    return (
      <>
        <span aria-hidden>·</span>
        <Link href="/login" className={accountClass}>
          Sign in
        </Link>
      </>
    )
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient()
    await supabase?.auth.signOut()
    setEmail(null)
    router.refresh()
  }

  const short = email.split("@")[0] ?? email

  return (
    <>
      <span aria-hidden>·</span>
      <span className="hidden max-w-[8rem] truncate sm:inline" title={email}>
        {short}
      </span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      <button type="button" className={accountClass} onClick={() => void signOut()}>
        Sign out
      </button>
    </>
  )
}
