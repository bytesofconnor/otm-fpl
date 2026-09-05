// Scout Matchup Prep — League-wide start/sit intelligence
import type { Metadata } from "next"
import { MatchupPrep } from "@/components/scout-matchup-prep"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "Scout · Matchup Prep",
  description: "Start/sit decisions for Over the Moon. Lineup heatmap and bench order.",
}

// SIA default teamId (cbarrett97 / Saints Intelligence Agency)
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

export default async function MatchupPrepPage({
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
            Matchup Prep
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start/sit intelligence. Lineup heatmap and bench order.
          </p>
        </header>

        <ScoutTeamPicker currentTeamId={teamId} basePath="/scout/matchup" />

        <MatchupPrep />
      </div>
    </PageShell>
  )
}
