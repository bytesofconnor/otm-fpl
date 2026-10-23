"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { useConnectedLeague } from "@/lib/league-session"

/**
 * Simplified login form for single-user app.
 * Auth removed — profile is stored client-side only via league-session cookies.
 */
export function LoginForm(): React.ReactElement {
  const router = useRouter()
  const { storedTeamName } = useConnectedLeague()

  return (
    <PageShell width="article">
      <p className="otm-kicker">Your squad</p>
      <h1 className="otm-title mt-2 text-3xl">League profile</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        {storedTeamName
          ? `This browser is connected to ${storedTeamName}. Your league profile is stored locally.`
          : "This browser has your league connection. Your profile is stored locally."}
      </p>
      <p className="mt-4 text-[15px] text-muted-foreground">
        No account needed — Over the Moon is a single-user app for the league champion. Your preferences stay in this browser.
      </p>
      <Button type="button" variant="outline" className="mt-6" onClick={() => router.push("/")}>
        Back to league
      </Button>
    </PageShell>
  )
}
