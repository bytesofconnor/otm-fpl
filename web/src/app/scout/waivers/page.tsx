// Scout Waivers — League-wide waiver wire claim helper
import type { Metadata } from "next"
import { WaiverBoard } from "@/components/scout-waiver-board"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "Scout · Waivers",
  description: "Prioritized waiver wire claims for Over the Moon. See claim priorities ranked by form and fixtures.",
}

// SIA default teamId (cbarrett97 / Saints Intelligence Agency)
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

export default async function ScoutWaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>
}) {
  const params = await searchParams
  const teamId = params.teamId ?? SIA_TEAM_ID

  return (
    <PageShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Scout Waivers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Waiver wire claim priorities. Ranked by form gap, fixtures, and confidence.
          </p>
        </header>

        <ScoutTeamPicker currentTeamId={teamId} basePath="/scout/waivers" />

        <WaiverBoard />
      </div>
    </PageShell>
  )
}
