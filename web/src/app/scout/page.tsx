// Scout Opportunity Board — League-wide pickup intelligence
import { Suspense } from "react"
import type { Metadata } from "next"
import { OpportunityBoard } from "@/components/scout-opportunity-board"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "Scout · Opportunity Board",
  description: "Pickup intelligence for Over the Moon. See hot wire opportunities ranked by form.",
}

// SIA default teamId (cbarrett97 / Saints Intelligence Agency)
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

export default async function ScoutPage({
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
            Scout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pickup opportunities ranked by form. Select any manager.
          </p>
        </header>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading team picker...</div>}>
          <ScoutTeamPicker currentTeamId={teamId} basePath="/scout" />
        </Suspense>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading opportunities...</div>}>
          <OpportunityBoard />
        </Suspense>
      </div>
    </PageShell>
  )
}
