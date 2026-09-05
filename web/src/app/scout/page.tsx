// Scout Opportunity Board — League-wide pickup intelligence
import type { Metadata } from "next"
import { Suspense } from "react"
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

        <Suspense fallback={<TeamPickerFallback />}>
          <ScoutTeamPicker currentTeamId={teamId} basePath="/scout" />
        </Suspense>

        <Suspense fallback={<BoardFallback />}>
          <OpportunityBoard />
        </Suspense>
      </div>
    </PageShell>
  )
}

function TeamPickerFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Loading teams...</span>
    </div>
  )
}

function BoardFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="text-center">
        <div className="mb-2 text-lg font-medium">Loading opportunities...</div>
        <div className="text-sm text-muted-foreground">Analyzing wire targets</div>
      </div>
    </div>
  )
}
