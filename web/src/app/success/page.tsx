// Description: Success landing – verifies session, then returns home.
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CopyLicenseButton } from "@/components/ui/copy-license"
import { PageShell } from "@/components/page-shell"

export default function SuccessPage() {
  const router = useRouter()
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get("session_id")
    if (!id) {
      router.replace("/")
      return
    }
    fetch(`/api/verify?session_id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        const token = d?.token as string | undefined
        if (token) {
          try {
            localStorage.setItem("otm_license", token)
          } catch {}
        }
        router.replace("/")
      })
      .catch(() => router.replace("/"))
  }, [router])
  return (
    <PageShell width="article">
      <p className="otm-kicker">Checkout</p>
      <h1 className="otm-title mt-2 text-3xl">Finalizing purchase</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        If you are not redirected, copy your license token and go back to League.
      </p>
      <div className="mt-5">
        <CopyLicenseButton />
      </div>
    </PageShell>
  )
}
